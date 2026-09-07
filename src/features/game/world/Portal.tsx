import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  Box3,
  type BufferGeometry,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { runtime, useGame } from "../state/store";
import { PORTAL } from "./layout";
import { isInsideOpenPortal } from "./portalEntry";
import {
  advancePortalConstruction,
  isOriginalPortalRune,
  portalActivationProgress,
  PORTAL_LETTERS,
  portalPartOrder,
  portalPieceProgress,
} from "./portalAnimation";

export const PORTAL_MODEL_URL = "/assets/models/portal/zen-portal.glb";

type PortalPart = {
  name: string;
  geometry: BufferGeometry;
  material: Material | Material[];
  center: Vector3;
};

type PreparedPortal = {
  structure: PortalPart[];
  inner: PortalPart[];
  vegetation: PortalPart[];
  innerBase: number;
  normalization: [number, number, number];
  geometries: BufferGeometry[];
};

const LETTER_MARKS = [
  { letter: "K", position: [0, -0.64, 5.08] },
  { letter: "M", position: [-1.72, -0.64, 3.79] },
  { letter: "I", position: [1.71, -0.64, 3.65] },
] as const;

function preparePortal(gltf: GLTF): PreparedPortal {
  gltf.scene.updateMatrixWorld(true);
  const structure: PortalPart[] = [];
  const inner: PortalPart[] = [];
  const vegetation: PortalPart[] = [];
  const bounds = new Box3();
  const geometries: BufferGeometry[] = [];

  gltf.scene.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    const mesh = child as Mesh;
    if (mesh.name.endsWith("Anchor") || isOriginalPortalRune(mesh.name)) return;

    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const partBounds = geometry.boundingBox;
    if (!partBounds) return;
    bounds.union(partBounds);
    geometries.push(geometry);
    const part = {
      name: mesh.name,
      geometry,
      material: mesh.material,
      center: partBounds.getCenter(new Vector3()),
    };
    if (mesh.name === "PortalSurface" || mesh.name === "PortalGelHighlights")
      inner.push(part);
    else if (mesh.name.startsWith("Grass")) vegetation.push(part);
    else structure.push(part);
  });

  structure.sort(
    (left, right) =>
      portalPartOrder(left.name) - portalPartOrder(right.name) ||
      left.name.localeCompare(right.name),
  );
  const center = bounds.getCenter(new Vector3());
  const innerBase = Math.min(
    ...inner.map((part) => part.geometry.boundingBox?.min.z ?? 0),
  );
  return {
    structure,
    inner,
    vegetation,
    innerBase,
    // The asset is Z-up. Its rotated lowest point becomes local Y=0, while X
    // and depth are centered over the physical foundation.
    normalization: [-center.x, -bounds.min.z, center.y],
    geometries,
  };
}

function explodedOffset(index: number) {
  const angle = index * 2.399963;
  const radius = 1.05 + (index % 4) * 0.28;
  return new Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.75,
    0.7 + (index % 5) * 0.16,
  );
}

function easePiece(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

type Stroke = readonly [number, number, number, number];
const LETTER_STROKES: Record<(typeof PORTAL_LETTERS)[number], Stroke[]> = {
  K: [
    [-0.15, -0.27, -0.15, 0.27],
    [-0.13, 0, 0.16, 0.27],
    [-0.13, 0, 0.16, -0.27],
  ],
  M: [
    [-0.2, -0.27, -0.2, 0.27],
    [-0.2, 0.27, 0, -0.04],
    [0, -0.04, 0.2, 0.27],
    [0.2, 0.27, 0.2, -0.27],
  ],
  I: [
    [-0.18, 0.27, 0.18, 0.27],
    [0, 0.27, 0, -0.27],
    [-0.18, -0.27, 0.18, -0.27],
  ],
};

function LetterMark({ letter }: { letter: (typeof PORTAL_LETTERS)[number] }) {
  return LETTER_STROKES[letter].map(([x1, z1, x2, z2], index) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return (
      <mesh
        key={index}
        position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]}
        rotation={[0, -Math.atan2(dz, dx), 0]}
        castShadow
      >
        <boxGeometry args={[Math.hypot(dx, dz), 0.055, 0.075]} />
        <meshStandardMaterial
          color="#19ecff"
          emissive="#08b9cf"
          emissiveIntensity={2.2}
          roughness={0.24}
        />
      </mesh>
    );
  });
}

