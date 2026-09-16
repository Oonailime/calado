"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Group } from "three";
import {
  MONKEY_RIG_BONES,
  MONKEY_RIG_CONTROLS,
  type MonkeyRigCategory,
} from "@/features/game/characters/monkeyRig";
import styles from "./MonkeyRigPreview.module.css";

const CATEGORY_COLOR: Record<MonkeyRigCategory, string> = {
  root: "#ffffff",
  torso: "#64d8ff",
  head: "#d4f1ff",
  face: "#f5a7d4",
  arm: "#f6c453",
  hand: "#ff8e53",
  leg: "#9ee37d",
  tail: "#c69cff",
};

function RigLines({ rotate }: { rotate: boolean }) {
  const rig = useRef<Group>(null);
  const geometries = useMemo(() => {
    const byName = new Map(MONKEY_RIG_BONES.map((bone) => [bone.name, bone]));
    return Object.keys(CATEGORY_COLOR).map((category) => {
      const positions: number[] = [];
      for (const bone of MONKEY_RIG_BONES) {
        if (bone.category !== category || !bone.parent) continue;
        const parent = byName.get(bone.parent);
        if (!parent) continue;
        positions.push(...parent.position, ...bone.position);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new BufferAttribute(new Float32Array(positions), 3),
      );
      return { category: category as MonkeyRigCategory, geometry };
    });
  }, []);
  useFrame((_, delta) => {
    if (rotate && rig.current) rig.current.rotation.y += delta * 0.22;
  });
  return (
    <group ref={rig} position={[0, -1.05, 0]} rotation={[0, -0.3, 0]}>
      {geometries.map(({ category, geometry }) => (
        <lineSegments key={category} geometry={geometry}>
          <lineBasicMaterial color={CATEGORY_COLOR[category]} />
        </lineSegments>
      ))}
      {MONKEY_RIG_BONES.filter(
        (bone) =>
          bone.category !== "face" ||
          bone.name === "Jaw" ||
          bone.name.startsWith("Eye_"),
      ).map((bone) => (
        <mesh key={bone.name} position={bone.position}>
          <sphereGeometry
            args={[
              bone.category === "root" || bone.category === "torso"
                ? 0.026
                : 0.017,
              8,
              6,
            ]}
          />
          <meshBasicMaterial color={CATEGORY_COLOR[bone.category]} />
        </mesh>
      ))}
      <mesh position={[0, 1.98, 0.015]} scale={[0.14, 0.17, 0.13]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#d4f1ff"
          wireframe
          transparent
          opacity={0.24}
        />
      </mesh>
      <mesh position={[0, 1.45, 0]} scale={[0.25, 0.36, 0.15]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#64d8ff"
          wireframe
          transparent
          opacity={0.18}
        />
      </mesh>
      <mesh position={[0, 0.91, 0]} scale={[0.22, 0.16, 0.15]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  );
}

const categoryLabels: Record<MonkeyRigCategory, string> = {
  root: "Centro de massa",
  torso: "Coluna e tórax",
  head: "Pescoço e cabeça",
  face: "Face",
  arm: "Ombros e braços",
  hand: "Mãos e dedos",
  leg: "Quadril e pernas",
  tail: "Cauda",
};

export default function MonkeyRigPreview() {
  const [rotate, setRotate] = useState(true);
  const deformBones = MONKEY_RIG_BONES.filter((bone) => bone.deform).length;
  return (
    <main className={styles.root}>
      <section className={styles.viewer} aria-label="Rig anatômico do macaco">
        <Canvas
          camera={{ position: [2.65, 1.45, 4.25], fov: 35 }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#101820"]} />
          <gridHelper
            args={[5, 20, "#294456", "#1a2d39"]}
            position={[0, -1.05, 0]}
          />
          <RigLines rotate={rotate} />
        </Canvas>
        <button type="button" onClick={() => setRotate((value) => !value)}>
          {rotate ? "Pausar rotação" : "Girar modelo"}
        </button>
      </section>
      <aside className={styles.panel}>
        <span className={styles.eyebrow}>RIG CANÔNICO / V1</span>
        <h1>Anatomia antes da animação.</h1>
        <p>
          Este é o modelo estrutural único usado para retargeting. Ele separa
          pelve, cinco segmentos de tronco, pescoço, cabeça, cintura escapular,
          braços, mãos, pernas e cauda antes que qualquer pose seja aplicada.
        </p>
        <dl className={styles.stats}>
          <div>
            <dt>Bones</dt>
            <dd>{MONKEY_RIG_BONES.length}</dd>
          </div>
          <div>
            <dt>Deformadores</dt>
            <dd>{deformBones}</dd>
          </div>
          <div>
            <dt>Controles</dt>
            <dd>{MONKEY_RIG_CONTROLS.length}</dd>
          </div>
        </dl>
        <ul className={styles.legend}>
          {(Object.keys(CATEGORY_COLOR) as MonkeyRigCategory[]).map(
            (category) => (
              <li key={category}>
                <span style={{ background: CATEGORY_COLOR[category] }} />
                {categoryLabels[category]}
              </li>
            ),
          )}
        </ul>
        <p className={styles.note}>
          O FBX antigo e o gibbon do Unity entram por adaptadores de nomes. A
          caminhada quadrúpede original continua sendo um clip independente.
        </p>
      </aside>
    </main>
  );
}
