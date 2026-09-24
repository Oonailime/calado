"use client";
import {
  Component,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { PerspectiveCamera as PerspectiveCameraInstance } from "three";
import { gameMapFromQuery, runtime, useGame, type GameMap } from "./state/store";
import type { GameProps } from "./types";
import { useControls } from "./controls/useControls";
import { useSound } from "./audio/useSound";
import Character from "./characters/Character";
import { PHYSICS_FIXED_DT, WORLD_GRAVITY } from "./characters/locomotionConfig";
import FollowCamera from "./camera/FollowCamera";
import World, { AtmosphereFog } from "./world/World";
import PhaseFour from "./world/PhaseFour";
import PhaseTwo from "./world/PhaseTwo";
import Telemetry from "./world/Telemetry";
import { SHADOW_FRUSTUM } from "./world/shadowFrustum";
import { QUALITY_PROFILES } from "./quality";
import Controls from "./ui/Controls";
import Lock from "./ui/Lock";
import { nextLockHintCount } from "./ui/lockHints";
import RubiksCubePuzzle from "./ui/RubiksCubePuzzle";
import styles from "./ui/Game.module.css";
import { PHASE_TWO_START_YAW } from "./world/phaseTwoLayout";
import { phase2Chess } from "./world/phase2Chess";
import { ChessPanel } from "./world/ChessTab";
import { TrophyCollection } from "./ui/Inventory";

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

// The Canvas (and its one camera instance) persists across map changes —
// only <Physics key={map}> below remounts. The `camera` prop on <Canvas>
// only configures the camera when it's first created, so changing its `far`
// there had no effect after the initial mount: arriving at phase2 straight
// from a `?map=phase2` link got the right far plane (phase2 was the very
// first map), but reaching it at runtime through the portal kept whatever
// far plane the previous map had set, clipping the view short. Applying it
// imperatively (with the required updateProjectionMatrix()) keeps it correct
// on every transition.
function CameraFarPlane({ far }: { far: number }) {
  const camera = useThree((s) => s.camera);
  // Three.js objects vended by useThree are intentionally mutable — this is
  // the standard R3F way to adjust an existing camera/object3D in place.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    if (!(camera instanceof PerspectiveCameraInstance) || camera.far === far)
      return;
    camera.far = far;
    camera.updateProjectionMatrix();
  }, [camera, far]);
  /* eslint-enable react-hooks/immutability */
  return null;
}

