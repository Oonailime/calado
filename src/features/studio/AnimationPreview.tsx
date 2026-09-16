"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Matrix4, Vector3, type Group } from "three";
import Monkey from "@/features/game/characters/Monkey";
import { runtime } from "@/features/game/state/store";
import {
  MONKEY_ANIMATION_PREVIEWS,
  type MonkeyLocomotion,
  type MonkeyMotion,
} from "@/features/game/characters/monkeyMotion";
import {
  TreeMesh,
  SegmentedVine,
  useForestAssets,
} from "@/features/game/world/Forest";
import {
  vineSwingAngle,
  vineSwingAngularVelocity,
  vineGripPosition,
  vineSwingPosition,
  type ArborealSite,
} from "@/features/game/world/forestLayout";
import { LOCOMOTION_TUNING } from "@/features/game/characters/locomotionConfig";
import styles from "./AnimationPreview.module.css";
import {
  sampleHandReach,
  suspensionBasis,
  handoffShoulderTurn,
  suspensionStride,
} from "@/features/game/characters/brachiationPose";

const RESET_PREVIEW_EVENT = "reset-animation-preview";
const PREVIEW_SITE: ArborealSite = {
  id: "animation-preview",
  tree: { x: 0.78, z: 0, scale: 0.48, rotationY: 0.4 },
  climb: { x: 0.23, z: 0, topY: 3.25 },
  vine: { x: 0, z: 0, attachY: 4.4, scale: 1, rotationY: Math.PI / 2 },
};
const PREVIEW_STRIDE = suspensionStride(0.4156, 0.2404);
const NEXT_PREVIEW_SITE: ArborealSite = {
  ...PREVIEW_SITE,
  id: "animation-preview-next",
  vine: { ...PREVIEW_SITE.vine, x: PREVIEW_STRIDE },
};

const THIRD_PREVIEW_SITE: ArborealSite = {
  ...NEXT_PREVIEW_SITE,
  id: "animation-preview-third",
  vine: { ...NEXT_PREVIEW_SITE.vine, x: PREVIEW_STRIDE * 2 },
};

