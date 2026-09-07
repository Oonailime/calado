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
  BRIDGE,
  CHARACTER_CAPSULE_HALF_HEIGHT,
  CHARACTER_CAPSULE_RADIUS,
  CHARACTER_SPAWN_Y,
  characterSpawn,
} from "../world/layout";
import { safeGround, waterDepth } from "../world/terrain";
import { followerDelaySeconds, shouldFollowerJump } from "./followerNavigation";

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
  const followDelay = useRef(1);
  const followWait = useRef(1);
  const jumpCooldown = useRef(0);
  const selectedId = useGame((s) => s.puzzle.selected);
  const selected = selectedId === id;
  const power = useGame((s) => s.puzzle.powers[id]);
  const revision = useGame((s) => s.puzzle.revision);
  const { world, rapier } = useRapier();
  useEffect(() => {
    const delay = followerDelaySeconds(id, Math.random());
    followDelay.current = delay;
    followWait.current = delay;
  }, [id]);
  useEffect(() => {
    const state = useGame.getState().puzzle;
    const spawn = characterSpawn(id, state.bridge);
    body.current?.setTranslation(spawn, true);
    body.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    runtime.positions[id] = spawn;
    runtime.grounded[id] = true;
    followWait.current = followDelay.current;
    jumpCooldown.current = 0;
  }, [revision, id]);
  useEffect(() => {
    followWait.current = followDelay.current;
    trapped.current = 0;
  }, [selectedId]);
  useFrame((_, delta) => {
    if (!running || !body.current) return;
    const rigid = body.current;
    const p = rigid.translation();
    const state = useGame.getState();
    const puzzle = state.puzzle;
    const eating = runtime.eatingUntil[id] > performance.now();
    runtime.positions[id] = { ...p };
    const depth = waterDepth(p.x, p.z, puzzle.bridge);
    if (p.y < -7 || depth > EDGE_DEEP) {
      runtime.splashes.push({ x: p.x, y: -0.2, z: p.z });
      state.reset();
      return;
    }
    const dt = Math.min(delta, 0.04);
    jumpCooldown.current = Math.max(0, jumpCooldown.current - dt);
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
    if (selected && !power && !eating) {
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
      const zone = p.z > 0 ? 0 : p.z > -15 ? 1 : p.z > -21 ? 2 : 3;
      if (zone !== state.zone) state.configure({ zone });
    } else if (!selected && !power) {
      const leader = runtime.positions[puzzle.selected];
      const northEnd = BRIDGE.z + BRIDGE.length / 2;
      const southEnd = BRIDGE.z - BRIDGE.length / 2;
      const gap = p.z < northEnd + 0.6 && p.z > southEnd - 0.6;
      const crossing =
        (p.z > northEnd && leader.z < northEnd) ||
        (p.z < southEnd && leader.z > southEnd) ||
        gap;
      const targetX = crossing
        ? 0
        : Math.max(-5, Math.min(5, leader.x + [-1.3, 1.3, 0][id]));
      const targetZ = leader.z + (crossing ? 0.2 : 1.3);
      const dx = targetX - p.x,
        dz = targetZ - p.z;
      const length = Math.hypot(dx, dz);
      const wantsToFollow = length > 1.1;
      if (!wantsToFollow) followWait.current = followDelay.current;
      else if (followWait.current > 0)
        followWait.current = Math.max(0, followWait.current - dt);
      if (wantsToFollow && followWait.current <= 0) {
        vx = (dx / length) * 3.7;
        vz = (dz / length) * 3.7;
      }
      if (!safeGround(p.x + vx * 0.18, p.z + vz * 0.18, puzzle.bridge)) {
        vx = 0;
        vz = 0;
      }
      const followerSpeed = Math.hypot(vx, vz);
      if (grounded && followerSpeed > 0.1) {
        const direction = { x: vx / followerSpeed, z: vz / followerSpeed };
        const fixedOnly = rapier.QueryFilterFlags.ONLY_FIXED;
        const lowerBlocked = !!world.castRay(
          new rapier.Ray(
            { x: p.x, y: p.y - 0.32, z: p.z },
            { x: direction.x, y: 0, z: direction.z },
          ),
          0.78,
          true,
          fixedOnly,
          undefined,
          undefined,
          rigid,
        );
        const upperBlocked = !!world.castRay(
          new rapier.Ray(
            { x: p.x, y: p.y + 0.38, z: p.z },
            { x: direction.x, y: 0, z: direction.z },
          ),
          0.82,
          true,
          fixedOnly,
          undefined,
          undefined,
          rigid,
        );
        const landingSafe = safeGround(
          p.x + direction.x * 1.15,
          p.z + direction.z * 1.15,
          puzzle.bridge,
        );
        const pathJump =
          Math.abs(p.z) < 1.1 &&
          Math.abs(dz) > 1 &&
          landingSafe &&
          jumpCooldown.current <= 0;
        if (
          pathJump ||
          shouldFollowerJump({
            grounded,
            moving: true,
            lowerBlocked,
            upperBlocked,
            landingSafe,
            cooldown: jumpCooldown.current,
          })
        ) {
          vy = 5.7;
          jumpCooldown.current = 0.7;
        }
      }
      const displacement = Math.hypot(
        p.x - previous.current.x,
        p.z - previous.current.z,
      );
      trapped.current =
        followWait.current <= 0 && length > 3 && displacement < dt * 0.2
          ? trapped.current + dt
          : 0;
      if (
        (length > 22 || trapped.current > 6) &&
        safeGround(targetX, targetZ, puzzle.bridge)
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
