"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CatmullRomCurve3, Color, Group, Mesh, Quaternion, TubeGeometry, Vector3 } from "three";
import { useGame } from "../state/store";
import { CHARACTERS, type CharacterId } from "../types";
import type { MonkeyLocomotion } from "./monkeyMotion";
import {
  createPhaseFourVineLeafGeometry,
  PHASE_FOUR_VINE_LEAF_COLORS,
} from "../world/phaseFourAssets";

// Replaces the old flat coloured ring under the selected character with a
// braided vine wreath (reference: assets_referencia/select monkey cipó) —
// two intertwined strands, not one smooth tube, thickly leafed.
const RING_RADIUS = 0.6;
const BRAID_AMPLITUDE = 0.0075;
const BRAID_TWISTS = 13;
const STRAND_RADIUS = 0.008;
// Three strands (not two) so their gaps overlap instead of lining up —
// two strands left a visible bare stretch between them at every twist.
const STRAND_COUNT = 10;
const LEAF_COUNT = 16;
const BARK_TONES = ["#5c4327", "#6b4f2c", "#4a3620"];
const SPIN_RADIANS_PER_SECOND = 0.1;
const STRAND_OPACITY = 0.5;
const STRAND_OPACITY_POWER = 0.5;
const LEAF_OPACITY = 0.5;
const LEAF_OPACITY_POWER = 0.5;

// While actually rising through a jump (see LocomotionState "JUMP" in
// monkeyMotion.ts), the vine wreath is swapped for a ring of leaves and
// pebbles that circles the character instead. On the way back down neither
// is shown, per the brief.
const SPIRAL_HEIGHT = 2.05;
const SPIRAL_RADIUS = 1.52;
const SPIRAL_BULGE = 0.16;
const SPIRAL_SPIN_RADIANS_PER_SECOND = 5;
const SPIRAL_LEAF_COUNT = 8;
const SPIRAL_LEAF_SCALE = 0.15;
const SPIRAL_PEBBLE_COUNT = 7;
const SPIRAL_PEBBLE_SCALE = 0.045;
const SPIRAL_PEBBLE_COLOR = "#c7b494";
const SPIRAL_DEBRIS_OPACITY = 0.85;
const SPIRAL_BOB_AMPLITUDE = 0.045;
const SPIRAL_BOB_SPEED = 1.3;

function random(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const UP = new Vector3(0, 1, 0);

// One strand of the braid: a ring that also winds up/down and in/out as it
// goes around, out of phase with its twin — the two together read as a
// twisted rope rather than a bare tube.
function braidStrandCurve(seed: number, phase: number) {
  const rng = random(seed);
  const segments = 96;
  const points: Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const braid = t * BRAID_TWISTS + phase;
    const wobble = 1 + Math.sin(t * 3 + seed) * 0.04 + (rng() - 0.5) * 0.02;
    const radius = RING_RADIUS * wobble + Math.cos(braid) * BRAID_AMPLITUDE;
    points.push(
      new Vector3(
        Math.sin(t) * radius,
        Math.sin(braid) * BRAID_AMPLITUDE,
        Math.cos(t) * radius,
      ),
    );
  }
  return new CatmullRomCurve3(points, true, "centripetal");
}

type Debris = {
  position: Vector3;
  quaternion?: Quaternion;
  scale: number;
  color: string;
  phase: number;
};

function scatterDebris(seed: number, count: number, scale: number, withRotation: boolean) {
  const rng = random(seed);
  return Array.from({ length: count }, (): Debris => {
    const t = rng();
    const angle = rng() * Math.PI * 2;
    const radius = SPIRAL_RADIUS * (1 + Math.sin(t * Math.PI) * SPIRAL_BULGE) * (0.55 + rng() * 0.5);
    return {
      position: new Vector3(Math.sin(angle) * radius, t * SPIRAL_HEIGHT, Math.cos(angle) * radius),
      quaternion: withRotation
        ? new Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2)
        : undefined,
      scale: scale * (0.7 + rng() * 0.6),
      color: "",
      phase: rng() * Math.PI * 2,
    };
  });
}

