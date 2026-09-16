"use client";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { gameMapFromQuery, runtime, useGame } from "./state/store";
import type { GameProps } from "./types";
import { useControls } from "./controls/useControls";
import { useSound } from "./audio/useSound";
import Character from "./characters/Character";
import { PHYSICS_FIXED_DT, WORLD_GRAVITY } from "./characters/locomotionConfig";
import FollowCamera from "./camera/FollowCamera";
import World, { AtmosphereFog } from "./world/World";
import PhaseFour from "./world/PhaseFour";
import Telemetry from "./world/Telemetry";
import { SHADOW_FRUSTUM } from "./world/shadowFrustum";
import { QUALITY_PROFILES } from "./quality";
import Controls from "./ui/Controls";
import Lock from "./ui/Lock";
import { nextLockHintCount } from "./ui/lockHints";
import styles from "./ui/Game.module.css";

class WorldBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function Ready({
  onReady,
  onLost,
}: {
  onReady: () => void;
  onLost: () => void;
}) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    runtime.canvasElement = gl.domElement;
    onReady();
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", lost);
      if (runtime.canvasElement === gl.domElement) runtime.canvasElement = null;
    };
  }, [gl, onReady, onLost]);
  return null;
}
export default function Game({ active, locale, onExit }: GameProps) {
  const root = useRef<HTMLElement>(null);
  const paused = useGame((s) => s.paused);
  const quality = useGame((s) => s.quality);
  const qualityProfile = QUALITY_PROFILES[quality];
  const contrast = useGame((s) => s.contrast);
  const puzzle = useGame((s) => s.puzzle);
  const lockOpen = useGame((s) => s.lockOpen);
  const map = useGame((s) => s.map);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const [lockHintCount, setLockHintCount] = useState(0);
  const [portalNotice, setPortalNotice] = useState(false);
  const running = active && !paused && ready && !lost && !portalNotice;
  const onReady = useCallback(() => setReady(true), []);
  const onLost = useCallback(() => setLost(true), []);
  // The portal used to be a dead end (a "next stage under construction"
  // notice). It now actually opens phase four — the brief notice stays as a
  // one-time transition beat, not a stopping point.
  const onPortalEnter = useCallback(() => {
    useGame.getState().configure({ map: "phase4" });
    setPortalNotice(true);
  }, []);
  const exitGame = useCallback(() => {
    setPortalNotice(false);
    onExit();
  }, [onExit]);
  useControls(active && !lost && !portalNotice, exitGame);
  useSound(running);
  useEffect(() => {
    if (active && ready) root.current?.focus();
  }, [active, ready]);
  useEffect(() => {
    if (puzzle.unlocked) useGame.getState().configure({ lockOpen: false });
  }, [puzzle.unlocked]);
  // `?map=phase4` skips directly to phase four without changing the normal
  // story progression, for gameplay iteration.
  useEffect(() => {
    if (!active) return;
    const requestedMap = gameMapFromQuery(
      new URLSearchParams(window.location.search).get("map"),
    );
    if (requestedMap === "phase4")
      useGame.getState().configure({ map: "phase4", paused: false });
  }, [active]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      useGame.getState().configure({ reduced: media.matches });
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const failure = (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <p>
          {locale === "pt"
            ? "O ambiente 3D não pôde ser iniciado. Verifique a aceleração gráfica do navegador e recarregue a página."
            : "The 3D environment could not start. Check browser graphics acceleration and reload."}
        </p>
        <button className={styles.resume} onClick={exitGame}>
          {locale === "pt" ? "Voltar" : "Go back"}
        </button>
      </div>
    </div>
  );
  return (
    <section
      ref={root}
      tabIndex={-1}
      className={`${styles.root} ${contrast ? styles.contrast : ""}`}
      aria-label={locale === "pt" ? "Ambiente jogável" : "Playable environment"}
      data-ready={ready}
      data-selected={puzzle.selected}
      data-bridge={puzzle.bridge}
      data-built={puzzle.built}
      data-sustained={puzzle.sustained.join(",")}
      data-powers={puzzle.powers.join(",")}
      data-logs={puzzle.logs.join(",")}
      data-bananas={puzzle.bananas.join(",")}
      data-code-progress={puzzle.codeProgress}
      data-unlocked={puzzle.unlocked}
      data-lock-open={lockOpen}
      data-portal-notice={portalNotice}
      data-map={map}
      data-revision={puzzle.revision}
    >
      <WorldBoundary fallback={failure}>
        <div
          className={`${styles.canvas} ${
            puzzle.selected === 0 ? styles.blindVision : ""
          }`}
        >
          <Canvas
            shadows={qualityProfile.shadow}
            dpr={qualityProfile.dpr}
            camera={{ position: [0, 6, 12], fov: 48, near: 0.1, far: 160 }}
            frameloop={active && !paused ? "always" : "demand"}
            fallback={failure}
            gl={{
              antialias: qualityProfile.antialias,
              powerPreference: "high-performance",
              stencil: false,
            }}
          >
            <color attach="background" args={[map === "phase4" ? "#a4d6d1" : "#a9d9e8"]} />
            {map === "phase4" ? <fog attach="fog" args={["#a4d6d1", 38, 115]} /> : <AtmosphereFog />}
            <hemisphereLight args={["#f4e3ae", "#3a4933", map === "phase4" ? 1.65 : 2.1]} />
            <directionalLight
              key={quality}
              position={map === "phase4" ? [24, 48, -12] : [10, 18, 8]}
              color="#ffd8a0"
              intensity={map === "phase4" ? 2.2 : 3.1}
              castShadow={quality !== "low"}
              shadow-mapSize={[
                qualityProfile.shadowMapSize,
                qualityProfile.shadowMapSize,
              ]}
              shadow-camera-left={SHADOW_FRUSTUM.left}
              shadow-camera-right={SHADOW_FRUSTUM.right}
              shadow-camera-top={SHADOW_FRUSTUM.top}
              shadow-camera-bottom={SHADOW_FRUSTUM.bottom}
              shadow-camera-near={SHADOW_FRUSTUM.near}
              shadow-camera-far={SHADOW_FRUSTUM.far}
              shadow-bias={-0.0003}
              shadow-normalBias={0.03}
            />
            <pointLight
              position={[-9, 5, 6]}
              color="#8fb0a8"
              intensity={0.35}
              distance={30}
              decay={2}
            />
            <Suspense fallback={null}>
              <Physics
                paused={!running}
                gravity={[WORLD_GRAVITY.x, WORLD_GRAVITY.y, WORLD_GRAVITY.z]}
                timeStep={PHYSICS_FIXED_DT}
              >
                {map === "phase4" ? (
                  <PhaseFour running={running} />
                ) : (
                  <World running={running} onPortalEnter={onPortalEnter} />
                )}
                {([0, 1, 2] as const).map((id) => (
                  <Character key={id} id={id} running={running} />
                ))}
                <FollowCamera running={running} />
                <Ready onReady={onReady} onLost={onLost} />
                <Telemetry element={root} running={running} />
              </Physics>
            </Suspense>
          </Canvas>
        </div>
        {!ready && (
          <div className={styles.overlay}>
            <div className={styles.loading} role="status">
              <span />
              {locale === "pt"
                ? "Preparando a física e o cenário…"
                : "Preparing physics and scenery…"}
            </div>
          </div>
        )}
        {ready && !lost && !portalNotice && (
          <Controls locale={locale} onExit={exitGame} />
        )}
        {ready && !lost && lockOpen && (
          <Lock
            locale={locale}
            hintCount={lockHintCount}
            onRequestHint={() =>
              setLockHintCount((count) => nextLockHintCount(count))
            }
          />
        )}
        {ready && !lost && portalNotice && (
          <div className={styles.overlay}>
            <div
              className={`${styles.panel} ${styles.portalPanel}`}
              role="dialog"
              aria-modal="true"
              aria-label={
                locale === "pt" ? "Próxima fase" : "Next stage"
              }
            >
              <span className={styles.portalSeal} aria-hidden="true">
                K · M · I
              </span>
              <h2>
                {locale === "pt"
                  ? "Você atravessou o portal"
                  : "You crossed the portal"}
              </h2>
              <p>
                {locale === "pt"
                  ? "À frente, o vale das copas: escale cipós e balance entre eles até o cume atrás da cachoeira."
                  : "Ahead, the canopy valley: climb vines and swing between them to the summit behind the waterfall."}
              </p>
              <button
                autoFocus
                className={styles.resume}
                onClick={() => setPortalNotice(false)}
              >
                {locale === "pt" ? "Continuar" : "Continue"}
              </button>
            </div>
          </div>
        )}
        {lost && failure}
      </WorldBoundary>
    </section>
  );
}
