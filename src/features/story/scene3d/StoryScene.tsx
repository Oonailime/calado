"use client";
import { Suspense, useLayoutEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { atmosphereColors, atmosphereLighting } from "./atmosphere";
import {
  calladoState,
  cameraForProgress,
  companionState,
  CLEARING_RADIUS,
  CONVERGENCE_POINT,
  GROUND_Y,
  HILL_SEEDS,
} from "./cameraRig";
import { BUILDING_ORDER } from "./buildings";
import Building from "./Building";
import Grass from "./Grass";
import RockPath from "./RockPath";
import StoryMonkey from "./StoryMonkey";
import type { Locale } from "@/content/story";

export type StorySceneProps = {
  progress: number;
  reduced: boolean;
  active: boolean;
  locale: Locale;
};

function CameraRig({
  progressRef,
  reduced,
}: {
  progressRef: React.RefObject<number>;
  reduced: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const look = useRef(new Vector3());
  useFrame(() => {
    const pose = cameraForProgress(progressRef.current, reduced);
    camera.position.set(...pose.position);
    look.current.set(...pose.lookAt);
    camera.lookAt(look.current);
  });
  return null;
}

function Hills() {
  return (
    <>
      {HILL_SEEDS.map((hill, i) => (
        <mesh key={i} position={[hill.x, -1.6, hill.z]} scale={hill.scale}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#3c4a3a" roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}
function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4, GROUND_Y, -32]} receiveShadow>
        <planeGeometry args={[50, 100]} />
        <meshStandardMaterial color="#5b7a4a" roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[CONVERGENCE_POINT.x, 0.01, CONVERGENCE_POINT.z]}
      >
        <circleGeometry args={[CLEARING_RADIUS, 40]} />
        <meshStandardMaterial color="#e8d9a0" roughness={1} />
      </mesh>
    </>
  );
}
function Buildings({
  progress,
  reduced,
  locale,
}: {
  progress: number;
  reduced: boolean;
  locale: Locale;
}) {
  return (
    <>
      {BUILDING_ORDER.map((id) => (
        <Building key={id} id={id} progress={progress} reduced={reduced} locale={locale} />
      ))}
      <RockPath />
      <Grass />
    </>
  );
}
function Atmosphere({ progress }: { progress: number }) {
  const { sky, fog } = atmosphereColors(progress);
  const { sunColor, sunIntensity, hemiIntensity } = atmosphereLighting(progress);
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[`#${fog.getHexString()}`, 18, 70]} />
      <hemisphereLight args={["#f4e3ae", "#3a3420", hemiIntensity]} />
      <directionalLight position={[10, 14, 8]} color={sunColor} intensity={sunIntensity} />
    </>
  );
}
function Cast({ progress, reduced }: { progress: number; reduced: boolean }) {
  const calado = calladoState(progress, reduced);
  const mizaru = companionState(-1, progress, reduced);
  const kikazaru = companionState(1, progress, reduced);
  return (
    <>
      <StoryMonkey
        id={2}
        x={calado.position.x}
        z={calado.position.z}
        yaw={calado.yaw}
        walking={calado.walking}
        power={calado.settled}
      />
      {mizaru.visible && (
        <StoryMonkey
          id={0}
          x={mizaru.position.x}
          z={mizaru.position.z}
          yaw={mizaru.yaw}
          walking={mizaru.walking}
          power={mizaru.settled}
        />
      )}
      {kikazaru.visible && (
        <StoryMonkey
          id={1}
          x={kikazaru.position.x}
          z={kikazaru.position.z}
          yaw={kikazaru.yaw}
          walking={kikazaru.walking}
          power={kikazaru.settled}
        />
      )}
    </>
  );
}
export default function StoryScene({ progress, reduced, active, locale }: StorySceneProps) {
  const progressRef = useRef(progress);
  useLayoutEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.5]}
      camera={{ position: [0, 3.6, 9], fov: 48, near: 0.1, far: 160 }}
      frameloop={active ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
    >
      <Atmosphere progress={progress} />
      <pointLight position={[-9, 5, 6]} color="#8fb0a8" intensity={0.3} distance={30} decay={2} />
      <CameraRig progressRef={progressRef} reduced={reduced} />
      <Ground />
      <Hills />
      <Suspense fallback={null}>
        <Buildings progress={progress} reduced={reduced} locale={locale} />
      </Suspense>
      <Suspense fallback={null}>
        <Cast progress={progress} reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}
