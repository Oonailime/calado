import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { CHARACTERS } from "../types";

type Tuple3 = readonly [number, number, number];
type InstancePart = {
  position: Tuple3;
  scale: Tuple3;
  color: string;
  quaternion?: Quaternion;
};

const STONE = "#697064";
const LIGHT_STONE = "#899084";
const DARK_STONE = "#30352f";
const ARM_STONE = "#62695e";
const BOOK_PAGE = "#ddd4b9";
export const TOTEM_BOOK_COLORS = [
  CHARACTERS[0].color,
  CHARACTERS[1].color,
  CHARACTERS[2].color,
] as const;
export const WISE_MONKEY_GESTURES = ["eyes", "ears", "mouth"] as const;
export const TOTEM_BOOK_GEOMETRY = {
  cover: [0.6, 0.024, 0.42],
  spinePosition: [0, 0, -0.205],
  spine: [0.6, 0.158, 0.025],
} as const;

const MONKEY_X = [-0.56, 0, 0.56] as const;
const HANDS: readonly [Tuple3, Tuple3][] = [
  [
    [-0.075, 0.91, 0.245],
    [0.075, 0.91, 0.245],
  ],
  [
    [-0.225, 0.89, 0.13],
    [0.225, 0.89, 0.13],
  ],
  [
    [-0.075, 0.8, 0.255],
    [0.075, 0.8, 0.255],
  ],
];

function absolute(x: number, point: Tuple3): Tuple3 {
  return [x + point[0], point[1], point[2]];
}

function roundedStatueParts(): InstancePart[] {
  return MONKEY_X.flatMap((x, index) => {
    const [leftHand, rightHand] = HANDS[index];
    const parts: InstancePart[] = [
      { position: [x, 0.53, 0], scale: [0.23, 0.3, 0.18], color: STONE },
      {
        position: [x, 0.52, 0.17],
        scale: [0.14, 0.2, 0.04],
        color: LIGHT_STONE,
      },
      {
        position: [x, 0.88, 0.02],
        scale: [0.22, 0.23, 0.2],
        color: STONE,
      },
      {
        position: [x, 0.82, 0.2],
        scale: [0.14, 0.1, 0.075],
        color: LIGHT_STONE,
      },
      {
        position: [x - 0.21, 0.89, 0.03],
        scale: [0.07, 0.09, 0.055],
        color: LIGHT_STONE,
      },
      {
        position: [x + 0.21, 0.89, 0.03],
        scale: [0.07, 0.09, 0.055],
        color: LIGHT_STONE,
      },
      {
        position: [x - 0.11, 0.27, 0.12],
        scale: [0.12, 0.07, 0.16],
        color: STONE,
      },
      {
        position: [x + 0.11, 0.27, 0.12],
        scale: [0.12, 0.07, 0.16],
        color: STONE,
      },
      {
        position: absolute(x, leftHand),
        scale: [0.09, 0.065, 0.045],
        color: LIGHT_STONE,
      },
      {
        position: absolute(x, rightHand),
        scale: [0.09, 0.065, 0.045],
        color: LIGHT_STONE,
      },
    ];

    // Mizaru's eyes are hidden by his hands. The other faces retain small
    // carved eyes so each gesture reads clearly even from the game camera.
    if (index !== 0) {
      parts.push(
        {
          position: [x - 0.075, 0.915, 0.205],
          scale: [0.025, 0.032, 0.018],
          color: DARK_STONE,
        },
        {
          position: [x + 0.075, 0.915, 0.205],
          scale: [0.025, 0.032, 0.018],
          color: DARK_STONE,
        },
      );
    }
    return parts;
  });
}

function limb(from: Tuple3, to: Tuple3): InstancePart {
  const start = new Vector3(...from);
  const end = new Vector3(...to);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  return {
    position: [midpoint.x, midpoint.y, midpoint.z],
    scale: [0.052, length, 0.052],
    color: ARM_STONE,
    quaternion: new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize(),
    ),
  };
}

function statueLimbs(): InstancePart[] {
  return MONKEY_X.flatMap((x, index) => {
    const [leftHand, rightHand] = HANDS[index];
    return [
      limb([x - 0.17, 0.67, 0.015], absolute(x, leftHand)),
      limb([x + 0.17, 0.67, 0.015], absolute(x, rightHand)),
    ];
  });
}

const ROUNDED_PARTS = roundedStatueParts();
const LIMB_PARTS = statueLimbs();