export default function Portal({
  gltf,
  built,
  running,
  reduced,
  onEnter,
}: {
  gltf: GLTF;
  built: boolean;
  running: boolean;
  reduced: boolean;
  onEnter: () => void;
}) {
  const model = useMemo(() => preparePortal(gltf), [gltf]);
  const pieces = useRef<(Group | null)[]>([]);
  const letters = useRef<(Group | null)[]>([]);
  const inner = useRef<Group>(null);
  const vegetation = useRef<Group>(null);
  const aura = useRef<Mesh>(null);
  const glow = useRef<PointLight>(null);
  const construction = useRef(built ? 1 : 0);
  const previousBuilt = useRef(built);
  const wasInside = useRef(false);

  useEffect(
    () => () => model.geometries.forEach((geometry) => geometry.dispose()),
    [model],
  );
  useEffect(() => {
    if (built !== previousBuilt.current) {
      construction.current = built && reduced ? 1 : 0;
      previousBuilt.current = built;
    }
  }, [built, reduced]);

  useFrame(({ clock }, delta) => {
    construction.current = advancePortalConstruction(
      construction.current,
      delta,
      built,
      running,
      reduced,
    );
    const progress = construction.current;
    const totalPieces = model.structure.length + LETTER_MARKS.length;

    model.structure.forEach((part, index) => {
      const piece = pieces.current[index];
      if (!piece) return;
      const local = portalPieceProgress(index, totalPieces, progress);
      const eased = easePiece(local);
      const offset = explodedOffset(index);
      piece.visible = built && local > 0;
      piece.position.copy(part.center).addScaledVector(offset, 1 - eased);
      piece.rotation.set(
        (1 - eased) * 0.45,
        (1 - eased) * (index % 2 ? -0.55 : 0.55),
        (1 - eased) * 0.3,
      );
      piece.scale.setScalar(0.16 + eased * 0.84);
    });
    LETTER_MARKS.forEach((mark, letterIndex) => {
      const pieceIndex = model.structure.length + letterIndex;
      const letter = letters.current[letterIndex];
      if (!letter) return;
      const local = portalPieceProgress(pieceIndex, totalPieces, progress);
      const eased = easePiece(local);
      const offset = explodedOffset(pieceIndex);
      letter.visible = built && local > 0;
      letter.position
        .set(mark.position[0], mark.position[1], mark.position[2])
        .addScaledVector(offset, 1 - eased);
      letter.rotation.set(0, (1 - eased) * 0.7, (1 - eased) * -0.3);
      letter.scale.setScalar(0.16 + eased * 0.84);
    });

    const activation = portalActivationProgress(progress);
    if (inner.current) {
      inner.current.visible = built && activation > 0;
      inner.current.scale.set(1, 1, Math.max(0.001, easePiece(activation)));
    }
    if (vegetation.current)
      vegetation.current.visible = built && progress > 0.08;
    if (glow.current) glow.current.intensity = activation * 2.4;
    if (aura.current) {
      const material = aura.current.material as MeshBasicMaterial;
      const constructing = built && progress < 1;
      aura.current.visible = constructing;
      aura.current.rotation.z = clock.elapsedTime * 0.7;
      aura.current.scale.setScalar(0.85 + progress * 0.35);
      material.opacity = constructing ? 0.55 * (1 - progress) : 0;
    }
    const selected = useGame.getState().puzzle.selected;
    const inside = isInsideOpenPortal(
      runtime.positions[selected],
      built && progress >= 1,
    );
    if (inside && !wasInside.current) onEnter();
    wasInside.current = inside;
  });

  return (
    <group position={[PORTAL.x, -PORTAL.groundInset, PORTAL.z]}>
      {built && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider
            args={[PORTAL.halfWidth, 0.22, PORTAL.halfDepth]}
            position={[0, 0.22, 0]}
          />
          <CuboidCollider
            args={[0.48, 1.75, 0.48]}
            position={[-1.55, 2.25, 0]}
          />
          <CuboidCollider
            args={[0.48, 1.75, 0.48]}
            position={[1.55, 2.25, 0]}
          />
          <CuboidCollider args={[1.55, 0.58, 0.48]} position={[0, 4.82, 0]} />
        </RigidBody>
      )}
      <group rotation={[-Math.PI / 2, 0, 0]} position={model.normalization}>
        {model.structure.map((part, index) => (
          <group
            key={part.name}
            ref={(node) => {
              pieces.current[index] = node;
            }}
            position={[part.center.x, part.center.y, part.center.z]}
            visible={built && reduced}
          >
            <mesh
              geometry={part.geometry}
              material={part.material}
              position={[-part.center.x, -part.center.y, -part.center.z]}
              castShadow
              receiveShadow
            />
          </group>
        ))}
        <group ref={vegetation} visible={built && reduced}>
          {model.vegetation.map((part) => (
            <mesh
              key={part.name}
              geometry={part.geometry}
              material={part.material}
              receiveShadow
            />
          ))}
        </group>
        {LETTER_MARKS.map((mark, index) => (
          <group
            key={mark.letter}
            ref={(node) => {
              letters.current[index] = node;
            }}
            position={mark.position}
            visible={built && reduced}
          >
            <LetterMark letter={mark.letter} />
          </group>
        ))}
        <group
          ref={inner}
          position={[0, 0, model.innerBase]}
          visible={built && reduced}
        >
          {model.inner.map((part) => (
            <mesh
              key={part.name}
              geometry={part.geometry}
              material={part.material}
              position={[0, 0, -model.innerBase]}
            />
          ))}
        </group>
      </group>
      <pointLight
        ref={glow}
        position={[0, 2.8, 0]}
        color="#45eaff"
        intensity={built && reduced ? 2.4 : 0}
        distance={8}
        decay={2}
      />
      <mesh
        ref={aura}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, PORTAL.groundInset + 0.025, 0]}
        visible={false}
      >
        <ringGeometry args={[2.45, 2.62, 64]} />
        <meshBasicMaterial
          color="#6cf3ff"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
