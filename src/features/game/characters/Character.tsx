import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  useRapier,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, MathUtils } from "three";
import { runtime, useGame } from "../state/store";
import { CHARACTERS, type CharacterId } from "../types";
import Monkey from "./Monkey";
import {
  CHARACTER_CAPSULE_HALF_HEIGHT,
  CHARACTER_CAPSULE_RADIUS,
  CHARACTER_SPAWN_Y,
  characterSpawn,
} from "../world/layout";
import { safeGround, waterDepth } from "../world/terrain";

const EDGE_SLOW = 0.6;
const EDGE_DEEP = 3.2;
export default function Character({
  id,
  running,
}: {
  id: CharacterId;
  running: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<Group>(null);
  const locomotion = useRef({ speed: 0, grounded: true });
  const trapped = useRef(0);
  const previous = useRef({ x: 0, z: 0 });
  const selected = useGame((s) => s.puzzle.selected === id);
  const power = useGame((s) => s.puzzle.powers[id]);
  const revision = useGame((s) => s.puzzle.revision);
  const { world, rapier } = useRapier();
  useEffect(() => {
    const state = useGame.getState().puzzle;
    const spawn = characterSpawn(id, state.bridge);
    body.current?.setTranslation(spawn, true);
    body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    runtime.positions[id] = spawn;
    runtime.grounded[id] = true;
  }, [revision, id]);
  useFrame((_, delta) => {
    if (!running || !body.current) return;
    const rigid = body.current;
    const p = rigid.translation();
    const state = useGame.getState();
    const puzzle = state.puzzle;
    runtime.positions[id] = { ...p };
    const depth = waterDepth(p.x, p.z, puzzle.bridge || puzzle.powers[0]);
    if (p.y < -7 || depth > EDGE_DEEP) {
      runtime.splashes.push({ x: p.x, y: -0.2, z: p.z });
      state.reset();
      return;
    }
    const dt = Math.min(delta, 0.04);
    let vx = 0,
      vz = 0;
    const ground = world.castRay(
      new rapier.Ray({ x: p.x, y: p.y - 0.1, z: p.z }, { x: 0, y: -1, z: 0 }),
      0.6,
      true,
      undefined,
      undefined,
      undefined,
      rigid,
    );
    const grounded = !!ground;
    runtime.grounded[id] = grounded;
    let vy = rigid.linvel().y;
    if (selected && !power) {
      const keys = runtime.keys;
      const forward =
        Number(keys.has("KeyW") || keys.has("ArrowUp")) -
        Number(keys.has("KeyS") || keys.has("ArrowDown"));
      const right =
        Number(keys.has("KeyD") || keys.has("ArrowRight")) -
        Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      const length = Math.hypot(forward, right) || 1;
      vx =
        ((right * Math.cos(runtime.yaw) - forward * Math.sin(runtime.yaw)) /
          length) *
        4;
      vz =
        ((-forward * Math.cos(runtime.yaw) - right * Math.sin(runtime.yaw)) /
          length) *
        4;
      if (forward || right) state.learn("move");
      if (runtime.jump && grounded) vy = 6;
      runtime.jump = false;
      if (depth > EDGE_SLOW) {
        const t = Math.min(1, (depth - EDGE_SLOW) / (EDGE_DEEP - EDGE_SLOW));
        const slow = 1 - t * 0.85;
        vx *= slow;
        vz *= slow;
      }
      const zone = p.z > -2 ? 0 : p.z > -13 ? 1 : p.z > -19 ? 2 : 3;
      if (zone !== state.zone) state.configure({ zone });
    } else if (!selected && !power) {
      const leader = runtime.positions[puzzle.selected];
      const gap = p.z < -5.3 && p.z > -13.8;
      const crossing =
        (p.z > -6 && leader.z < -6) || (p.z < -13 && leader.z > -13) || gap;
      const targetX = crossing
        ? 0
        : Math.max(-5, Math.min(5, leader.x + [-1.3, 1.3, 0][id]));
      const targetZ = leader.z + (crossing ? 0.2 : 1.3);
      const dx = targetX - p.x,
        dz = targetZ - p.z;
      const length = Math.hypot(dx, dz);
      if (length > 1.1) {
        vx = (dx / length) * 3.7;
        vz = (dz / length) * 3.7;
      }
      if (
        !safeGround(
          p.x + vx * 0.18,
          p.z + vz * 0.18,
          puzzle.bridge || puzzle.powers[0],
        )
      ) {
        vx = 0;
        vz = 0;
      }
      if (Math.abs(p.z) < 1.1 && grounded && Math.abs(dz) > 1) vy = 5;
      const displacement = Math.hypot(
        p.x - previous.current.x,
        p.z - previous.current.z,
      );
      trapped.current =
        length > 3 && displacement < dt * 0.2 ? trapped.current + dt : 0;
      if (
        (length > 22 || trapped.current > 6) &&
        safeGround(targetX, targetZ, puzzle.bridge || puzzle.powers[0])
      ) {
        rigid.setTranslation(
          {
            x: targetX,
            y: Math.max(CHARACTER_SPAWN_Y, leader.y + 0.3),
            z: targetZ,
          },
          true,
        );
        trapped.current = 0;
      }
    }
    previous.current = { x: p.x, z: p.z };
    locomotion.current.speed = Math.hypot(vx, vz);
    locomotion.current.grounded = grounded;
    runtime.speeds[id] = locomotion.current.speed;
    rigid.setLinvel({ x: vx, y: vy, z: vz }, true);
    if (model.current && locomotion.current.speed > 0.1) {
      const target = Math.atan2(vx, vz);
      const angle =
        MathUtils.euclideanModulo(
          target - model.current.rotation.y + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      model.current.rotation.y += angle * (1 - Math.exp(-12 * dt));
    }
  });
  return (
    <RigidBody
      ref={body}
      position={[(id - 1) * 1.45, CHARACTER_SPAWN_Y, characterSpawn(id).z]}
      colliders={false}
      enabledRotations={[false, false, false]}
      friction={0}
      linearDamping={0.3}
      restitution={0}
      gravityScale={1.5}
      canSleep={false}
      ccd
    >
      <CapsuleCollider
        args={[CHARACTER_CAPSULE_HALF_HEIGHT, CHARACTER_CAPSULE_RADIUS]}
      />
      <group ref={model} rotation={[0, Math.PI, 0]}>
        <Monkey id={id} power={power} locomotion={locomotion} />
      </group>
      {(selected || power) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.53, 0]}>
          <ringGeometry args={[0.52, 0.57, 32]} />
          <meshBasicMaterial
            color={CHARACTERS[id].light}
            transparent
            opacity={power ? 0.9 : 0.6}
          />
        </mesh>
      )}
    </RigidBody>
  );
}