function applyParts(mesh: InstancedMesh | null, parts: readonly InstancePart[]) {
  if (!mesh) return;
  const dummy = new Object3D();
  const color = new Color();
  parts.forEach((part, index) => {
    dummy.position.set(...part.position);
    dummy.scale.set(...part.scale);
    if (part.quaternion) dummy.quaternion.copy(part.quaternion);
    else dummy.quaternion.identity();
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, color.set(part.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function WiseMonkeyStatue() {
  const rounded = useRef<InstancedMesh>(null);
  const limbs = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    applyParts(rounded.current, ROUNDED_PARTS);
    applyParts(limbs.current, LIMB_PARTS);
  }, []);
  return (
    <>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.12, 0.24, 8]} />
        <meshStandardMaterial color="#555e54" roughness={1} flatShading />
      </mesh>
      <instancedMesh
        ref={rounded}
        args={[undefined, undefined, ROUNDED_PARTS.length]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.96} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={limbs}
        args={[undefined, undefined, LIMB_PARTS.length]}
        castShadow
      >
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.96} flatShading />
      </instancedMesh>
    </>
  );
}

type BookInstances = {
  covers: { matrix: Matrix4; color: string }[];
  pages: Matrix4[];
};

function bookInstances(complete: boolean): BookInstances {
  const covers: BookInstances["covers"] = [];
  const pages: Matrix4[] = [];
  const book = new Object3D();
  const part = new Object3D();
  book.add(part);

  TOTEM_BOOK_COLORS.forEach((color, index) => {
    const position: Tuple3 = complete
      ? [0, 1.26 + index * 0.18, 0]
      : [MONKEY_X[index], 1.31 + (index % 2) * 0.08, 0];
    const rotation: Tuple3 = complete
      ? [0, index * 0.18, index % 2 ? 0.035 : -0.035]
      : [0.08 + index * 0.025, (index - 1) * 0.16, (index - 1) * 0.08];
    book.position.set(...position);
    book.rotation.set(...rotation);

    part.position.set(0, 0, 0);
    part.rotation.set(0, 0, 0);
    part.scale.set(0.54, 0.1, 0.36);
    book.updateMatrixWorld(true);
    pages.push(part.matrixWorld.clone());

    const coverParts: { position: Tuple3; scale: Tuple3 }[] = [
      { position: [0, 0.067, 0], scale: [...TOTEM_BOOK_GEOMETRY.cover] },
      { position: [0, -0.067, 0], scale: [...TOTEM_BOOK_GEOMETRY.cover] },
      {
        position: [...TOTEM_BOOK_GEOMETRY.spinePosition],
        scale: [...TOTEM_BOOK_GEOMETRY.spine],
      },
    ];
    for (const cover of coverParts) {
      part.position.set(...cover.position);
      part.scale.set(...cover.scale);
      book.updateMatrixWorld(true);
      covers.push({ matrix: part.matrixWorld.clone(), color });
    }
  });
  return { covers, pages };
}

function Books({ complete }: { complete: boolean }) {
  const coverMesh = useRef<InstancedMesh>(null);
  const pageMesh = useRef<InstancedMesh>(null);
  const instances = useMemo(() => bookInstances(complete), [complete]);
  useLayoutEffect(() => {
    const covers = coverMesh.current;
    const pages = pageMesh.current;
    if (covers) {
      const color = new Color();
      instances.covers.forEach((cover, index) => {
        covers.setMatrixAt(index, cover.matrix);
        covers.setColorAt(index, color.set(cover.color));
      });
      covers.instanceMatrix.needsUpdate = true;
      if (covers.instanceColor) covers.instanceColor.needsUpdate = true;
      covers.computeBoundingSphere();
    }
    if (pages) {
      instances.pages.forEach((matrix, index) =>
        pages.setMatrixAt(index, matrix),
      );
      pages.instanceMatrix.needsUpdate = true;
      pages.computeBoundingSphere();
    }
  }, [instances]);
  return (
    <>
      <instancedMesh
        ref={pageMesh}
        args={[undefined, undefined, instances.pages.length]}
        castShadow
      >
        <boxGeometry />
        <meshStandardMaterial color={BOOK_PAGE} roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={coverMesh}
        args={[undefined, undefined, instances.covers.length]}
        castShadow
      >
        <boxGeometry />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.72}
          emissive={complete ? "#554629" : "#000000"}
          emissiveIntensity={complete ? 0.32 : 0}
        />
      </instancedMesh>
    </>
  );
}

export default function WisdomTotem({
  x = 0,
  z,
  complete,
  running,
}: {
  x?: number;
  z: number;
  complete: boolean;
  running: boolean;
}) {
  const books = useRef<Group>(null);
  useFrame((_, delta) => {
    if (books.current && complete && running)
      books.current.rotation.y += Math.min(delta, 0.04) * 0.55;
  });
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.12, 1.08]} position={[0, 0.12, 0]} />
      </RigidBody>
      <WiseMonkeyStatue />
      <group ref={books}>
        <Books complete={complete} />
      </group>
      {complete && (
        <mesh position={[0, 1.47, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.82, 0.022, 8, 40]} />
          <meshStandardMaterial
            color="#dbbc78"
            emissive="#d8ba75"
            emissiveIntensity={0.6}
          />
        </mesh>
      )}
    </group>
  );
}
