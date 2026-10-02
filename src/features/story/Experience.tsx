"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { story, type Locale } from "@/content/story";
import { buildingIndex } from "./scene3d/buildings";
import { houseDoorOpenness, ORIGINAL_ROUTE } from "./scene3d/cameraRig";
import { VOLCANIC_ROUTE } from "./scene3d/volcanicStoryRoute";
import { MonkeyGlyph } from "./SceneArt";
import styles from "./Experience.module.css";
import WorkPortfolio from "./WorkPortfolio";
import VineLoader from "./VineLoader";
import VineScrollbar from "./VineScrollbar";
import { applyTheme, readTheme, restoreTheme, subscribeTheme, type Theme } from "./theme";
import { FullscreenIcon, toggleFullscreen, useFullscreen } from "./fullscreen";
import type { GameProps } from "@/features/game/types";
import type { StorySceneProps } from "./scene3d/StoryScene";

type Variant = "original" | "volcanic";
// If a scene never reports ready (a failed asset), lift the loader anyway.
const LOADER_TIMEOUT_MS = 20000;

function subscribeMotion(callback: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export default function Experience({ initialTheme }: { initialTheme?: Theme }) {
  const root = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const [progress, setProgress] = useState(0);
  const [locale, setLocale] = useState<Locale>("pt");
  const [Game, setGame] = useState<ComponentType<GameProps> | null>(null);
  // Null until hydrated: the server can't know the visitor's theme.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => null);
  const variant: Variant | null = theme === null ? null : theme === "dark" ? "volcanic" : "original";
  const [storyScene, setStoryScene] = useState<{
    variant: Variant;
    Component: ComponentType<StorySceneProps>;
  } | null>(null);
  const [readyVariant, setReadyVariant] = useState<Variant | null>(null);
  const ready = variant !== null && readyVariant === variant;
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const fullscreen = useFullscreen();
  const scene = Math.min(7, Math.floor(progress * 8));
  const phase = Math.min(1, progress * 8 - scene);
  const ufmgDoorOpenness = houseDoorOpenness(
    buildingIndex("mobility"),
    progress,
    reduced,
    // design2 has its own, longer route with larger houses.
    variant === "volcanic" ? VOLCANIC_ROUTE : ORIGINAL_ROUTE,
  );
  const portfolioIsVisible = (scene === 3 && phase >= 0.5) || scene === 4;
  const portfolioEntry = reduced
    ? portfolioIsVisible
      ? 1
      : 0
    : scene === 3
      ? Math.max(0, Math.min(1, (phase - 0.5) / 0.4))
      : scene === 4
        ? 1
        : 0;
  const portfolioReveal = Math.min(portfolioEntry, 1 - ufmgDoorOpenness);
  const showPortfolio = portfolioIsVisible && portfolioReveal > 0;
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const trigger = ScrollTrigger.create({
      trigger: root.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        setProgress(self.progress);
        if (self.progress > 0.86 && !loading.current) {
          loading.current = true;
          import("@/features/game/Game")
            .then((module) => setGame(() => module.default))
            .catch(() => {
              setLoadError(true);
              loading.current = false;
            });
        }
      },
    });
    return () => trigger.kill();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  }, [locale]);
  useEffect(() => {
    // Direct phase links, and ?skip (which also works on the islands), open
    // the game right away instead of the story.
    const query = new URLSearchParams(window.location.search);
    if (!["phase2", "phase3", "phase4"].includes(query.get("map") ?? "") && !query.has("skip")) return;
    let cancelled = false;
    import("@/features/game/Game").then((module) => {
      if (cancelled) return;
      setGame(() => module.default);
      setStarted(true);
      setPlaying(true);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, []);
  useLayoutEffect(() => restoreTheme(initialTheme), [initialTheme]);
  useEffect(() => {
    if (!variant) return;
    let cancelled = false;
    const sceneModule = variant === "volcanic"
      ? import("./scene3d/VolcanicStoryScene")
      : import("./scene3d/StoryScene");
    sceneModule.then((module) => {
      if (!cancelled) setStoryScene({ variant, Component: module.default });
    });
    return () => { cancelled = true; };
  }, [variant]);
  useEffect(() => {
    if (!variant || ready) return;
    const timeout = setTimeout(() => setReadyVariant(variant), LOADER_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [variant, ready]);
  useEffect(() => {
    if (!playing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [playing]);
  const pt = locale === "pt";
  const dark = theme === "dark";
  const StoryScene = storyScene?.Component;
  return (
    <>
      <VineLoader visible={!ready} locale={locale} />
      {!playing && <VineScrollbar reduced={reduced} />}
      <main
        ref={root}
        className={`${styles.journey} ${variant === "volcanic" ? styles.volcanic : ""}`}
        aria-hidden={playing || undefined}
        inert={playing || undefined}
      >
        <div className={styles.stage}>
          <div className={styles.art} aria-hidden="true">
            {storyScene && StoryScene && (
              <StoryScene
                progress={progress}
                reduced={reduced}
                active={!playing}
                locale={locale}
                onReady={() => setReadyVariant(storyScene.variant)}
              />
            )}
          </div>
          <div className={styles.vignette} />
          <header className={styles.header}>
            <div className={styles.brand}>
              <svg viewBox="-60 -80 150 180" aria-hidden="true">
                <MonkeyGlyph color="#b7a17b" />
              </svg>
              EMILIANO CALADO
            </div>
            <div className={styles.tools}>
              {fullscreen.available && (
                <button
                  className={styles.iconToggle}
                  onClick={toggleFullscreen}
                  aria-label={pt ? "Tela cheia" : "Fullscreen"}
                  title={pt ? (fullscreen.active ? "Sair da tela cheia" : "Tela cheia")
                    : (fullscreen.active ? "Exit fullscreen" : "Fullscreen")}
                  aria-pressed={fullscreen.active}
                >
                  <FullscreenIcon active={fullscreen.active} />
                </button>
              )}
              <button
                className={styles.iconToggle}
                onClick={() => applyTheme(dark ? "light" : "dark")}
                aria-label={pt ? "Modo escuro" : "Dark mode"}
                title={pt ? (dark ? "Mudar para o modo claro" : "Mudar para o modo escuro")
                  : (dark ? "Switch to light mode" : "Switch to dark mode")}
                aria-pressed={dark}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {dark ? (
                    <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7Z" />
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="4.2" />
                      <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" />
                    </>
                  )}
                </svg>
              </button>
              <button
                onClick={() => setLocale("pt")}
                aria-label="Português"
                aria-pressed={pt}
              >
                PT
              </button>
              <button
                onClick={() => setLocale("en")}
                aria-label="English"
                aria-pressed={!pt}
              >
                EN
              </button>
            </div>
          </header>
          <div className={`${styles.copy} ${scene === 4 ? styles.workCopy : ""}`}>
            <div className={styles.eyebrow}>
              {scene === 0
                ? pt
                  ? "O Templo dos Três"
                  : "The Temple of Three"
                : scene < 6
                  ? pt
                    ? "Minha história"
                    : "My story"
                  : pt
                    ? "Três caminhos. Uma identidade."
                    : "Three paths. One identity."}
            </div>
            <h1>{story[scene][locale]}</h1>
            <div className={styles.rule} />
            {scene === 0 && (
              <p>
                {pt
                  ? "Cada descoberta deixa uma marca. Cada passo, uma nova possibilidade."
                  : "Every discovery leaves a mark. Every step, a new possibility."}
              </p>
            )}
            {scene > 1 && scene < 6 && <p>{story[scene].title}</p>}
            {scene === 7 && (
              <p>{pt ? "Desenvolvedor de Software" : "Software Developer"}</p>
            )}
          </div>
          {showPortfolio && (
            <WorkPortfolio locale={locale} reveal={portfolioReveal} />
          )}
          <div className={styles.preview}>
            0{scene + 1} · {pt ? story[scene].title : story[scene].titleEn}
          </div>
          {scene === 7 && (
            <div className={styles.playZone}>
              <button
                className={styles.start}
                disabled={!Game || phase < 0.5}
                onClick={() => {
                  setStarted(true);
                  setPlaying(true);
                }}
              >
                {!Game
                  ? pt
                    ? "Preparando o mundo…"
                    : "Preparing the world…"
                  : started
                    ? pt
                      ? "Retomar ↗"
                      : "Resume ↗"
                    : pt
                      ? "Jogar ↗"
                      : "Play ↗"}
              </button>
              {loadError && (
                <p className={styles.error}>
                  {pt
                    ? "Falha ao carregar. Role um pouco para tentar novamente."
                    : "Loading failed. Scroll a little to try again."}
                </p>
              )}
            </div>
          )}
          <footer className={styles.bottom}>
            {progress < 0.995 && <div className={styles.scroll}>
              <span>↓</span>
              {pt ? "Role para descobrir" : "Scroll to discover"}
            </div>}
            <div className={styles.steps}>
              {story.map((s, i) => (
                <span
                  key={s.id}
                  className={`${styles.step} ${i === scene ? styles.active : ""}`}
                />
              ))}
              <span className={styles.count}>0{scene + 1} / 08</span>
            </div>
          </footer>
        </div>
      </main>
      {Game && started && (
        <div
          className={styles.game}
          style={{ display: playing ? "block" : "none" }}
        >
          <Game
            active={playing}
            locale={locale}
            onExit={() => setPlaying(false)}
          />
        </div>
      )}
    </>
  );
}
