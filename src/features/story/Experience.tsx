"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { story, type Locale } from "@/content/story";
import { MonkeyGlyph } from "./SceneArt";
import SequenceArt from "./SequenceArt";
import styles from "./Experience.module.css";
import type { GameProps } from "@/features/game/types";

function subscribeMotion(callback: () => void) {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export default function Experience() {
  const root = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const [progress, setProgress] = useState(0);
  const [locale, setLocale] = useState<Locale>("pt");
  const [Game, setGame] = useState<ComponentType<GameProps> | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const scene = Math.min(7, Math.floor(progress * 8));
  const phase = Math.min(1, progress * 8 - scene);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(min-width: 761px) and (pointer: fine)", () => {
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
    });
    return () => media.revert();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "pt" ? "pt-BR" : "en";
  }, [locale]);
  useEffect(() => {
    if (!playing) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [playing]);
  const pt = locale === "pt";
  return (
    <>
      <div className={styles.mobile}>
        <svg viewBox="-60 -80 160 180" aria-hidden="true">
          <MonkeyGlyph />
        </svg>
        <h1>Emiliano Calado</h1>
        <p>
          Esta experiência foi criada para computador. Use um PC com teclado e
          mouse para explorar o Templo dos Três.
        </p>
      </div>
      <main
        ref={root}
        className={styles.journey}
        aria-hidden={playing || undefined}
        inert={playing || undefined}
      >
        <div className={styles.stage}>
          <div className={styles.art}>
            <SequenceArt progress={progress} reduced={reduced} />
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
          <div className={styles.copy}>
            <div className={styles.eyebrow}>
              {scene === 0
                ? pt
                  ? "Uma história em construção"
                  : "A story in the making"
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
              <>
                <p>{pt ? "Desenvolvedor de Software" : "Software Developer"}</p>
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
              </>
            )}
          </div>
          <div className={styles.preview}>
            {pt
              ? "Animatic · estudo de movimento 01"
              : "Animatic · motion study 01"}
          </div>
          <footer className={styles.bottom}>
            <div className={styles.scroll}>
              <span>↓</span>
              {pt ? "Role para descobrir" : "Scroll to discover"}
            </div>
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
