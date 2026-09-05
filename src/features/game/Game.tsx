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
import { useGame } from "./state/store";
import type { GameProps } from "./types";
import { useControls } from "./controls/useControls";
import { useSound } from "./audio/useSound";
import Character from "./characters/Character";
import FollowCamera from "./camera/FollowCamera";
import World, { AtmosphereFog } from "./world/World";
import Telemetry from "./world/Telemetry";
import Controls from "./ui/Controls";
import Lock from "./ui/Lock";
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
    onReady();
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onReady, onLost]);
  return null;
}
export default function Game({ active, locale, onExit }: GameProps) {
  const root = useRef<HTMLElement>(null);
  const paused = useGame((s) => s.paused);
  const quality = useGame((s) => s.quality);
  const contrast = useGame((s) => s.contrast);
  const puzzle = useGame((s) => s.puzzle);
  const lockOpen = useGame((s) => s.lockOpen);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const running = active && !paused && ready && !lost;
  const onReady = useCallback(() => setReady(true), []);
  const onLost = useCallback(() => setLost(true), []);
  useControls(active && !lost, onExit);
  useSound(running);
  useEffect(() => {
    if (active && ready) root.current?.focus();
  }, [active, ready]);
  useEffect(() => {
    if (puzzle.unlocked) useGame.getState().configure({ lockOpen: false });
  }, [puzzle.unlocked]);
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
        <button className={styles.resume} onClick={onExit}>
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
      data-code-progress={puzzle.codeProgress}
      data-unlocked={puzzle.unlocked}
      data-lock-open={lockOpen}
      data-revision={puzzle.revision}
    >
      <WorldBoundary fallback={failure}>
        <div className={styles.canvas}>
          <Canvas
            shadows={quality !== "low"}
            dpr={quality === "low" ? 0.75 : quality === "medium" ? 1 : [1, 1.5]}
            camera={{ position: [0, 6, 12], fov: 48, near: 0.1, far: 160 }}
            frameloop={active && !paused ? "always" : "demand"}
            fallback={failure}
            gl={{
              antialias: quality === "high",
              powerPreference: "high-performance",
              stencil: false,
            }}
          >
            <color attach="background" args={["#243e32"]} />
            <AtmosphereFog />
            <hemisphereLight args={["#f4e3ae", "#3a3420", 2.1]} />
            <directionalLight
              position={[10, 18, 8]}
              color="#ffd8a0"
              intensity={3.1}
              castShadow={quality !== "low"}
              shadow-mapSize={quality === "high" ? [1024, 1024] : [512, 512]}
              shadow-camera-left={-25}
              shadow-camera-right={25}
              shadow-camera-top={25}
              shadow-camera-bottom={-40}
              shadow-bias={-0.001}
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
                gravity={[0, -12, 0]}
                timeStep={1 / 60}
              >
                <World running={running} />
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
        {ready && !lost && <Controls locale={locale} onExit={onExit} />}
        {ready && !lost && lockOpen && <Lock locale={locale} />}
        {lost && failure}
      </WorldBoundary>
    </section>
  );
}
