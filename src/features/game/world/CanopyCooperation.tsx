"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, TubeGeometry } from "three";
import { runtime, useGame } from "../state/store";
import { createCanopyHarvestMarkerGeometry, createPhaseFourVineLeafGeometry, PHASE_FOUR_VINE_LEAF_COLORS } from "./phaseFourAssets";
import { PHASE_FOUR_CUBE_PIECE_SPAWNS, PHASE_FOUR_PLATFORMS } from "./phaseFourLayout";
import { CANOPY_BRIDGE_CURVE, CANOPY_BRIDGE_ENDPOINTS, CANOPY_HARVESTS, CANOPY_PRISM_SOCKETS, CANOPY_STUMPS } from "./canopyCooperationLayout";

const COLORS = ["#e5efeb", "#f2c653", "#b77c45"];
const SHRINE = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "summit-shrine")!.center;
const BRIDGE_LEAF_COUNT = 20;

export default function CanopyCooperation({ scene, running }: { scene: Group; running: boolean }) {
  const puzzle = useGame(state => state.puzzle);
  const rope = useMemo(() => new TubeGeometry(CANOPY_BRIDGE_CURVE, 180, 0.1, 8, false), []);
  const harvestMarkers = useMemo(() => CANOPY_HARVESTS.map(site => createCanopyHarvestMarkerGeometry(site.id, site.position)), []);
  const leafGeometry = useMemo(() => createPhaseFourVineLeafGeometry(), []);
  const leafPoints = useMemo(
    () =>
      Array.from({ length: BRIDGE_LEAF_COUNT }, (_, i) => {
        const t = (i + 1) / (BRIDGE_LEAF_COUNT + 1);
        const p = CANOPY_BRIDGE_CURVE.getPointAt(t);
        return { t, position: [p.x, p.y - 0.18, p.z] as [number, number, number] };
      }),
    [],
  );
  const leaves = useRef<(Mesh | null)[]>([]);
  const progress = useRef(0);
  const growingTip = useRef<Mesh>(null);
  const carried = useRef<(Mesh | null)[]>([]);
  const glow = useRef<Group>(null);
  const focusRingMaterial = useRef<MeshStandardMaterial>(null);
  const focusLight = useRef<PointLight>(null);
  const focusBurst = useRef<Mesh>(null);
  // -1 = idle; 0..1 = an expanding-ring pulse playing, fired once on the
  // false→true edge so the moment focus is achieved is unmistakable (the
  // static ring recolor alone — pale cream to pale mint — was too subtle to
  // notice, which is why focusing silently succeeded but read as "broken").
  const burst = useRef(-1);
  const wasFocused = useRef(false);
  const harvestGlows = useRef<(Mesh | null)[]>([]);

  useEffect(() => () => { rope.dispose(); harvestMarkers.forEach(marker => marker.dispose()); leafGeometry.dispose(); }, [rope, harvestMarkers, leafGeometry]);
  useEffect(() => {
    CANOPY_HARVESTS.forEach((site, i) => {
      // AssetBuilder prefixes scopes with the environment's exported name.
      scene.traverse(child => {
        if (child.name.endsWith(`_liana-${site.id}`)) child.visible = !puzzle.canopyVines[i];
      });
    });
  }, [scene, puzzle.canopyVines]);
  useFrame(({ clock }, delta) => {
    if (!running) return;
    progress.current = puzzle.canopyBridgeBuilt ? Math.min(1, progress.current + delta / 1.8) : 0;
    rope.setDrawRange(0, Math.floor(progress.current * 180) * 8 * 6);
    if (growingTip.current) CANOPY_BRIDGE_CURVE.getPoint(progress.current, growingTip.current.position);
    leaves.current.forEach((leaf, i) => {
      if (leaf) leaf.visible = leafPoints[i].t <= progress.current;
    });
    carried.current.forEach((mesh, id) => {
      if (!mesh) return;
      const position = runtime.positions[id];
      mesh.position.set(position.x, position.y + 1.2, position.z);
      mesh.rotation.y += delta;
    });
    if (glow.current) glow.current.rotation.y += delta * 0.3;
    if (puzzle.canopyFocused && !wasFocused.current) burst.current = 0;
    wasFocused.current = puzzle.canopyFocused;
    if (burst.current >= 0) {
      burst.current = Math.min(1.15, burst.current + delta);
      if (focusBurst.current) {
        const t = Math.min(1, burst.current);
        focusBurst.current.visible = t < 1;
        focusBurst.current.scale.setScalar(1 + t * 4.2);
        (focusBurst.current.material as MeshStandardMaterial).opacity = (1 - t) * 0.9;
      }
      if (burst.current >= 1.15) burst.current = -1;
    }
    const focusPulse = puzzle.canopyFocused
      ? 1.4 + Math.sin(clock.elapsedTime * 1.8) * 0.35
      : 0;
    if (focusRingMaterial.current)
      focusRingMaterial.current.emissiveIntensity = focusPulse;
    if (focusLight.current) focusLight.current.intensity = focusPulse * 1.6;
    const pulse = 0.75 + Math.sin(clock.elapsedTime * 2.4) * 0.25;
    harvestGlows.current.forEach((mesh) => {
      if (!mesh) return;
      // Pulse the colour only: the cuff stays fitted to the actual vine.
      (mesh.material as MeshBasicMaterial).color.setRGB(0.55 + pulse * 0.35, 1, 0.25 + pulse * 0.25);
    });
  });
  const white = PHASE_FOUR_CUBE_PIECE_SPAWNS[0];
  // Once all three vines are harvested, focusing has nothing left to do —
  // the ring (and its glow) has served its purpose and disappears instead of
  // sitting there lit forever.
  const harvestComplete = puzzle.canopyVines.every(Boolean);
  return (
    <group name="canopy-cooperation">
      {!harvestComplete && (
        <group ref={glow} position={[white[0], 16.04, white[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.1, 1.18, 48]} />
            <meshStandardMaterial
              ref={focusRingMaterial}
              color={puzzle.canopyFocused ? "#8dffc2" : "#f1f7ed"}
              emissive={puzzle.canopyFocused ? "#5cffa0" : "#000000"}
              emissiveIntensity={0}
              transparent
              opacity={0.85}
            />
          </mesh>
          <pointLight
            ref={focusLight}
            color="#9dffc4"
            intensity={0}
            distance={5}
            decay={2}
            position={[0, 0.6, 0]}
          />
          <mesh ref={focusBurst} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.92, 1.3, 48]} />
            <meshStandardMaterial
              color="#c8ffdf"
              emissive="#9dffc4"
              emissiveIntensity={2}
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
      {CANOPY_HARVESTS.map((site, i) => !puzzle.canopyVines[i] && puzzle.canopyFocused && (
        <mesh key={site.id} name={`harvest-marker-${site.id}`}
          ref={node => { harvestGlows.current[i] = node; }}
          geometry={harvestMarkers[i]} userData={{ cameraOccluder: false }}>
          <meshBasicMaterial color="#c4ef89" />
        </mesh>
      ))}
      {Object.entries(CANOPY_STUMPS).map(([name, position]) => (
        <RigidBody key={name} type="fixed" colliders={false} position={position}>
          <CylinderCollider args={[0.5, 0.28]} position={[0, 0.5, 0]} />
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.24, 0.32, 1, 10]} />
            <meshStandardMaterial color="#806037" roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.007, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.23, 16]} />
            <meshStandardMaterial color="#c5a272" />
          </mesh>
          {(name === "lower" ? puzzle.canopyGoldTied : puzzle.canopyBridgeBuilt) && (
            <mesh position={[0, 1.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.19, 0.09, 8, 24]} />
              <meshStandardMaterial color="#536d2e" roughness={1} />
            </mesh>
          )}
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[0, 0.48 + i * 0.09, 0]} rotation={[Math.PI / 2, 0, i * 0.08]}>
              <torusGeometry args={[0.275, 0.048, 6, 20]} />
              <meshStandardMaterial color={name === "lower" && puzzle.canopyGoldTied ? "#90aa53" : "#526b32"} roughness={1} />
            </mesh>
          ))}
        </RigidBody>
      ))}
      <mesh name="canopy-built-vine" geometry={rope} visible={puzzle.canopyBridgeBuilt} castShadow>
        <meshStandardMaterial color="#536d2e" roughness={1} />
      </mesh>
      <group visible={puzzle.canopyBridgeBuilt}>
        <mesh position={CANOPY_BRIDGE_ENDPOINTS[0]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color="#536d2e" roughness={1} />
        </mesh>
        <mesh ref={growingTip}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color="#536d2e" roughness={1} />
        </mesh>
      </group>
      {leafPoints.map(({ position }, i) => (
        <mesh
          key={i}
          ref={(node) => { leaves.current[i] = node; }}
          geometry={leafGeometry}
          position={position}
          rotation={[0, i * 2.1, 0]}
          visible={false}
        >
          <meshStandardMaterial
            color={PHASE_FOUR_VINE_LEAF_COLORS[i % 5]}
            roughness={1}
          />
        </mesh>
      ))}
      {COLORS.map((color, id) => (
        <group key={color}>
          <mesh ref={node => { carried.current[id] = node; }} visible={puzzle.cubePieces[id] && !puzzle.cubeDelivered[id]}>
            <octahedronGeometry args={[0.19]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
          </mesh>
          <mesh name={`shrine-prism-${id}`} position={CANOPY_PRISM_SOCKETS[id].position.map((v, axis) => v + SHRINE[axis]) as [number, number, number]} rotation={[0, CANOPY_PRISM_SOCKETS[id].angle, 0]}>
            <octahedronGeometry args={[0.24]} />
            <meshStandardMaterial color={color} wireframe={!puzzle.cubeDelivered[id]} emissive={color} emissiveIntensity={puzzle.cubeDelivered[id] ? 0.7 : 0} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