const GameCanvas = memo(function GameCanvas({
  active,
  failure,
  map,
  onLost,
  onPortalEnter,
  onReady,
  paused,
  quality,
  root,
  running,
}: {
  active: boolean;
  failure: ReactNode;
  map: ReturnType<typeof gameMapFromQuery>;
  onLost: () => void;
  onPortalEnter: () => void;
  onReady: () => void;
  paused: boolean;
  quality: keyof typeof QUALITY_PROFILES;
  root: RefObject<HTMLElement | null>;
  running: boolean;
}) {
  const qualityProfile = QUALITY_PROFILES[quality];

  return (
    <Canvas
      onCreated={(state) => { (window as unknown as { __canopyTest: unknown }).__canopyTest = state; }}
      shadows={qualityProfile.shadow}
      dpr={qualityProfile.dpr}
      camera={{ position: [0, 6, 12], fov: 48, near: 0.1, far: map === "phase2" ? 420 : 160 }}
      frameloop={active && !paused ? "always" : "demand"}
      fallback={failure}
      gl={{
        antialias: qualityProfile.antialias,
        powerPreference: "high-performance",
        stencil: false,
      }}
    >
      <CameraFarPlane far={map === "phase2" ? 420 : 160} />
      <color attach="background" args={[map === "phase2" ? "#48434a" : map === "phase3" ? "#a4d6d1" : "#a9d9e8"]} />
      {map === "phase2" ? <fog attach="fog" args={["#48434a", 110, 390]} /> : map === "phase3" ? <fog attach="fog" args={["#a4d6d1", 38, 115]} /> : <AtmosphereFog />}
      <hemisphereLight args={map === "phase2" ? ["#b9bbc9", "#403030", 1.4] : ["#f4e3ae", "#3a4933", map === "phase3" ? 1.65 : 2.1]} />
      <directionalLight
        key={quality}
        position={map === "phase2" ? [-24, 48, 18] : map === "phase3" ? [24, 48, -12] : [10, 18, 8]}
        color={map === "phase2" ? "#d3ccdf" : "#ffd8a0"}
        intensity={map === "phase2" ? 1.5 : map === "phase3" ? 2.2 : 3.1}
        castShadow={quality !== "low"}
        shadow-mapSize={[
          map === "phase2" ? Math.min(2048, qualityProfile.shadowMapSize) : qualityProfile.shadowMapSize,
          map === "phase2" ? Math.min(2048, qualityProfile.shadowMapSize) : qualityProfile.shadowMapSize,
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
          key={map}
          paused={!running}
          gravity={[WORLD_GRAVITY.x, WORLD_GRAVITY.y, WORLD_GRAVITY.z]}
          timeStep={PHYSICS_FIXED_DT}
        >
          {map === "phase2" ? (
            <PhaseTwo running={running} onPortalEnter={onPortalEnter} />
          ) : map === "phase3" ? (
            <PhaseFour running={running} onPortalEnter={onPortalEnter} />
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
  );
});

export default function Game({ active, locale, onExit }: GameProps) {
  const root = useRef<HTMLElement>(null);
  const paused = useGame((s) => s.paused);
  const quality = useGame((s) => s.quality);
  const contrast = useGame((s) => s.contrast);
  const puzzle = useGame((s) => s.puzzle);
  const lockOpen = useGame((s) => s.lockOpen);
  const cubePuzzleOpen = useGame((s) => s.cubePuzzleOpen);
  const map = useGame((s) => s.map);
  const [ready, setReady] = useState(false);
  const [lost, setLost] = useState(false);
  const [lockHintCount, setLockHintCount] = useState(0);
  const [portalNotice, setPortalNotice] = useState(false);
  // The "cube solved" panel is a one-time announcement, not a permanent
  // lock screen — once dismissed, exploring and the HUD both come back
  // (see item 1: the arrival portal also reopens once solved, in
  // PhaseFour.tsx, so there's somewhere to walk back to).
  const [cubeEndingDismissed, setCubeEndingDismissed] = useState(false);
  const running = active && !paused && ready && !lost && !portalNotice;
  const onReady = useCallback(() => setReady(true), []);
  const onLost = useCallback(() => setLost(true), []);
  const onPortalEnter = useCallback((explicitNext?: GameMap) => {
    setReady(false);
    // Two rAFs guarantee the browser has actually painted the "loading"
    // overlay (from `!ready`, below) before the map switch below forces a
    // heavy synchronous scene rebuild — a single rAF can still land before
    // the paint on some browsers. Without this, the old scene just freezes
    // mid-frame and pops straight to the new one with nothing shown between.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const state = useGame.getState();
      // Every portal but one goes "forward" (islands→phase2, phase2⇄phase3),
      // which this guess always gets right on its own. The one exception is
      // phase2's arrival portal reopening once the game is beaten (see
      // ArrivalEntrance in PhaseTwo.tsx) — walking back into THAT one must
      // go to islands, not phase3, hence the explicit override.
      const next =
        explicitNext ??
        (state.map === "islands" ? "phase2" : state.map === "phase2" ? "phase3" : "phase2");
      phase2Chess.stop();
      runtime.clear();
      runtime.phase2Restore.fill(null);
      state.configure({ map: next, phase2FromCanopy: state.map === "phase3" });
      runtime.yaw =
        next === "phase2"
          ? (state.map === "phase3" ? Math.PI : PHASE_TWO_START_YAW)
          : next === "islands"
            ? Math.PI
            : -0.47;
      runtime.pitch = 0.22;
    }));
  }, []);
  const exitGame = useCallback(() => {
    phase2Chess.stop();
    setPortalNotice(false);
    onExit();
  }, [onExit]);
  useControls(active && !lost && !portalNotice, exitGame);
  useSound(running);
  useEffect(() => () => {
    if (map === "phase2") {
      phase2Chess.stop();
      runtime.phase2Seats = [null, null];
    }
  }, [map]);
  useEffect(() => {
    if (active && ready) root.current?.focus();
  }, [active, ready]);
  useEffect(() => {
    if (puzzle.unlocked) useGame.getState().configure({ lockOpen: false });
  }, [puzzle.unlocked]);
  // Mizaru's blindness fades in as he crosses the cooperative vine bridge —
  // that progress lives in `runtime` (per-frame data, not React state), so
  // this panel polls it at a UI-appropriate rate rather than joining the
  // physics frame loop. The CSS transition on .canvas smooths each step.
  const [mizaruSightProgress, setMizaruSightProgress] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setMizaruSightProgress(runtime.mizaruVineSight),
      120,
    );
    return () => window.clearInterval(timer);
  }, []);
  // Direct phase links already initialize the store before the Canvas mounts.
  // Only phase 2 needs its camera orientation adjusted here; changing the map
  // after mount would create the wrong physics world for one render pass.
  useEffect(() => {
    if (!active) return;
    const requestedMap = gameMapFromQuery(
      new URLSearchParams(window.location.search).get("map"),
    );
    if (requestedMap === "phase2") {
      // ?skip (see phase2SkipWalk) spawns at the clearing instead of the
      // arrival portal — face the same way the normal phase3-return flow
      // already does for that same spot, not the arrival-facing yaw.
      runtime.yaw = useGame.getState().phase2FromCanopy
        ? Math.PI
        : PHASE_TWO_START_YAW;
      runtime.pitch = 0.22;
    }
  }, [active]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      useGame.getState().configure({ reduced: media.matches });
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const failure = useMemo(() => (
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
  ), [exitGame, locale]);
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
      data-cube-pieces={puzzle.cubePieces.join(",")}
      data-cube-delivered={puzzle.cubeDelivered.join(",")}
      data-canopy-focused={puzzle.canopyFocused}
      data-canopy-vines={puzzle.canopyVines.join(",")}
      data-canopy-gold-tied={puzzle.canopyGoldTied}
      data-canopy-bridge={puzzle.canopyBridgeBuilt}
      data-cube-puzzle-open={cubePuzzleOpen}
      data-cube-layers-solved={puzzle.cubeLayersSolved}
      data-cube-solved={puzzle.cubeSolved}
    >
      <WorldBoundary fallback={failure}>
        <div
          className={styles.canvas}
          style={{
            // Blind everywhere (islands, phase2, phase3) until the vine
            // crossing permanently restores his sight — no map exception.
            filter: `grayscale(${
              puzzle.selected === 0 && !puzzle.mizaruSightRestored
                ? 1 - mizaruSightProgress
                : 0
            })`,
          }}
        >
          <GameCanvas
            active={active}
            failure={failure}
            map={map}
            onLost={onLost}
            onPortalEnter={onPortalEnter}
            onReady={onReady}
            paused={paused}
            quality={quality}
            root={root}
            running={running}
          />
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
        {ready && !lost && !portalNotice && !(puzzle.cubeSolved && !cubeEndingDismissed) && (
          <Controls locale={locale} onExit={exitGame} />
        )}
        {ready && !lost && map === "phase2" && !portalNotice && (
          <ChessPanel />
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
        {ready && !lost && cubePuzzleOpen && !puzzle.cubeSolved && (
          <RubiksCubePuzzle locale={locale} />
        )}
        {ready && !lost && puzzle.cubeSolved && !cubeEndingDismissed && (
          <div className={styles.overlay}>
            <div
              className={`${styles.panel} ${styles.portalPanel}`}
              role="dialog"
              aria-modal="true"
              aria-label={locale === "pt" ? "Cubo resolvido" : "Cube solved"}
            >
              <span className={styles.portalSeal} aria-hidden="true">
                M · K · I
              </span>
              <h2>
                {locale === "pt"
                  ? "O cubo foi resolvido"
                  : "The cube has been solved"}
              </h2>
              <p>
                {locale === "pt"
                  ? "As três marcas do vale se uniram numa só peça brilhante, no alto do santuário. Por enquanto, a jornada termina aqui — mas o portal de chegada reabriu: explore o vale à vontade, ou atravesse-o de volta para a fase anterior quando quiser."
                  : "The valley's three marks became one gleaming whole, atop the shrine. For now, the journey ends here — but the arrival portal has reopened: explore the valley freely, or step back through it to the previous stage whenever you like."}
              </p>
              <TrophyCollection locale={locale} />
              <button
                autoFocus
                className={styles.resume}
                onClick={() => setCubeEndingDismissed(true)}
              >
                {locale === "pt" ? "Continuar explorando" : "Keep exploring"}
              </button>
              <button className={styles.exitPanel} onClick={exitGame}>
                {locale === "pt" ? "Voltar" : "Go back"}
              </button>
              <details className={styles.credits}>
                <summary>
                  {locale === "pt"
                    ? "Créditos e agradecimentos"
                    : "Credits and acknowledgements"}
                </summary>
                <p>
                  {locale === "pt"
                    ? "Trilha sonora original por Johannes Bornlöf."
                    : "Original soundtrack by Johannes Bornlöf."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Agradecimentos à equipe de Gibbon: Beyond the Trees, por conteúdos compartilhados sobre a movimentação dos macacos."
                    : "Thanks to the Gibbon: Beyond the Trees team, for shared material on the monkeys' movement."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Modelos 3D de natureza por Quaternius (quaternius.com), sob licença CC0."
                    : "Nature 3D models by Quaternius (quaternius.com), under a CC0 license."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Casas e construções por Sabine Birk Larsen (BineBirk.com), sob licença CC0."
                    : "Houses and buildings by Sabine Birk Larsen (BineBirk.com), under a CC0 license."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Bananeira sob licença Polyfork (polyfork.dev)."
                    : "Banana tree under a Polyfork license (polyfork.dev)."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Motor de xadrez Stockfish, sob licença GPL."
                    : "Stockfish chess engine, under a GPL license."}
                </p>
                <p>
                  {locale === "pt"
                    ? "Demais modelos e texturas 3D são ativos gratuitos de uso livre."
                    : "Remaining 3D models and textures are free, freely licensed assets."}
                </p>
              </details>
            </div>
          </div>
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