function PreviewReady({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

function PreviewTelemetry() {
  const canvas = useThree((state) => state.gl.domElement);
  useFrame(() => {
    const d = runtime.movementDebug[2];
    canvas.setAttribute(
      "data-rig",
      JSON.stringify({
        leftShoulder: d.rigLeftShoulder,
        rightShoulder: d.rigRightShoulder,
        base: d.rigBase,
        leftHip: d.rigLeftHip,
        rightHip: d.rigRightHip,
        leftHand: d.leftHand,
        rightHand: d.rightHand,
        leftKnee: d.leftKnee,
        rightKnee: d.rightKnee,
        leftFoot: d.leftFoot,
        rightFoot: d.rightFoot,
      }),
    );
  });
  return null;
}

function PreviewCamera({ motion }: { motion: MonkeyMotion }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (motion === "biped-walk") {
      camera.position.set(0.65, 1.02, 2.15);
      camera.lookAt(0, 0.66, 0);
    } else if (motion === "fall") {
      camera.position.set(1.8, 1.85, 2.8);
      camera.lookAt(0, 1.5, 0);
    } else if (motion === "vine-jump") {
      camera.position.set(0.65, 2.7, 6.8);
      camera.lookAt(0.65, 2.05, 0);
    } else if (motion.startsWith("vine-")) {
      camera.position.set(0, 2.7, 6);
      camera.lookAt(0, 2.1, 0);
    } else {
      camera.position.set(0.45, 2.65, 6.1);
      camera.lookAt(0.45, 2.15, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, motion]);
  return null;
}

function Subject({ motion }: { motion: MonkeyMotion }) {
  const group = useRef<Group>(null);
  const startedAt = useRef<number | null>(null);
  const resetRequested = useRef(true);
  const frame = useRef({
    basis: { forward: new Vector3(), right: new Vector3(), up: new Vector3() },
    matrix: new Matrix4(),
    x: new Vector3(),
    origin: new Vector3(),
    left: new Vector3(),
    right: new Vector3(),
    prior: new Vector3(),
    velocity: new Vector3(),
    startRoot: new Vector3(),
    endRoot: new Vector3(),
    transferRoot: new Vector3(),
    leftOffset: new Vector3(),
    rightOffset: new Vector3(),
  });
  useEffect(() => {
    const reset = () => {
      resetRequested.current = true;
    };
    window.addEventListener(RESET_PREVIEW_EVENT, reset);
    return () => {
      window.removeEventListener(RESET_PREVIEW_EVENT, reset);
      if (runtime.activeVine?.siteId === PREVIEW_SITE.id)
        runtime.activeVine = null;
    };
  }, []);
  const locomotion = useRef<MonkeyLocomotion>({
    speed: motion === "biped-walk" ? 2 : 0,
    grounded: motion !== "vine-jump" && motion !== "fall",
    motion,
    motionTime: 0,
  });
  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    if (startedAt.current === null || resetRequested.current) {
      startedAt.current = clock.elapsedTime;
      resetRequested.current = false;
    }
    const time = clock.elapsedTime - startedAt.current;
    let cycle = time;
    group.current.position.set(0, 0.55, 0);
    group.current.rotation.set(0, Math.PI, 0);
    locomotion.current.speed = motion === "biped-walk" ? 2 : 0;
    locomotion.current.grounded = motion !== "vine-jump" && motion !== "fall";
    locomotion.current.motionElapsed = cycle;
    locomotion.current.vineAnchor = undefined;
    locomotion.current.nextVineAnchor = undefined;
    locomotion.current.swingAngle = undefined;
    locomotion.current.swingAngularVelocity = undefined;
    locomotion.current.hands = undefined;
    locomotion.current.bodyBasis = undefined;
    locomotion.current.brachiationProgress = undefined;
    locomotion.current.forward = { x: 1, y: 0, z: 0 };
    locomotion.current.motion = motion;

    if (motion === "biped-walk") {
      cycle = time % 4;
      group.current.rotation.y = Math.PI / 2;
    } else if (motion === "fall") {
      // Hold the falling body in frame for inspection; the same pose is used
      // during physical descent in the game.
      group.current.position.set(0, 1.4, 0);
      group.current.rotation.y = Math.PI / 2;
    } else if (motion === "tree-climb" || motion === "tree-descend") {
      cycle = time % 3.45;
      const raw = Math.min(1, cycle / 2.75);
      const progress = raw * raw * (3 - 2 * raw);
      group.current.position.set(
        0.23,
        0.55 + (motion === "tree-climb" ? progress : 1 - progress) * 2.7,
        0,
      );
      group.current.rotation.y = Math.PI / 2;
    } else if (motion === "vine-grab") {
      cycle = time % 6.2;
      const second = cycle >= 3.1;
      const stepTime = cycle - (second ? 3.1 : 0);
      const from = second ? "right" : "left";
      const oldSite = second ? NEXT_PREVIEW_SITE : PREVIEW_SITE;
      const newSite = second ? THIRD_PREVIEW_SITE : NEXT_PREVIEW_SITE;
      const anchor = vineGripPosition(oldSite, 0);
      const next = vineGripPosition(newSite, 0);
      const shoulderY = locomotion.current.shoulderOffsetLeft?.y ?? 0.49;
      const progress = MathUtils.clamp((stepTime - 0.45) / 0.65, 0, 1);
      const blend = progress * progress * (3 - 2 * progress);
      const turnProgress = MathUtils.clamp(
        (stepTime - 1.1) / LOCOMOTION_TUNING.handoffOverlap,
        0,
        1,
      );
      const settle = MathUtils.smoothstep(stepTime, 1.75, 2.5);
      const f = frame.current;
      suspensionBasis(
        f.basis,
        { x: 1, y: 0, z: 0 },
        Math.sin(progress * Math.PI) * 0.08,
        handoffShoulderTurn(from, turnProgress),
      );
      locomotion.current.bodyBasis = f.basis;
      locomotion.current.nextVineAnchor = next;
      const reachLength =
        (locomotion.current.armLengthLeft ?? 0.4156) *
        LOCOMOTION_TUNING.armReachRatio;
      const halfWidth = locomotion.current.shoulderOffsetLeft?.x ?? 0.1202;
      const shoulderZ = locomotion.current.shoulderOffsetLeft?.z ?? 0.002;
      f.leftOffset
        .copy(f.basis.up)
        .multiplyScalar(shoulderY)
        .addScaledVector(f.basis.right, -halfWidth)
        .addScaledVector(f.basis.forward, shoulderZ);
      f.rightOffset
        .copy(f.basis.up)
        .multiplyScalar(shoulderY)
        .addScaledVector(f.basis.right, halfWidth)
        .addScaledVector(f.basis.forward, shoulderZ);
      const oldOffset = second ? f.rightOffset : f.leftOffset;
      const newOffset = second ? f.leftOffset : f.rightOffset;
      f.startRoot.copy(anchor).sub(oldOffset);
      f.endRoot.copy(next).sub(newOffset);
      const separation = f.startRoot.distanceTo(f.endRoot);
      const drop = Math.sqrt(
        Math.max(0, reachLength * reachLength - (separation * separation) / 4),
      );
      f.transferRoot
        .copy(f.startRoot)
        .lerp(f.endRoot, 0.5)
        .addScaledVector(f.basis.up, -drop);
      f.startRoot.addScaledVector(f.basis.up, -reachLength);
      f.endRoot.addScaledVector(f.basis.up, -reachLength);
      group.current.position
        .copy(f.startRoot)
        .lerp(f.transferRoot, blend)
        .lerp(f.endRoot, settle);
      const reaching = second ? f.left : f.right;
      const supporting = second ? f.right : f.left;
      f.origin
        .copy(f.startRoot)
        .add(newOffset)
        .addScaledVector(f.basis.up, -reachLength * 0.85);
      sampleHandReach(reaching, f.origin, next, progress, f.basis.forward);
      f.origin
        .copy(group.current.position)
        .add(oldOffset)
        .addScaledVector(f.basis.up, -reachLength * 0.85);
      sampleHandReach(supporting, anchor, f.origin, settle, f.basis.forward);
      const supportHand = {
        grabbed: turnProgress < 1,
        reaching: false,
        anchor,
        point: supporting,
      };
      const reachHand = {
        grabbed: progress === 1,
        reaching: progress < 1,
        anchor: next,
        target: next,
        point: reaching,
        reachProgress: progress,
      };
      locomotion.current.hands = second
        ? { left: reachHand, right: supportHand }
        : { left: supportHand, right: reachHand };
      locomotion.current.motion = "vine-swing";
      locomotion.current.vineAnchor = turnProgress === 1 ? next : anchor;
      locomotion.current.brachiationProgress = progress;
      locomotion.current.swingAngle = 0;
      locomotion.current.swingAngularVelocity = Math.sin(progress * Math.PI);
      runtime.activeVine = {
        siteId: oldSite.id,
        monkeyId: 2,
        elapsed: 0,
        grip: anchor,
      };
    } else if (motion === "vine-swing") {
      const angle = vineSwingAngle(time);
      const position = vineSwingPosition(PREVIEW_SITE, time);
      const anchor = vineGripPosition(PREVIEW_SITE, time);
      const shoulder = locomotion.current.shoulderOffsetLeft;
      const arm = locomotion.current.armLengthLeft;
      const dx = position.x - anchor.x;
      const dy = position.y - anchor.y;
      const dz = position.z - anchor.z;
      const radius = Math.hypot(dx, dy, dz) || 1;
      // The preview contact is the same physical hand point used by IK.
      // Position the shoulders an arm's length below it, then the pelvis.
      group.current.position.set(
        anchor.x + (dx / radius) * (arm ?? 0.416) * 0.9,
        anchor.y + (dy / radius) * (arm ?? 0.416) * 0.9 - (shoulder?.y ?? 0.49),
        anchor.z + (dz / radius) * (arm ?? 0.416) * 0.9,
      );
      group.current.rotation.y = PREVIEW_SITE.vine.rotationY;
      group.current.rotation.x = 0;
      group.current.rotation.z = 0;
      locomotion.current.vineAnchor = anchor;
      const f = frame.current;
      suspensionBasis(
        f.basis,
        { x: 1, y: 0, z: 0 },
        Math.sin(time * 1.75) * 0.16,
      );
      locomotion.current.bodyBasis = f.basis;
      locomotion.current.swingAngle = angle;
      locomotion.current.swingAngularVelocity = vineSwingAngularVelocity(time);
      runtime.activeVine = {
        siteId: PREVIEW_SITE.id,
        monkeyId: 2,
        elapsed: time,
      };
    } else if (motion === "vine-jump") {
      cycle = time % 4;
      // Begin visibly attached to the vine, release once, then hold the
      // landing. Starting the loop in mid-flight made its first rendered
      // frame look like a teleport from outside the camera.
      const flight = Math.max(0, cycle - 0.65);
      const anchor = vineGripPosition(PREVIEW_SITE, 0);
      const shoulderY = locomotion.current.shoulderOffsetLeft?.y ?? 0.49;
      const startY = anchor.y - shoulderY - 0.36;
      group.current.position.set(
        Math.min(1.4, flight * 1.65),
        Math.max(0.55, startY + flight * 2.25 - flight * flight * 4.905),
        0,
      );
      const landed = flight > 0 && group.current.position.y <= 0.55;
      locomotion.current.motion = flight <= 0 ? "vine-swing" : "vine-jump";
      locomotion.current.vineAnchor = flight <= 0 ? anchor : undefined;
      locomotion.current.grounded = landed;
      const f = frame.current;
      suspensionBasis(
        f.basis,
        { x: 1, y: 0, z: 0 },
        -Math.min(0.22, flight * 0.3),
      );
      locomotion.current.bodyBasis = f.basis;
      cycle = flight;
    }
    if (
      motion !== "vine-swing" &&
      motion !== "vine-grab" &&
      runtime.activeVine?.siteId === PREVIEW_SITE.id
    )
      runtime.activeVine = null;
    locomotion.current.motionTime = cycle;
    locomotion.current.motionElapsed = cycle;
    const f = frame.current;
    if (locomotion.current.bodyBasis) {
      const b = locomotion.current.bodyBasis;
      f.matrix.makeBasis(
        f.x.copy(b.right).negate(),
        f.origin.copy(b.up),
        f.velocity.copy(b.forward),
      );
      group.current.quaternion.setFromRotationMatrix(f.matrix);
    }
    f.velocity
      .subVectors(group.current.position, f.prior)
      .divideScalar(Math.max(dt, 1e-4));
    locomotion.current.velocity = f.velocity;
    f.prior.copy(group.current.position);
  }, -2);
  return (
    <group ref={group}>
      <Monkey id={2} power={false} locomotion={locomotion} />
    </group>
  );
}

