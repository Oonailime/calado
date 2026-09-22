"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { runtime, useGame } from "../state/store";
import { CHARACTERS, type CharacterId } from "../types";
import { PHASE_FOUR_CUBE_PIECE_SPAWNS, PHASE_FOUR_PLATFORMS } from "./phaseFourLayout";
import {
  classifyRubiksCube,
  CUBE_COLOR_HEX,
  CUBE_CORE_COLOR_HEX,
  RUBIKS_CUBE_MODEL_URL,
} from "./rubiksCubeAssets";
import { turnEase, turnProgress, type Orientation } from "./rubiksCubeState";
import { RESTING_FACE_BASIS } from "./rubiksCubeView";

const AXIS_VECTORS = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)] as const;
const SHRINE_DECK = PHASE_FOUR_PLATFORMS.find((deck) => deck.id === "summit-shrine")!;
// The reference model spans ~6.2 raw units across; scaled down it reads as a
// large floating artifact — bigger than a monkey's head, not overwhelming.
const CUBE_MODEL_SCALE = 0.23;
const CUBE_REVEAL_SECONDS = 1.1;
// Pedestal top (incl. the glowing ring) sits at local y≈0.87; the scaled
// cube's own half-height is ≈0.71, so 2.0 leaves a clear floating gap
// instead of the cube's underside sitting inside the stonework.
const CUBE_LOCAL_Y = 2.0;
const IDLE_SPIN_RADIANS_PER_SECOND = 0.25;

// A basis's quaternion maps its raw-space vectors onto the matching world
// axes (basis[k] -> standard axis k) — the inverse sense of makeBasis, which
// maps standard axes onto given vectors, hence the transpose (valid since
// these are always orthonormal rotations). Cubie orientations (tracked the
// "forward" way — where do MY local axes currently point) use makeBasis
// directly with no transpose; RESTING_FACE_BASIS and cubeInspect.faceBasis
// (tracked the other way — which raw direction is currently Right/Up/Front)
// need it. Verified numerically before use — see git history for the check.
function basisQuaternion(basis: Orientation, out: Quaternion, matrix: Matrix4, invert: boolean) {
  matrix.makeBasis(
    new Vector3(...basis[0]),
    new Vector3(...basis[1]),
    new Vector3(...basis[2]),
  );
  if (invert) matrix.transpose();
  return out.setFromRotationMatrix(matrix);
}
const RESTING_QUATERNION = basisQuaternion(
  RESTING_FACE_BASIS,
  new Quaternion(),
  new Matrix4(),
  true,
);

function CubePickup({ id, running }: { id: CharacterId; running: boolean }) {
  const collected = useGame((s) => s.puzzle.cubePieces[id]);
  const reduced = useGame((s) => s.reduced);
  const mesh = useRef<Mesh>(null);
  const spawn = PHASE_FOUR_CUBE_PIECE_SPAWNS[id];
  useFrame(({ clock }) => {
    if (!mesh.current || !running || reduced) return;
    mesh.current.position.y = spawn[1] + Math.sin(clock.elapsedTime * 1.6 + id * 2.1) * 0.12;
    mesh.current.rotation.y = clock.elapsedTime * 0.9;
  });
  if (collected) return null;
  return (
    <mesh ref={mesh} position={spawn} castShadow>
      <octahedronGeometry args={[0.26, 0]} />
      <meshStandardMaterial
        color={CHARACTERS[id].color}
        emissive={CHARACTERS[id].light}
        emissiveIntensity={0.55}
        roughness={0.3}
      />
    </mesh>
  );
}

function CubeShrinePedestal({ unlocked }: { unlocked: boolean }) {
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.42, 1.4]} position={[0, 0.42, 0]} />
      </RigidBody>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.3, 1.55, 0.7, 8]} />
        <meshStandardMaterial color="#5f6a5e" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.77, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 1.05, 0.14, 8]} />
        <meshStandardMaterial color="#788176" roughness={0.9} flatShading />
      </mesh>
      {unlocked && (
        <mesh position={[0, 0.87, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.95, 0.02, 8, 40]} />
          <meshStandardMaterial color="#dbbc78" emissive="#d8ba75" emissiveIntensity={0.6} />
        </mesh>
      )}
    </>
  );
}

