"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DirectionalLight, PCFShadowMap } from "three";
import type { StorySceneProps } from "./StoryScene";
import { BUILDING_KIND, BUILDING_ORDER } from "./buildings";
import Building from "./Building";
import SchoolBuilding from "./SchoolBuilding";
import BusinessBuilding from "./BusinessBuilding";
import StoryMonkey from "./StoryMonkey";
import VolcanicScenery from "./VolcanicScenery";
import { volcanicCameraForProgress } from "./volcanicStoryCamera";
import {
  VOLCANIC_PLAYERS,
  VOLCANIC_ROUTE,
  VOLCANIC_STORY_SCALE,
  VOLCANIC_WATCH_YAW,
} from "./volcanicStoryRoute";
import { calladoState, sceneAndPhase, walkPoint } from "./cameraRig";
import { BoundaryLoaded, SceneReady } from "./sceneReady";
import { useMobileGraphics } from "../useMobileGraphics";

const BOUNDARIES = ["buildings", "cast", "chess"] as const;

// design2's cast: Mizaru and Kikazaru are already at the chess table,
// playing, while Calado walks the whole way and stops beside the board to
// watch the game.
function VolcanicCast({ progress, reduced }: Pick<StorySceneProps, "progress" | "reduced">) {
  const calado = calladoState(progress, reduced, VOLCANIC_ROUTE);
  const arrived = sceneAndPhase(progress, reduced).scene >= 6;
  return <>
    <StoryMonkey id={2} x={calado.position.x} z={calado.position.z} distance={calado.distance}
      yaw={arrived ? VOLCANIC_WATCH_YAW : calado.yaw} walking={calado.walking}
      power={calado.settled} scale={VOLCANIC_STORY_SCALE} />
    {VOLCANIC_PLAYERS.map(player => (
      <StoryMonkey key={player.id} id={player.id} x={player.seat.x} y={player.y} z={player.seat.z}
        distance={0} yaw={player.yaw} walking={false} power={false} scale={VOLCANIC_STORY_SCALE} centered />
    ))}
  </>;
}

function View({ progress, reduced, mobile }: Pick<StorySceneProps, "progress" | "reduced"> & { mobile: boolean }) {
  const camera = useThree(state => state.camera);
  const sun = useRef<DirectionalLight>(null);
  useFrame(() => {
    const pose = volcanicCameraForProgress(progress, reduced);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.lookAt);
    const point = walkPoint(progress, reduced, VOLCANIC_ROUTE);
    if (sun.current) {
      sun.current.position.set(point.x - 16, 26, point.z + 12);
      sun.current.target.position.set(point.x, 0, point.z - 4);
      sun.current.target.updateMatrixWorld();
    }
  });
  return <directionalLight ref={sun} position={[-16, 26, 12]} color="#e6e1d8" intensity={2.2}
    castShadow={!mobile} shadow-mapSize={mobile ? [512, 512] : [2048, 2048]} shadow-camera-left={-23} shadow-camera-right={23}
    shadow-camera-top={23} shadow-camera-bottom={-23} shadow-camera-near={1} shadow-camera-far={100}
    shadow-bias={-0.00015} shadow-normalBias={0.045} />;
}

export default function VolcanicStoryScene({ progress, reduced, active, locale, onReady }: StorySceneProps) {
  const mobile = useMobileGraphics();
  const loaded = useRef(new Set<string>());
  return <Canvas shadows={mobile ? false : { type: PCFShadowMap }} dpr={mobile ? [0.75, 1] : [1, 1.5]} camera={{ position: [4, 6.4, 13], fov: 50, near: 0.1, far: 550 }}
    frameloop={active ? "always" : "demand"} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
    onCreated={state => {
      state.gl.toneMappingExposure = 1.05;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __storyTest: unknown }).__storyTest = state;
    }}>
    <color attach="background" args={["#535256"]} />
    <fog attach="fog" args={["#535256", 35, 245]} />
    <hemisphereLight args={["#c7c9ce", "#211c1a", 1.7]} />
    <View progress={progress} reduced={reduced} mobile={mobile} />
    <VolcanicScenery progress={progress} active={active} reduced={reduced}
      chessLoaded={<BoundaryLoaded id="chess" loaded={loaded} />} />
    <Suspense fallback={null}>
      {BUILDING_ORDER.map(id => {
        const props = { id, progress, reduced, locale, route: VOLCANIC_ROUTE };
        const kind = BUILDING_KIND[id];
        if (kind === "school") return <SchoolBuilding key={id} {...props} />;
        if (kind === "business") return <BusinessBuilding key={id} {...props} />;
        return <Building key={id} {...props} />;
      })}
      <BoundaryLoaded id="buildings" loaded={loaded} />
    </Suspense>
    <Suspense fallback={null}>
      <VolcanicCast progress={progress} reduced={reduced} />
      <BoundaryLoaded id="cast" loaded={loaded} />
    </Suspense>
    <SceneReady boundaries={BOUNDARIES} loaded={loaded} onReady={onReady} />
  </Canvas>;
}