function PreviewScene({
  motion,
  onReady,
}: {
  motion: MonkeyMotion;
  onReady: () => void;
}) {
  const assets = useForestAssets();
  if (!assets.tree || !assets.vine) return null;
  const treeMotion = motion === "tree-climb" || motion === "tree-descend";
  const vineMotion = motion.startsWith("vine-");
  return (
    <>
      <hemisphereLight args={["#fff4cf", "#253525", 2.5]} />
      <PreviewCamera motion={motion} />
      <directionalLight
        castShadow
        intensity={3.4}
        position={[4, 7, 5]}
        shadow-mapSize={[1024, 1024]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5, 48]} />
        <meshStandardMaterial color="#667f47" roughness={1} />
      </mesh>
      {treeMotion && (
        <TreeMesh
          asset={assets.tree}
          position={[PREVIEW_SITE.tree.x, 0, PREVIEW_SITE.tree.z]}
          scale={PREVIEW_SITE.tree.scale}
          rotationY={PREVIEW_SITE.tree.rotationY}
        />
      )}
      {vineMotion && (
        <SegmentedVine
          site={PREVIEW_SITE}
          grip={
            motion === "vine-grab"
              ? vineGripPosition(PREVIEW_SITE, 0)
              : undefined
          }
        />
      )}
      {motion === "vine-grab" && (
        <>
          <SegmentedVine
            site={NEXT_PREVIEW_SITE}
            grip={vineGripPosition(NEXT_PREVIEW_SITE, 0)}
          />
          <SegmentedVine
            site={THIRD_PREVIEW_SITE}
            grip={vineGripPosition(THIRD_PREVIEW_SITE, 0)}
          />
        </>
      )}
      <Subject motion={motion} />
      <PreviewTelemetry />
      <PreviewReady onReady={onReady} />
    </>
  );
}

export default function AnimationPreview({ motion }: { motion: MonkeyMotion }) {
  const [ready, setReady] = useState(false);
  const reference = MONKEY_ANIMATION_PREVIEWS.find(
    (preview) => preview.motion === motion,
  );
  return (
    <main
      className={styles.root}
      data-preview-ready={ready}
      data-preview-motion={motion}
    >
      <Canvas
        shadows="soft"
        dpr={1}
        camera={{ position: [4.7, 3.1, 7.1], fov: 38, near: 0.1, far: 40 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#b8dbe1"]} />
        <fog attach="fog" args={["#b8dbe1", 10, 22]} />
        <Suspense fallback={null}>
          <PreviewScene motion={motion} onReady={() => setReady(true)} />
        </Suspense>
      </Canvas>
      <div className={styles.label}>
        {reference?.title ?? (motion === "fall" ? "Queda livre" : motion.replaceAll("-", " "))}
      </div>
      {reference && (
        <figure className={styles.reference} data-reference-motion={motion}>
          <video
            src={`/assets/previews/animations/${reference.file}`}
            autoPlay
            loop
            muted
            playsInline
          />
          <figcaption>{reference.title}</figcaption>
        </figure>
      )}
    </main>
  );
}