export default function RubiksCube({ running }: { running: boolean }) {
  const object = useLoader(OBJLoader, RUBIKS_CUBE_MODEL_URL);
  const cubies = useMemo(() => classifyRubiksCube(object), [object]);
  const materials = useMemo(
    () => ({
      core: new MeshStandardMaterial({ color: CUBE_CORE_COLOR_HEX, roughness: 0.5 }),
      white: new MeshStandardMaterial({ color: CUBE_COLOR_HEX.white, roughness: 0.35 }),
      yellow: new MeshStandardMaterial({ color: CUBE_COLOR_HEX.yellow, roughness: 0.35 }),
      brown: new MeshStandardMaterial({ color: CUBE_COLOR_HEX.brown, roughness: 0.35 }),
    }),
    [],
  );
  const pivotBySlot = useMemo(() => {
    const map = new Map<string, Vector3>();
    cubies.forEach((cubie) => map.set(cubie.position.join(","), new Vector3(...cubie.pivot)));
    return map;
  }, [cubies]);
  useEffect(
    () => () => {
      cubies.forEach((cubie) => cubie.parts.forEach((part) => part.geometry.dispose()));
      Object.values(materials).forEach((material) => material.dispose());
    },
    [cubies, materials],
  );

  const groups = useRef<(Group | null)[]>([]);
  // spinRoot only ever carries the idle ambient spin (reset to zero while
  // the puzzle is open); orientRoot carries the actual display orientation
  // — RESTING_QUATERNION at rest, or animated toward the current faceBasis
  // while the puzzle is open. Splitting them keeps the idle spin (a plain
  // world-Y rotation) from fighting with faceBasis's own quaternion math.
  const spinRoot = useRef<Group>(null);
  const orientRoot = useRef<Group>(null);
  const unlocked = useGame((s) => s.puzzle.cubeDelivered.every(Boolean));
  const cubePuzzleOpen = useGame((s) => s.cubePuzzleOpen);
  const reduced = useGame((s) => s.reduced);
  const revealStartedAt = useRef<number | null>(null);
  const visualQuat = useRef(RESTING_QUATERNION.clone());
  const wasPuzzleOpen = useRef(false);
  const scratch = useMemo(
    () => ({
      quat: new Quaternion(),
      overlayQuat: new Quaternion(),
      targetQuat: new Quaternion(),
      matrix: new Matrix4(),
    }),
    [],
  );

  useEffect(() => {
    if (!unlocked) return;
    runtime.ensureRubiksCube();
    if (revealStartedAt.current === null) revealStartedAt.current = performance.now();
  }, [unlocked]);

  useFrame((_, delta) => {
    const spin = spinRoot.current;
    const orient = orientRoot.current;
    if (!spin || !orient) return;

    const elapsed =
      revealStartedAt.current === null ? 0 : (performance.now() - revealStartedAt.current) / 1000;
    const revealT = Math.min(1, elapsed / CUBE_REVEAL_SECONDS);
    const reveal = reduced ? (unlocked ? 1 : 0) : revealT * revealT * (3 - 2 * revealT);
    spin.visible = unlocked && reveal > 0.002;
    spin.scale.setScalar(Math.max(0.0001, reveal) * CUBE_MODEL_SCALE);

    if (cubePuzzleOpen) {
      spin.rotation.set(0, 0, 0);
      // A fresh open always starts from the canonical resting look, not
      // wherever the idle spin last left off.
      if (!wasPuzzleOpen.current) visualQuat.current.copy(RESTING_QUATERNION);
      basisQuaternion(runtime.cubeInspect.faceBasis, scratch.targetQuat, scratch.matrix, true);
      visualQuat.current.slerp(scratch.targetQuat, reduced ? 1 : 1 - Math.exp(-delta * 6));
      orient.quaternion.copy(visualQuat.current);
    } else {
      orient.quaternion.copy(RESTING_QUATERNION);
      if (running && !reduced) spin.rotation.y += delta * IDLE_SPIN_RADIANS_PER_SECOND;
    }
    wasPuzzleOpen.current = cubePuzzleOpen;

    const cube = runtime.rubiksCube;
    if (!cube || !running) return;
    let activeTurn = cube.activeTurn;
    let overlayActive = false;
    if (activeTurn) {
      const progress = turnProgress(activeTurn.startedAt, performance.now());
      if (progress >= 1 || reduced) {
        useGame.getState().completeCubeTurn();
        activeTurn = null;
      } else {
        const eased = turnEase(progress);
        scratch.overlayQuat.setFromAxisAngle(
          AXIS_VECTORS[activeTurn.axis],
          activeTurn.direction * (Math.PI / 2) * eased,
        );
        overlayActive = true;
      }
    }

    cube.cubies.forEach((cubie, i) => {
      const group = groups.current[i];
      if (!group) return;
      const pivot = pivotBySlot.get(cubie.position.join(","));
      if (!pivot) return;
      basisQuaternion(cubie.orientation, scratch.quat, scratch.matrix, false);
      if (overlayActive && activeTurn && cubie.position[activeTurn.axis] === activeTurn.layer) {
        group.position.copy(pivot).applyQuaternion(scratch.overlayQuat);
        group.quaternion.copy(scratch.overlayQuat).multiply(scratch.quat);
      } else {
        group.position.copy(pivot);
        group.quaternion.copy(scratch.quat);
      }
    });
  });

  return (
    <group name="RubiksCubeShrine">
      <group position={SHRINE_DECK.center}>
        <CubeShrinePedestal unlocked={unlocked} />
        {/* spinRoot: idle ambient spin only. orientRoot: the actual display
            orientation, driven entirely by quaternions in useFrame —
            RESTING_QUATERNION already folds in the reference model's Z-up
            tilt (white/z=+1 at world -Y, yellow/z=-1 at world +Y), and while
            the puzzle is open it eases toward whatever cubeInspect.faceBasis
            currently is. Every cubie's own position/quaternion math stays
            entirely in the model's untouched raw space regardless. */}
        <group ref={spinRoot} position={[0, CUBE_LOCAL_Y, 0]} visible={false}>
          <group ref={orientRoot}>
            {cubies.map((cubie, i) => (
              <group
                key={i}
                ref={(node) => {
                  groups.current[i] = node;
                }}
              >
                {cubie.parts.map((part, j) => (
                  <mesh
                    key={j}
                    geometry={part.geometry}
                    material={materials[part.material]}
                    castShadow
                    receiveShadow
                  />
                ))}
              </group>
            ))}
          </group>
        </group>
      </group>
      {([0, 1, 2] as const).map((id) => (
        <CubePickup key={id} id={id} running={running} />
      ))}
    </group>
  );
}