export default function SelectionVine({
  id,
  power,
  running,
  locomotion,
  active,
}: {
  id: CharacterId;
  power: boolean;
  running: boolean;
  locomotion: RefObject<MonkeyLocomotion>;
  // Whether this character is currently selected/powered at all. Stays
  // mounted regardless — see Character.tsx — so the geometry below (10 tube
  // strands plus debris) is only ever built once per character, not rebuilt
  // on every switch; this prop just hides it the rest of the time.
  active: boolean;
}) {
  const reduced = useGame((s) => s.reduced);
  const rootGroup = useRef<Group>(null);
  const vineGroup = useRef<Group>(null);
  const spiralGroup = useRef<Group>(null);
  const prewarmed = useRef(false);
  const leafRefs = useRef<(Mesh | null)[]>([]);
  const pebbleRefs = useRef<(Mesh | null)[]>([]);

  const { strandGeometries, leafGeometry, leafPlacements } = useMemo(() => {
    const seed = id * 37 + 11;
    const curves = Array.from({ length: STRAND_COUNT }, (_, i) =>
      braidStrandCurve(seed + i, (i / STRAND_COUNT) * Math.PI * 2),
    );
    const strands = curves.map((curve) => new TubeGeometry(curve, 220, STRAND_RADIUS, 5, true));
    const leaf = createPhaseFourVineLeafGeometry();
    const rng = random(seed + 2);
    const placements = Array.from({ length: LEAF_COUNT }, (_, i) => {
      const t = (i + rng() * 0.6) / LEAF_COUNT;
      const strand = curves[i % curves.length];
      const angle = t * Math.PI * 2;
      return {
        position: strand.getPointAt(t % 1),
        quaternion: new Quaternion().setFromAxisAngle(
          UP,
          angle + (rng() - 0.5) * 1.4 + (i % 2 ? 1.6 : -1.6),
        ),
        scale: 0.16 + rng() * 0.12,
        color: PHASE_FOUR_VINE_LEAF_COLORS[i % PHASE_FOUR_VINE_LEAF_COLORS.length],
      };
    });
    return {
      strandGeometries: strands,
      leafGeometry: leaf,
      leafPlacements: placements,
    };
  }, [id]);

  const spiralLeafGeometry = useMemo(() => createPhaseFourVineLeafGeometry(), []);
  const spiralLeaves = useMemo(
    () =>
      scatterDebris(id * 61 + 5, SPIRAL_LEAF_COUNT, SPIRAL_LEAF_SCALE, true).map((leaf, i) => ({
        ...leaf,
        color: PHASE_FOUR_VINE_LEAF_COLORS[i % PHASE_FOUR_VINE_LEAF_COLORS.length],
      })),
    [id],
  );
  const spiralPebbles = useMemo(
    () => scatterDebris(id * 83 + 9, SPIRAL_PEBBLE_COUNT, SPIRAL_PEBBLE_SCALE, false),
    [id],
  );

  useEffect(
    () => () => {
      strandGeometries.forEach((geometry) => geometry.dispose());
      leafGeometry.dispose();
      spiralLeafGeometry.dispose();
    },
    [strandGeometries, leafGeometry, spiralLeafGeometry],
  );

  const tint = useMemo(() => new Color(CHARACTERS[id].light), [id]);

  useFrame(({ clock }, delta) => {
    // Hidden objects do not upload their buffers to WebGL. Without this one
    // warm-up render, selecting a character for the first time uploads ten
    // tube geometries and their leaves during the input event itself, causing
    // a long synchronous frame. Render each wreath once while the scene is
    // settling, then return to the normal selected-only visibility.
    if (rootGroup.current) {
      if (!prewarmed.current) {
        rootGroup.current.visible = true;
        prewarmed.current = true;
      } else {
        rootGroup.current.visible = active;
      }
    }
    if (!active) return;
    const movement = locomotion.current;
    const jumping = movement?.state === "JUMP";
    const risingVelocity = movement?.velocity?.y ?? 0;
    const rising = jumping && risingVelocity > 0;
    // Falling mid-jump: neither the vine nor the circling debris is shown.
    // A hanging or walking monkey has no ground marker beneath it.
    const showVine =
      !jumping &&
      !movement?.hands?.left.grabbed &&
      !movement?.hands?.right.grabbed &&
      movement?.motion !== "vine-walk";
    const showSpiral = jumping && rising;

    if (vineGroup.current) {
      vineGroup.current.visible = showVine;
      if (showVine && running && !reduced)
        vineGroup.current.rotation.y += delta * SPIN_RADIANS_PER_SECOND;
    }
    if (spiralGroup.current) {
      spiralGroup.current.visible = showSpiral;
      if (showSpiral && running && !reduced) {
        spiralGroup.current.rotation.y += delta * SPIRAL_SPIN_RADIANS_PER_SECOND;
        const elapsed = clock.elapsedTime;
        spiralLeaves.forEach((leaf, i) => {
          const node = leafRefs.current[i];
          if (node)
            node.position.y =
              leaf.position.y + Math.sin(elapsed * SPIRAL_BOB_SPEED + leaf.phase) * SPIRAL_BOB_AMPLITUDE;
        });
        spiralPebbles.forEach((pebble, i) => {
          const node = pebbleRefs.current[i];
          if (node)
            node.position.y =
              pebble.position.y +
              Math.sin(elapsed * SPIRAL_BOB_SPEED * 1.3 + pebble.phase) * SPIRAL_BOB_AMPLITUDE;
        });
      }
    }
  });

  return (
    <group ref={rootGroup} visible={active}>
      <group ref={vineGroup} position={[0, -0.53, 0]}>
        {strandGeometries.map((geometry, i) => (
          <mesh key={i} geometry={geometry}>
            <meshBasicMaterial
              color={BARK_TONES[i % BARK_TONES.length]}
              transparent
              opacity={power ? STRAND_OPACITY_POWER : STRAND_OPACITY}
            />
          </mesh>
        ))}
        {leafPlacements.map((leaf, i) => (
          <mesh
            key={i}
            geometry={leafGeometry}
            position={leaf.position}
            quaternion={leaf.quaternion}
            scale={leaf.scale}
          >
            <meshBasicMaterial
              color={new Color(leaf.color).lerp(tint, 0.3)}
              transparent
              opacity={power ? LEAF_OPACITY_POWER : LEAF_OPACITY}
            />
          </mesh>
        ))}
      </group>
      <group ref={spiralGroup} position={[0, -0.53, 0]} visible={false}>
        {spiralLeaves.map((leaf, i) => (
          <mesh
            key={i}
            ref={(node) => {
              leafRefs.current[i] = node;
            }}
            geometry={spiralLeafGeometry}
            position={leaf.position}
            quaternion={leaf.quaternion}
            scale={leaf.scale}
          >
            <meshBasicMaterial color={leaf.color} transparent opacity={SPIRAL_DEBRIS_OPACITY} />
          </mesh>
        ))}
        {spiralPebbles.map((pebble, i) => (
          <mesh
            key={i}
            ref={(node) => {
              pebbleRefs.current[i] = node;
            }}
            position={pebble.position}
            scale={pebble.scale}
          >
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={SPIRAL_PEBBLE_COLOR}
              transparent
              opacity={SPIRAL_DEBRIS_OPACITY}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
