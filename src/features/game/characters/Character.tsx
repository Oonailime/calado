import { phaseTwoTouchesLava, phaseTwoFollowerJump, phaseTwoLavaAt } from "../world/phaseTwoLava";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Group, Matrix4, Quaternion, Vector3 } from "three";
import { runtime, useGame } from "../state/store";
import type { CharacterId, Vec3 } from "../types";
import Monkey from "./Monkey";
import MovementDebug from "./MovementDebug";
import SelectionVine from "./SelectionVine";
import {
  handoffShoulderTurn,
  pendulumBodyBasis,
  sampleHandReach,
  suspensionBasis,
} from "./brachiationPose";
import {
  CHARACTER_CAPSULE_HALF_HEIGHT,
  CHARACTER_CAPSULE_RADIUS,
  CHARACTER_SPAWN_Y,
  characterSpawn,
} from "../world/layout";
import { CANOPY_BRIDGE_CURVE, CANOPY_BRIDGE_SITE } from "../world/canopyCooperationLayout";
import { phaseFourTouchesGround } from "../world/phaseFourTerrain";
import { safeGround, waterDepth } from "../world/terrain";
import { phaseTwoCharacterSpawn, phaseTwoFollowTarget, PHASE_TWO_START_YAW, phaseTwoOutsideMap, PHASE_TWO_STOOLS, phaseTwoGroundHeight } from "../world/phaseTwoLayout";
import { followerDelaySeconds, islandFollowerTarget, shouldFollowerJump } from "./followerNavigation";
import type {
  HandLocomotion,
  LocomotionState,
  MonkeyLocomotion,
  MonkeyMotion,
} from "./monkeyMotion";
import {
  ARBOREAL_SITES,
  TREE_CLIMB_SECONDS,
  TREE_DESCEND_SECONDS,
  VINE_GRIP_OFFSET,
  nearestArborealInteraction,
  vineLength,
  type ArborealSite,
} from "../world/forestLayout";
import {
  PHASE_FOUR_SITES,
  PHASE_FOUR_FALL_Y,
  PHASE_FOUR_LADDER_SITE,
  phaseFourCharacterSpawn,
  phaseFourAdjacentSite,
} from "../world/phaseFourLayout";
import {
  closestSwingingVineGrip,
  createSwingingVine,
  releaseRearVineTie,
} from "../world/swingingVine";
import {
  driveSwingSurface,
  surfaceTravelDirection,
  SURFACE_STANCE,
  SURFACE_STRIDE,
  type SwingSurface,
} from "./swingSurface";
import {
  ballisticPosition,
  buildLocalBasis,
  constrainedPreStepVelocity,
  copyVector,
  decomposeVelocity,
  normalizeVector,
  projectTangential,
  releaseVelocity,
  scoreAnchor,
  type DistanceConstraint,
  type LocalBasis,
  type MutableVec3,
} from "./brachiationPhysics";
import {
  LOCOMOTION_TUNING,
  PHYSICS_FIXED_DT,
  WORLD_GRAVITY,
} from "./locomotionConfig";

import { createVineWalk, stepVineWalk, vineWalkInput, type VineWalk } from "./vineWalking";

const EDGE_SLOW = 0.6;
const EDGE_DEEP = 3.2;
type HandSide = "left" | "right";

type HandAttachment = {
  side: HandSide;
  grabbed: boolean;
  reaching: boolean;
  site: ArborealSite | null;
  support: MutableVec3;
  contact: MutableVec3;
  target: MutableVec3;
  point: MutableVec3;
  reachOrigin: MutableVec3;
  pointReady: boolean;
  constraint: DistanceConstraint;
  armLength: number;
  maxLength: number;
  constraintError: number;
  // The constraint's true, calibrated length. Right after a grab this can
  // differ from the actual distance at that instant; constraint.length eases
  // from attachStartLength (the grab-moment distance) toward restLength so
  // the PBD solver never has to yank the body into place on the very first
  // tick after attaching.
  restLength: number;
  attachStartLength: number;
  attachElapsed: number;
};

type ReachTarget = {
  site: ArborealSite;
  hand: HandSide;
  elapsed: number;
  timeout: number;
  duration: number;
  score: number;
  handoffFrom: HandSide | null;
};

type TreeActivity = {
  vineWalk?: VineWalk;
  kind: "tree-climb" | "tree-hold" | "tree-descend";
  site: ArborealSite;
  elapsed: number;
};

type Controller = {
  state: LocomotionState;
  elapsed: number;
  motionTime: number;
  hands: { left: HandAttachment; right: HandAttachment };
  constraints: [DistanceConstraint, DistanceConstraint];
  preferredHand: HandSide;
  currentSite: ArborealSite | null;
  reach: ReachTarget | null;
  tree: TreeActivity | null;
  handoffElapsed: number;
  handoffRelease: HandSide | null;
  handoffCount: number;
  closestReachDistance: number;
  fromSwing: boolean;
  bodyBasis: LocalBasis;
  bodyLean: number;
  bodyLeanRate: number;
  releaseTime: number;
  lastReleasedSiteId: string | undefined;
  shoulderTurn: number;
  lookTarget: MutableVec3;
  // Which way along the brachiation course auto-advance should reach next.
  // Only the selected character's own W/S input ever changes this.
  travelDirection: 1 | -1;
  // Time spent grabbed with nothing in progress (no reach, no handoff). Used
  // to trigger the idle vine-hang fidget after a stretch of staying put.
  idleElapsed: number;
  // -1 while actively climbing up a held rope (shift), 1 while paying it out
  // (ctrl), 0 otherwise. Read by the leg-pump pose so climbing reads as
  // active effort even while the pendulum itself is nearly still.
  climbRate: number;
};

function vector(x = 0, y = 0, z = 0): MutableVec3 {
  return { x, y, z };
}

// Vine-walk entry/exit used to hand the body's facing straight from
// walk.basis (or straight back to undefined/grounded on arrival) with no
// transition at all — a same-frame snap right at the two moments the vine
// starts and ends, reading as the body flipping the wrong way there. This
// eases the *displayed* forward between the two over VINE_FACING_BLEND_SECONDS
// and rebuilds right/up from it fresh each frame (independently lerping all
// three axes would drift them out of orthogonality).
const VINE_FACING_BLEND_SECONDS = 0.35;
const facingScratch = {
  to: new Vector3(),
  blended: new Vector3(),
  right: new Vector3(),
  up: new Vector3(),
};
function blendFacingBasis(
  out: LocalBasis,
  from: Readonly<Vec3>,
  to: Readonly<Vec3>,
  t: number,
) {
  const blended = facingScratch.blended.set(from.x, from.y, from.z);
  blended.lerp(facingScratch.to.set(to.x, to.y, to.z), t);
  if (blended.lengthSq() < 1e-8) blended.copy(facingScratch.to);
  blended.normalize();
  const right = facingScratch.right.set(-blended.z, 0, blended.x);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  else right.normalize();
  const up = facingScratch.up.crossVectors(right, blended).normalize();
  out.forward.x = blended.x;
  out.forward.y = blended.y;
  out.forward.z = blended.z;
  out.right.x = right.x;
  out.right.y = right.y;
  out.right.z = right.z;
  out.up.x = up.x;
  out.up.y = up.y;
  out.up.z = up.z;
}

function createHand(side: HandSide): HandAttachment {
  const support = vector();
  return {
    side,
    grabbed: false,
    reaching: false,
    site: null,
    support,
    contact: vector(),
    target: vector(),
    point: vector(),
    reachOrigin: vector(),
    pointReady: false,
    constraint: { active: false, anchor: vector(), length: 0 },
    armLength: VINE_GRIP_OFFSET,
    maxLength: VINE_GRIP_OFFSET,
    constraintError: 0,
    restLength: 0,
    attachStartLength: 0,
    attachElapsed: 0,
  };
}

function createController(): Controller {
  const left = createHand("left");
  const right = createHand("right");
  return {
    state: "GROUND",
    elapsed: 0,
    motionTime: 0,
    hands: { left, right },
    constraints: [left.constraint, right.constraint],
    preferredHand: "left",
    currentSite: null,
    reach: null,
    tree: null,
    handoffElapsed: 0,
    handoffRelease: null,
    handoffCount: 0,
    closestReachDistance: Number.POSITIVE_INFINITY,
    fromSwing: false,
    bodyBasis: {
      forward: vector(1, 0, 0),
      right: vector(0, 0, -1),
      up: vector(0, 1, 0),
    },
    bodyLean: 0,
    bodyLeanRate: 0,
    releaseTime: 0,
    lastReleasedSiteId: undefined,
    shoulderTurn: 0,
    lookTarget: vector(),
    travelDirection: 1,
    idleElapsed: 0,
    climbRate: 0,
  };
}

function setState(controller: Controller, state: LocomotionState) {
  if (controller.state === state) return;
  controller.state = state;
  controller.elapsed = 0;
}

function resetHand(hand: HandAttachment) {
  hand.grabbed = false;
  hand.reaching = false;
  hand.site = null;
  hand.constraint.active = false;
  hand.constraint.length = 0;
  hand.constraintError = 0;
  hand.attachElapsed = 0;
}

function clearTraversal(controller: Controller) {
  resetHand(controller.hands.left);
  resetHand(controller.hands.right);
  controller.reach = null;
  controller.tree = null;
  controller.currentSite = null;
  controller.handoffElapsed = 0;
  controller.handoffRelease = null;
  controller.handoffCount = 0;
  controller.closestReachDistance = Number.POSITIVE_INFINITY;
  controller.fromSwing = false;
  controller.hands.left.pointReady = false;
  controller.hands.right.pointReady = false;
  controller.bodyLean = 0;
  controller.bodyLeanRate = 0;
  controller.shoulderTurn = 0;
  controller.motionTime = 0;
  controller.travelDirection = 1;
  controller.idleElapsed = 0;
  controller.climbRate = 0;
  setState(controller, "GROUND");
}

function easeInOut(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}

function sitesForMap(map: ReturnType<typeof useGame.getState>["map"]) {
  if (map === "phase2") return [];
  if (map === "phase3") return useGame.getState().puzzle.canopyBridgeBuilt ? [...PHASE_FOUR_SITES, CANOPY_BRIDGE_SITE] : PHASE_FOUR_SITES;
  return ARBOREAL_SITES;
}

function nextBrachiationSite(site: ArborealSite) {
  return phaseFourAdjacentSite(site, "next");
}

function previousBrachiationSite(site: ArborealSite) {
  return phaseFourAdjacentSite(site, "previous");
}

function armLength(locomotion: MonkeyLocomotion, side: HandSide) {
  return (
    (side === "left" ? locomotion.armLengthLeft : locomotion.armLengthRight) ??
    VINE_GRIP_OFFSET
  );
}

function rootReach(locomotion: MonkeyLocomotion, side: HandSide) {
  return (
    (side === "left" ? locomotion.rootReachLeft : locomotion.rootReachRight) ??
    armLength(locomotion, side)
  );
}

function shoulderOffset(locomotion: MonkeyLocomotion, side: HandSide) {
  return side === "left"
    ? locomotion.shoulderOffsetLeft
    : locomotion.shoulderOffsetRight;
}

function physicalShoulder(
  out: MutableVec3,
  position: Readonly<Vec3>,
  basis: LocalBasis,
  offset: Readonly<Vec3>,
) {
  // This measured rig uses local +X for the character's left, +Y for up and
  // +Z for forward. `basis.right` is physical right, hence the -X mapping.
  out.x =
    position.x -
    basis.right.x * offset.x +
    basis.up.x * offset.y +
    basis.forward.x * offset.z;
  out.y =
    position.y -
    basis.right.y * offset.x +
    basis.up.y * offset.y +
    basis.forward.y * offset.z;
  out.z =
    position.z -
    basis.right.z * offset.x +
    basis.up.z * offset.y +
    basis.forward.z * offset.z;
  return out;
}

function siteHandTarget(
  site: ArborealSite,
  out: MutableVec3,
  position?: Readonly<Vec3>,
) {
  let swinging = !site.vine.directGrip && runtime.swingingVines.get(site.id);
  if (!swinging && site.vine.twoPoint) {
    swinging = createSwingingVine(site);
    runtime.swingingVines.set(site.id, swinging);
  }
  if (swinging) {
    if (position) {
      closestSwingingVineGrip(swinging, position, out);
      return out;
    }
    return copyVector(out, swinging.grip);
  }
  if (site.vine.twoPoint) return copyVector(out, site.vine.twoPoint.grip);
  out.x = site.vine.x;
  out.z = site.vine.z;
  out.y = site.vine.directGrip
    ? site.vine.attachY
    : site.vine.attachY - Math.max(0.2, vineLength(site) - VINE_GRIP_OFFSET);
  return out;
}

function updateHandContact(
  hand: HandAttachment,
  position: Readonly<Vec3>,
  locomotion: MonkeyLocomotion,
  dt: number,
) {
  if (!hand.grabbed || !hand.site) return;
  const site = hand.site;
  hand.constraint.maxDistanceOnly =
    !site.vine.directGrip || !!locomotion.swingSurface;
  const rope = runtime.swingingVines.get(site.id);
  hand.support.x = rope?.constraints[0].anchor.x ?? site.vine.x;
  hand.support.y = rope?.constraints[0].anchor.y ?? site.vine.attachY;
  hand.support.z = rope?.constraints[0].anchor.z ?? site.vine.z;
  const anchor = hand.constraint.anchor as MutableVec3;
  copyVector(anchor, hand.support);
  const offset = shoulderOffset(locomotion, hand.side);
  if (
    site.vine.directGrip &&
    offset &&
    locomotion.forward &&
    locomotion.right &&
    locomotion.up
  ) {
    // |root + shoulderOffset - grip| = armLength. Moving the constraint's
    // anchor by -shoulderOffset keeps the Rapier mass coupled to that arm.
    physicalShoulder(
      anchor,
      vector(),
      locomotion.bodyBasis ?? {
        forward: locomotion.forward,
        right: locomotion.right,
        up: locomotion.up,
      },
      offset,
    );
    anchor.x = hand.support.x - anchor.x;
    anchor.y = hand.support.y - anchor.y;
    anchor.z = hand.support.z - anchor.z;
  }
  if (hand.attachElapsed < LOCOMOTION_TUNING.attachSmoothing) {
    hand.attachElapsed = Math.min(
      LOCOMOTION_TUNING.attachSmoothing,
      hand.attachElapsed + dt,
    );
    const t = hand.attachElapsed / LOCOMOTION_TUNING.attachSmoothing;
    hand.constraint.length =
      hand.attachStartLength +
      (hand.restLength - hand.attachStartLength) * easeInOut(t);
  } else if (site.vine.twoPoint && rope) {
    // Shift/ctrl (see applyVineClimbControl) can change the rope's own
    // length on the fly to climb up/down it - restLength must keep tracking
    // that, not just the value calibrated once at the original grab.
    const climbOffset = shoulderOffset(locomotion, hand.side) ?? {
      x: 0,
      y: 0.49,
      z: 0,
    };
    const climbReach = hand.armLength * LOCOMOTION_TUNING.armReachRatio;
    const rootToGrip =
      climbOffset.y +
      Math.sqrt(
        Math.max(
          0.01,
          climbReach ** 2 - climbOffset.x ** 2 - climbOffset.z ** 2,
        ),
      );
    hand.restLength = rope.constraints[0].length + rootToGrip;
    hand.constraint.length = hand.restLength;
  }
  const dx = position.x - anchor.x;
  const dy = position.y - anchor.y;
  const dz = position.z - anchor.z;
  const distance = Math.max(1e-6, Math.hypot(dx, dy, dz));
  hand.constraintError = distance - hand.constraint.length;
  if (site.vine.directGrip) copyVector(hand.contact, hand.support);
  else {
    const ropeLength =
      rope?.constraints[0].length ??
      Math.max(0.2, vineLength(site) - VINE_GRIP_OFFSET);
    const span = hand.constraint.maxDistanceOnly
      ? Math.max(
          0.2,
          Math.min(ropeLength, distance - (hand.restLength - ropeLength)),
        )
      : ropeLength;
    hand.contact.x = hand.support.x + (dx / distance) * span;
    hand.contact.y = hand.support.y + (dy / distance) * span;
    hand.contact.z = hand.support.z + (dz / distance) * span;
  }
  copyVector(hand.point, hand.contact);
  hand.pointReady = true;
}

const VINE_CLIMB_RATE = 1.6;
const VINE_CLIMB_MIN_LENGTH = 1.1;
const VINE_CLIMB_TAIL_CLEARANCE = 0.3;

/**
 * Shift/ctrl feed the held rope through the grip like climbing a real rope:
 * shift shortens it (hauling the body up, closer to the fixed tie), ctrl
 * lengthens it (gravity pays the body back out, bounded by the far end).
 * The constraint is maxDistanceOnly (see updateHandContact), so tightening
 * it actively pulls the body in while loosening it just raises the ceiling
 * gravity is already falling toward - no separate lift/drop force needed.
 */
function applyVineClimbControl(controller: Controller, dt: number) {
  const grip = grippingHand(controller);
  const site = grip ? controller.hands[grip].site : null;
  const rope = site?.vine.twoPoint
    ? runtime.swingingVines.get(site.id)
    : undefined;
  if (!rope) {
    controller.climbRate = 0;
    return;
  }
  const up = runtime.keys.has("ShiftLeft") || runtime.keys.has("ShiftRight");
  const down =
    runtime.keys.has("ControlLeft") || runtime.keys.has("ControlRight");
  if (up === down) {
    controller.climbRate = 0;
    return;
  }
  controller.climbRate = up ? -1 : 1;
  const constraint = rope.constraints[0];
  const maxLength = Math.max(
    VINE_CLIMB_MIN_LENGTH,
    rope.totalLength - VINE_CLIMB_TAIL_CLEARANCE,
  );
  constraint.length = Math.max(
    VINE_CLIMB_MIN_LENGTH,
    Math.min(maxLength, constraint.length + (up ? -1 : 1) * VINE_CLIMB_RATE * dt),
  );
  rope.tailSegmentLength =
    Math.max(0, rope.totalLength - constraint.length) / 12;
}

// solveSuspensionLimit keeps the shoulder at least minDrop below *this*
// hold's own anchor for its whole duration, which caps how high the body can
// rise while reaching for the next one. On a steep climb the following hold
// can sit above that ceiling no matter how long the reach waits - shrinking
// minDrop for that hold raises the ceiling just enough to keep the next
// anchor geometrically reachable, without giving up "stay below the vine"
// on the flat/level/descending holds that don't need it.
function climbAwareMinDrop(controller: Controller, site: ArborealSite) {
  const defaultMinDrop = LOCOMOTION_TUNING.minShoulderDrop;
  const followingSite =
    controller.travelDirection < 0
      ? previousBrachiationSite(site)
      : nextBrachiationSite(site);
  if (!followingSite) return defaultMinDrop;
  const rise = followingSite.vine.attachY - site.vine.attachY;
  if (rise <= 0) return defaultMinDrop;
  const climbSlack = 0.3;
  return Math.max(0.05, Math.min(defaultMinDrop, climbSlack - rise));
}

function attachHand(
  controller: Controller,
  side: HandSide,
  site: ArborealSite,
  position: Readonly<Vec3>,
  locomotion: MonkeyLocomotion,
) {
  const continuingSwing = grabbedCount(controller) > 0;
  const hand = controller.hands[side];
  let rope = runtime.swingingVines.get(site.id);
  if (site.vine.twoPoint) {
    if (!rope) {
      rope = createSwingingVine(site);
      runtime.swingingVines.set(site.id, rope);
    }
    const velocity = locomotion.velocity;
    releaseRearVineTie(
      rope,
      site,
      velocity && Math.hypot(velocity.x, velocity.z) > 0.5
        ? velocity
        : (locomotion.forward ?? {
            x: Math.sin(site.vine.rotationY),
            y: 0,
            z: Math.cos(site.vine.rotationY),
          }),
      hand.target,
    );
  }
  hand.site = site;
  hand.grabbed = true;
  hand.reaching = false;
  hand.armLength =
    armLength(locomotion, side) * LOCOMOTION_TUNING.maxArmStretch;
  hand.maxLength =
    rootReach(locomotion, side) * LOCOMOTION_TUNING.maxArmStretch;
  hand.support.x = rope?.constraints[0].anchor.x ?? site.vine.x;
  hand.support.y = rope?.constraints[0].anchor.y ?? site.vine.attachY;
  hand.support.z = rope?.constraints[0].anchor.z ?? site.vine.z;
  // Grabbing a fixed-length vine (directGrip) mid-swing rarely lands the
  // body at exactly armLength*armReachRatio away. Starting the constraint at
  // the real grab-moment distance and easing it toward the calibrated
  // restLength (see updateHandContact) keeps the PBD solver from yanking the
  // body straight on the first tick after the grab.
  const initialLength = Math.max(
    0.08,
    Math.hypot(
      position.x - hand.support.x,
      position.y +
        (site.vine.directGrip
          ? (shoulderOffset(locomotion, side)?.y ?? 0.49)
          : 0) -
        hand.support.y,
      position.z - hand.support.z,
    ),
  );
  const offset = shoulderOffset(locomotion, side) ?? { x: 0, y: 0.49, z: 0 };
  const reach = hand.armLength * LOCOMOTION_TUNING.armReachRatio;
  const rootToGrip =
    offset.y +
    Math.sqrt(Math.max(0.01, reach ** 2 - offset.x ** 2 - offset.z ** 2));
  hand.restLength = site.vine.directGrip
    ? hand.armLength * LOCOMOTION_TUNING.armReachRatio
    : (rope?.constraints[0].length ??
        Math.max(0.2, vineLength(site) - VINE_GRIP_OFFSET)) + rootToGrip;
  hand.attachStartLength = initialLength;
  hand.attachElapsed = 0;
  hand.constraint.length = initialLength;
  hand.constraint.minDrop = site.vine.directGrip
    ? climbAwareMinDrop(controller, site)
    : undefined;
  hand.constraint.active = true;
  updateHandContact(hand, position, locomotion, 0);
  controller.currentSite = site;
  controller.reach = null;
  controller.fromSwing = true;
  if (!continuingSwing) {
    controller.motionTime = 0;
    controller.shoulderTurn = handoffShoulderTurn(side, 0);
  }
  setState(controller, "SWING_ONE_HAND");
}

function detachHand(hand: HandAttachment) {
  resetHand(hand);
}

function grabbedCount(controller: Controller) {
  return (
    Number(controller.hands.left.grabbed) +
    Number(controller.hands.right.grabbed)
  );
}

function shouldDisableSwingCollision(
  controller: Controller,
  inPhaseFour: boolean,
) {
  return (
    inPhaseFour &&
    (controller.hands.left.site?.vine.disableCharacterCollision === true ||
      controller.hands.right.site?.vine.disableCharacterCollision === true)
  );
}

function grippingHand(controller: Controller): HandSide | undefined {
  if (controller.hands.left.grabbed && !controller.hands.right.grabbed)
    return "left";
  if (controller.hands.right.grabbed && !controller.hands.left.grabbed)
    return "right";
  if (controller.handoffRelease) return otherHand(controller.handoffRelease);
  return controller.currentSite?.vine.brachiation?.gripHand;
}

function otherHand(side: HandSide): HandSide {
  return side === "left" ? "right" : "left";
}

function beginReach(
  controller: Controller,
  hand: HandSide,
  site: ArborealSite,
  score: number,
  handoffFrom: HandSide | null,
  wrist?: Readonly<Vec3>,
  inFlight = false,
) {
  const brachiationDuration = site.vine.brachiation?.duration ?? 0;
  const phaseFour = site.id.startsWith("phase4-");
  controller.reach = {
    site,
    hand,
    elapsed: 0,
    duration: inFlight
      ? 0.12
      : phaseFour
        ? 0.32
        : Math.max(0.36, Math.min(0.6, brachiationDuration * 0.65 || 0.45)),
    timeout: phaseFour
      ? 1.6
      : Math.max(LOCOMOTION_TUNING.reachTimeout, brachiationDuration * 1.45),
    score,
    handoffFrom,
  };
  controller.idleElapsed = 0;
  const reachingHand = controller.hands[hand];
  // The rendered wrist is only the visual recovery origin. Capture and
  // suspension constraints still use the calibrated physical shoulders.
  copyVector(reachingHand.reachOrigin, wrist ?? reachingHand.point);
  copyVector(reachingHand.point, reachingHand.reachOrigin);
  reachingHand.pointReady = true;
  reachingHand.reaching = true;
  siteHandTarget(site, reachingHand.target);
  setState(controller, handoffFrom ? "HANDOFF" : "REACH");
}

function cancelReach(controller: Controller) {
  if (controller.reach)
    controller.hands[controller.reach.hand].reaching = false;
  controller.reach = null;
  setState(
    controller,
    grabbedCount(controller) > 0 ? "SWING_ONE_HAND" : "FLIGHT",
  );
}

function bestAnchor(
  position: Readonly<Vec3>,
  velocity: Readonly<Vec3>,
  desiredDirection: Readonly<Vec3>,
  basis: LocalBasis,
  sites: readonly ArborealSite[],
  hand: HandSide,
  maxReach: number,
  excludedSiteId: string | undefined,
  candidateScratch: MutableVec3,
  debug: (typeof runtime.movementDebug)[number],
  lineOfSight: (target: Readonly<Vec3>) => boolean,
  groundAssistance = false,
) {
  let bestSite: ArborealSite | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  debug.candidateCount = 0;
  for (const site of sites) {
    if (site.vine.grabbable === false || site.id === excludedSiteId) continue;
    siteHandTarget(site, candidateScratch, position);
    if (!lineOfSight(candidateScratch)) continue;
    const assisted =
      groundAssistance &&
      site.id.startsWith("phase4-") &&
      excludedSiteId === undefined;
    if (
      assisted &&
      (Math.hypot(
        candidateScratch.x - position.x,
        candidateScratch.z - position.z,
      ) > 1.7 ||
        candidateScratch.y < position.y + 0.1 ||
        candidateScratch.y > position.y + 1.8)
    )
      continue;
    const score = scoreAnchor({
      position,
      velocity,
      gravity: WORLD_GRAVITY,
      desiredDirection,
      right: basis.right,
      anchor: candidateScratch,
      predictionTime: LOCOMOTION_TUNING.reachPredictionTime,
      maxReach:
        maxReach +
        (site.vine.grabRadius ?? LOCOMOTION_TUNING.grabRadius) +
        (assisted ? 1 : 0),
      hand,
    });
    if (
      Number.isFinite(score) &&
      debug.candidateCount < debug.candidates.length
    ) {
      copyVector(debug.candidates[debug.candidateCount], candidateScratch);
      debug.candidateCount += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSite = site;
    }
  }
  return bestSite ? { site: bestSite, score: bestScore } : undefined;
}

function canCapture(
  position: Readonly<Vec3>,
  target: Readonly<Vec3>,
  maxLength: number,
  shoulder?: Readonly<Vec3>,
  maxArmLength = 0,
  // The "target must sit above the shoulder" gate exists for the ground/
  // climb reach-up-and-grab case, where the vine really is above you. Once
  // already suspended mid-swing, solveSuspensionLimit deliberately keeps the
  // shoulder close to the *current* vine's own height (to stay below it
  // instead of circling around it) - so the next hold along a level or
  // gently-sloped course is often barely above, level with, or even a touch
  // below that shoulder. Applying the same gate there made every automatic
  // handoff fail this check forever (reach timing out and immediately
  // restarting, frozen in the HANDOFF state) even when well within arm's
  // reach. Skip it for handoffs and rely on the spatial distance check.
  requireUpwardReach = true,
) {
  const rootReach = Math.hypot(
    position.x - target.x,
    position.y - target.y,
    position.z - target.z,
  );
  if (rootReach > maxLength + 0.005) return false;
  if (!shoulder || maxArmLength <= 0) return true;
  if (
    requireUpwardReach &&
    target.y - shoulder.y < LOCOMOTION_TUNING.minShoulderDrop
  )
    return false;
  return (
    Math.hypot(
      shoulder.x - target.x,
      shoulder.y - target.y,
      shoulder.z - target.z,
    ) <=
    maxArmLength * LOCOMOTION_TUNING.maxArmStretch + 0.005
  );
}

function locomotionMotion(controller: Controller): MonkeyMotion | undefined {
  const { state } = controller;
  if (state === "RUN") return "biped-walk";
  if (state === "CLIMB") {
    // The fixed rope has its own quadrupedal walking pose.
    if (controller.tree?.vineWalk)
      return "vine-walk";
    return controller.tree?.kind === "tree-descend"
      ? "tree-descend"
      : "tree-climb";
  }
  if (state === "REACH") return "vine-grab";
  if (
    state === "SWING_ONE_HAND" ||
    state === "SWING_TWO_HANDS" ||
    state === "HANDOFF"
  )
    return "vine-swing";
  if (state === "RELEASE" || (state === "FLIGHT" && controller.fromSwing))
    return "vine-jump";
  return undefined;
}

function updateLocomotion(
  controller: Controller,
  locomotion: MonkeyLocomotion,
  position: Readonly<Vec3>,
  velocity: Readonly<Vec3>,
  grounded: boolean,
) {
  locomotion.vineWalk = controller.tree?.vineWalk;
  locomotion.state = controller.state;
  locomotion.grounded = grounded && grabbedCount(controller) === 0;
  locomotion.speed =
    locomotion.classicGroundMotion && !controller.fromSwing
      ? Math.hypot(velocity.x, velocity.z)
      : Math.hypot(velocity.x, velocity.y, velocity.z);
  locomotion.idleElapsed = controller.idleElapsed;
  locomotion.climbRate = controller.climbRate;
  locomotion.motion = locomotionMotion(controller);
  locomotion.motionElapsed = controller.elapsed;
  locomotion.motionTime =
    locomotion.motion === "vine-swing"
      ? controller.motionTime
      : locomotion.motion === "vine-jump"
        ? controller.releaseTime
        : (controller.tree?.elapsed ?? controller.elapsed);
  locomotion.velocity ??= vector();
  copyVector(locomotion.velocity, velocity);
  locomotion.hands ??= {
    left: { grabbed: false, reaching: false },
    right: { grabbed: false, reaching: false },
  };
  for (const side of ["left", "right"] as const) {
    const source = controller.hands[side];
    const target = locomotion.hands[side] as HandLocomotion;
    target.grabbed = source.grabbed;
    target.reaching = source.reaching;
    target.anchor = source.grabbed ? source.contact : undefined;
    target.target = source.reaching ? source.target : undefined;
    target.point = source.pointReady ? source.point : undefined;
    target.reachProgress =
      source.reaching && controller.reach
        ? Math.min(1, controller.reach.elapsed / controller.reach.duration)
        : undefined;
    target.constraintLength = source.grabbed
      ? source.constraint.length
      : undefined;
    target.maxLength = source.armLength;
    target.constraintError = source.constraintError;
  }
  const grip = grippingHand(controller);
  const gripAttachment = grip ? controller.hands[grip] : undefined;
  locomotion.gripHand = grip;
  locomotion.vineAnchor = gripAttachment?.grabbed
    ? gripAttachment.contact
    : undefined;
  locomotion.previousVineAnchor = controller.reach?.handoffFrom
    ? controller.hands[controller.reach.handoffFrom].contact
    : undefined;
  const nextSite =
    controller.currentSite &&
    (controller.travelDirection < 0
      ? previousBrachiationSite(controller.currentSite)
      : nextBrachiationSite(controller.currentSite));
  if (nextSite) siteHandTarget(nextSite, controller.lookTarget);
  locomotion.nextVineAnchor = controller.reach
    ? controller.hands[controller.reach.hand].target
    : controller.handoffRelease
      ? controller.hands[otherHand(controller.handoffRelease)].contact
      : nextSite
        ? controller.lookTarget
        : undefined;
  locomotion.brachiationProgress = controller.reach
    ? Math.min(1, controller.reach.elapsed / controller.reach.duration)
    : undefined;

  if (gripAttachment?.grabbed) {
    const support = gripAttachment.support;
    const radialX = position.x - support.x;
    const radialY = position.y - support.y;
    const radialZ = position.z - support.z;
    const rotation = gripAttachment.site?.vine.rotationY ?? 0;
    const planeDistance =
      radialX * Math.sin(rotation) + radialZ * Math.cos(rotation);
    locomotion.swingAngle = Math.atan2(planeDistance, -radialY);
    const radiusSquared = Math.max(
      1e-5,
      radialX * radialX + radialY * radialY + radialZ * radialZ,
    );
    const tangentX = -radialY * Math.sin(rotation);
    const tangentY = planeDistance;
    const tangentZ = -radialY * Math.cos(rotation);
    locomotion.swingAngularVelocity =
      (velocity.x * tangentX + velocity.y * tangentY + velocity.z * tangentZ) /
      radiusSquared;
  } else {
    locomotion.swingAngle = undefined;
    locomotion.swingAngularVelocity = undefined;
  }
}

function setTreeTarget(out: MutableVec3, tree: TreeActivity, progress: number) {
  const topX = tree.site.climb.topX ?? tree.site.climb.x;
  const topZ = tree.site.climb.topZ ?? tree.site.climb.z;
  const baseY = tree.site.climb.baseY ?? CHARACTER_SPAWN_Y;
  const t = Math.max(0, Math.min(1, progress));
  out.x = tree.site.climb.x + (topX - tree.site.climb.x) * t;
  out.y = baseY + (tree.site.climb.topY - baseY) * t;
  out.z = tree.site.climb.z + (topZ - tree.site.climb.z) * t;
  return out;
}

function startTreeActivity(
  controller: Controller,
  site: ArborealSite,
  position: Readonly<Vec3>,
  rigid: RapierRigidBody,
  kinematicType: Parameters<RapierRigidBody["setBodyType"]>[0],
) {
  controller.tree = {
    kind: "tree-climb",
    site,
    elapsed: 0,
    vineWalk: site.id === PHASE_FOUR_LADDER_SITE.id || site.id === CANOPY_BRIDGE_SITE.id
      ? createVineWalk(position, Math.abs(position.y - site.climb.topY) < 1.5, site.id === CANOPY_BRIDGE_SITE.id ? CANOPY_BRIDGE_CURVE : undefined)
      : undefined,
  };
  setState(controller, "CLIMB");
  rigid.setBodyType(kinematicType, true);
  rigid.setNextKinematicTranslation(position);
}

export default function Character({
  id,
  running,
}: {
  id: CharacterId;
  running: boolean;
}) {
  const body = useRef<RapierRigidBody>(null);
  const capsule = useRef<RapierCollider>(null);
  const model = useRef<Group>(null);
  const locomotion = useRef<MonkeyLocomotion>({
    speed: 0,
    grounded: true,
    state: "GROUND",
    velocity: vector(),
    forward: vector(0, 0, -1),
    right: vector(1, 0, 0),
    up: vector(0, 1, 0),
    hands: {
      left: { grabbed: false, reaching: false },
      right: { grabbed: false, reaching: false },
    },
  });
  const controller = useRef(createController());
  const followDelay = useRef(1);
  const followWait = useRef(1);
  const jumpCooldown = useRef(0);
  const surfaceRef = useRef<SwingSurface>({
    point: vector(),
    normal: vector(0, 1, 0),
    tangent: vector(0, 0, -1),
    speed: 0,
    driveSpeed: 0,
    phase: 0,
  });
  const selectedId = useGame((state) => state.puzzle.selected);
  const selected = selectedId === id;
  const power = useGame((state) => state.puzzle.powers[id]);
  const revision = useGame((state) => state.puzzle.revision);
  const map = useGame((state) => state.map);
  const debugEnabled = useGame((state) => state.movementDebug);
  const { world, rapier } = useRapier();
  const spawn =
    map === "phase2"
      ? phaseTwoCharacterSpawn(id, useGame.getState().phase2FromCanopy)
      : map === "phase3"
        ? phaseFourCharacterSpawn(id)
        : characterSpawn(id, useGame.getState().puzzle.bridge);

  const basisRef = useRef<LocalBasis>({
    forward: vector(0, 0, -1),
    right: vector(1, 0, 0),
    up: vector(0, 1, 0),
  });
  const vineDisplayBasis = useRef<LocalBasis>({
    forward: vector(0, 0, -1),
    right: vector(1, 0, 0),
    up: vector(0, 1, 0),
  });
  const vineExitStartForward = useRef<MutableVec3>(vector(0, 0, -1));
  const vineExitBlendRemaining = useRef(0);
  const scratchRef = useRef({
    desired: vector(),
    candidate: vector(),
    commandVelocity: vector(),
    assistedVelocity: vector(),
    assistDirection: vector(),
    radialDirection: vector(),
    leftShoulder: vector(),
    rightShoulder: vector(),
    predictedPosition: vector(),
    solvedVelocity: vector(),
    kinematicTarget: vector(),
    targetQuaternion: new Quaternion(),
    basisMatrix: new Matrix4(),
    basisRight: new Vector3(),
    basisUp: new Vector3(),
    basisForward: new Vector3(),
    groundRay: new rapier.Ray(vector(), vector(0, -1, 0)),
  });

  useEffect(() => {
    const delay = followerDelaySeconds(id, Math.random());
    followDelay.current = delay;
    followWait.current = delay;
  }, [id]);

  useEffect(() => {
    const rigid = body.current;
    const testing = window as unknown as { __canopyBodies?: unknown[] };
    (testing.__canopyBodies ??= [])[id] = rigid;
    if (rigid) {
      rigid.setBodyType(rapier.RigidBodyType.Dynamic, true);
      // Direct translation is reserved for explicit spawn/reset recovery only.
      rigid.setTranslation(spawn, true);
      rigid.setLinvel(vector(), true);
    }
    runtime.positions[id] = spawn;
    if (map === "phase2") {
      const yaw = useGame.getState().phase2FromCanopy ? Math.PI : PHASE_TWO_START_YAW;
      Object.assign(basisRef.current.forward, { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) });
      Object.assign(basisRef.current.right, { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) });
    }
    runtime.grounded[id] = true;
    runtime.motions[id] = null;
    if (runtime.activeVine?.monkeyId === id) runtime.activeVine = null;
    capsule.current?.setSensor(false);
    followWait.current = followDelay.current;
    jumpCooldown.current = 0;
    clearTraversal(controller.current);
  }, [revision, id, map, rapier]);

  useEffect(() => {
    followWait.current = followDelay.current;
    if (selectedId === id) return;
    const traversal = controller.current;
    if (!traversal.tree && grabbedCount(traversal) === 0 && !traversal.reach)
      return;
    body.current?.setBodyType(rapier.RigidBodyType.Dynamic, true);
    capsule.current?.setSensor(false);
    clearTraversal(traversal);
    runtime.vineContacts[id].left = null;
    runtime.vineContacts[id].right = null;
    if (runtime.activeVine?.monkeyId === id) runtime.activeVine = null;
  }, [selectedId, id, rapier]);

  useBeforePhysicsStep(() => {
    const rigid = body.current;
    if (!running || !rigid) return;
    const dt = PHYSICS_FIXED_DT;
    const basis = basisRef.current;
    const scratch = scratchRef.current;
    const traversal = controller.current;
    traversal.elapsed += dt;
    if (traversal.handoffRelease) traversal.handoffElapsed += dt;
    // The shoulder bar turns toward the next grip's side while the arm is
    // still reaching for it (not after the grab lands), so it leads the
    // hand instead of snapping once attachHand fires. Once the new hand is
    // attached the turn is already complete; the release overlap just holds
    // it there until the old hand actually lets go.
    if (traversal.reach?.handoffFrom) {
      traversal.shoulderTurn = handoffShoulderTurn(
        traversal.reach.handoffFrom,
        Math.min(1, traversal.reach.elapsed / traversal.reach.duration),
      );
    } else if (traversal.handoffRelease) {
      traversal.shoulderTurn = handoffShoulderTurn(traversal.handoffRelease, 1);
    }
    if (
      traversal.state === "RELEASE" ||
      (traversal.state === "FLIGHT" && traversal.fromSwing)
    )
      traversal.releaseTime += dt;
    jumpCooldown.current = Math.max(0, jumpCooldown.current - dt);
    const position = rigid.translation();
    const velocity = rigid.linvel();
    const state = useGame.getState();
    const puzzle = state.puzzle;
    const inPhaseFour = state.map === "phase3";
    const inPhaseTwo = state.map === "phase2";
    const restore = runtime.phase2Restore[id];
    if (restore && inPhaseTwo) {
      rigid.setBodyType(rapier.RigidBodyType.Dynamic, true);
      rigid.setTranslation(restore, true);
      rigid.setLinvel({ x: 0, y: 0, z: 0 }, true);
      capsule.current?.setSensor(false);
      runtime.positions[id] = { ...restore };
      runtime.phase2Restore[id] = null;
      return;
    }
    if (!inPhaseTwo) runtime.phase2Restore[id] = null;
    const phase2Seat = inPhaseTwo ? runtime.phase2Seats.findIndex((value) => value === id) : -1;
    if (phase2Seat >= 0) {
      const seat = PHASE_TWO_STOOLS[phase2Seat];
      const seated = { x: seat.x, y: phaseTwoGroundHeight(seat.x, seat.z) + seat.seatedHeight, z: seat.z };
      clearTraversal(traversal);
      rigid.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      rigid.setNextKinematicTranslation(seated);
      capsule.current?.setSensor(true);
      runtime.positions[id] = seated;
      runtime.motions[id] = null;
      runtime.grounded[id] = true;
      locomotion.current.speed = 0;
      return;
    }
    if (inPhaseTwo && runtime.chessActive) { rigid.setLinvel({ x: 0, y: 0, z: 0 }, true); return; }
    locomotion.current.classicGroundMotion = inPhaseFour || inPhaseTwo;
    // Match main's shorter ordinary jump without changing pendulum gravity.
    const gravityScale =
      !traversal.fromSwing && !traversal.reach ? 1.5 : 1;
    if (rigid.gravityScale() !== gravityScale)
      rigid.setGravityScale(gravityScale, true);
    const debug = runtime.movementDebug[id];
    debug.physicsDt = dt;
    copyVector(debug.gravity, WORLD_GRAVITY);
    copyVector(debug.position, position);
    copyVector(debug.velocity, velocity);

    const depth = inPhaseFour || inPhaseTwo
      ? 0
      : waterDepth(position.x, position.z, puzzle.bridge);
    const fellFromMap = inPhaseTwo ? phaseTwoOutsideMap(position) : position.y < (inPhaseFour ? PHASE_FOUR_FALL_Y : -7) || (inPhaseFour && phaseFourTouchesGround(position));
    if (fellFromMap || depth > EDGE_DEEP || (inPhaseTwo && phaseTwoTouchesLava(position))) {
      if (inPhaseFour || inPhaseTwo) {
        const spawn = inPhaseTwo ? phaseTwoCharacterSpawn(id) : phaseFourCharacterSpawn(id);
        rigid.setBodyType(rapier.RigidBodyType.Dynamic, true);
        rigid.setTranslation(spawn, true);
        rigid.setLinvel(vector(), true);
        capsule.current?.setSensor(false);
        clearTraversal(traversal);
        runtime.vineContacts[id].left = null;
        runtime.vineContacts[id].right = null;
        runtime.positions[id] = spawn;
        if (inPhaseTwo && selected) { runtime.yaw = PHASE_TWO_START_YAW; runtime.keys.clear(); runtime.jump = false; }
        runtime.motions[id] = null;
        if (runtime.activeVine?.monkeyId === id) runtime.activeVine = null;
      } else {
        runtime.splashes.push({ x: position.x, y: -0.2, z: position.z });
        state.reset();
      }
      return;
    }

    const inputForward = selected
      ? Number(runtime.keys.has("KeyW") || runtime.keys.has("ArrowUp")) -
        Number(runtime.keys.has("KeyS") || runtime.keys.has("ArrowDown"))
      : 0;
    const inputRight = selected
      ? Number(runtime.keys.has("KeyD") || runtime.keys.has("ArrowRight")) -
        Number(runtime.keys.has("KeyA") || runtime.keys.has("ArrowLeft"))
      : 0;
    // Only the selected character's own input reverses which way auto-advance
    // reaches; a follower (or the selected character standing still) keeps
    // whatever direction it last had.
    if (selected && grabbedCount(traversal) > 0 && inputForward !== 0)
      traversal.travelDirection = inputForward > 0 ? 1 : -1;
    scratch.desired.x =
      inputRight * Math.cos(runtime.yaw) - inputForward * Math.sin(runtime.yaw);
    scratch.desired.y = 0;
    scratch.desired.z =
      -inputForward * Math.cos(runtime.yaw) -
      inputRight * Math.sin(runtime.yaw);
    if (
      !inputForward &&
      !inputRight &&
      Math.hypot(velocity.x, velocity.y, velocity.z) > 0.05
    )
      copyVector(scratch.desired, velocity);
    const routeSite =
      traversal.reach?.site ??
      (traversal.currentSite
        ? traversal.travelDirection < 0
          ? previousBrachiationSite(traversal.currentSite)
          : nextBrachiationSite(traversal.currentSite)
        : undefined);
    if (grabbedCount(traversal) > 0 && routeSite?.vine.brachiation) {
      // Facing follows the next hold, so a pendulum's backward half-cycle
      // cannot swap the physical left/right shoulders by 180 degrees.
      scratch.desired.x = routeSite.vine.x - position.x;
      scratch.desired.y = 0;
      scratch.desired.z = routeSite.vine.z - position.z;
    }
    buildLocalBasis(scratch.desired, WORLD_GRAVITY, basis.forward, basis);
    if (grabbedCount(traversal) > 0) {
      const site = traversal.handoffRelease
        ? traversal.hands[traversal.handoffRelease].site
        : traversal.currentSite;
      const nextSite = traversal.handoffRelease
        ? traversal.currentSite
        : routeSite;
      if (site && nextSite) {
        scratch.candidate.x = nextSite.vine.x - site.vine.x;
        scratch.candidate.y = nextSite.vine.attachY - site.vine.attachY;
        scratch.candidate.z = nextSite.vine.z - site.vine.z;
      } else if (site) {
        // A fixed support defines the resting heading. Velocity reverses on
        // every half-swing and must never rotate the shoulders around the grip.
        scratch.candidate.x = Math.sin(site.vine.rotationY);
        scratch.candidate.y = 0;
        scratch.candidate.z = Math.cos(site.vine.rotationY);
      } else copyVector(scratch.candidate, basis.forward);
      const phase = traversal.reach
        ? Math.min(1, traversal.reach.elapsed / traversal.reach.duration)
        : 0;
      const leanTarget =
        Math.sin(phase * Math.PI) * 0.16 +
        Math.max(
          -0.12,
          Math.min(
            0.12,
            (velocity.x * basis.right.x + velocity.z * basis.right.z) * 0.08,
          ),
        );
      traversal.bodyLeanRate +=
        ((leanTarget - traversal.bodyLean) * 45 - traversal.bodyLeanRate * 12) *
        dt;
      traversal.bodyLean += traversal.bodyLeanRate * dt;
      if (site && !site.vine.directGrip) {
        const support = runtime.swingingVines.get(site.id)?.constraints[0]
          .anchor ?? { x: site.vine.x, y: site.vine.attachY, z: site.vine.z };
        scratch.candidate.x = position.x - support.x;
        scratch.candidate.y = position.y - support.y;
        scratch.candidate.z = position.z - support.z;
        pendulumBodyBasis(
          traversal.bodyBasis,
          scratch.candidate,
          site.vine.rotationY,
        );
      } else
        suspensionBasis(
          traversal.bodyBasis,
          scratch.candidate,
          traversal.bodyLean,
          traversal.shoulderTurn,
        );
      locomotion.current.bodyBasis = traversal.bodyBasis;
    } else if (
      !traversal.fromSwing ||
      traversal.state === "LANDING" ||
      traversal.state === "GROUND" ||
      traversal.state === "RUN" ||
      traversal.state === "CLIMB"
    ) {
      if (vineExitBlendRemaining.current > 0) {
        // Continue easing the facing back to normal after letting go of a
        // walked vine (see VINE_FACING_BLEND_SECONDS) instead of snapping
        // straight to the grounded basis the instant the walk ends.
        vineExitBlendRemaining.current = Math.max(0, vineExitBlendRemaining.current - dt);
        const eased = 1 - vineExitBlendRemaining.current / VINE_FACING_BLEND_SECONDS;
        const smooth = eased * eased * (3 - 2 * eased);
        blendFacingBasis(vineDisplayBasis.current, vineExitStartForward.current, basis.forward, smooth);
        locomotion.current.bodyBasis = vineDisplayBasis.current;
      } else {
        locomotion.current.bodyBasis = undefined;
      }
    }
    const physicalBasis = locomotion.current.bodyBasis ?? basis;
    const leftShoulderOffset = shoulderOffset(locomotion.current, "left");
    const rightShoulderOffset = shoulderOffset(locomotion.current, "right");
    if (leftShoulderOffset)
      physicalShoulder(
        scratch.leftShoulder,
        position,
        physicalBasis,
        leftShoulderOffset,
      );
    if (rightShoulderOffset)
      physicalShoulder(
        scratch.rightShoulder,
        position,
        physicalBasis,
        rightShoulderOffset,
      );
    copyVector(locomotion.current.forward!, basis.forward);
    copyVector(locomotion.current.right!, basis.right);
    copyVector(locomotion.current.up!, basis.up);
    for (const side of ["left", "right"] as const) {
      const hand = traversal.hands[side];
      if (hand.grabbed || hand.reaching) continue;
      const shoulder =
        side === "left" ? scratch.leftShoulder : scratch.rightShoulder;
      scratch.candidate.x = shoulder.x;
      scratch.candidate.y =
        shoulder.y - armLength(locomotion.current, side) * 0.85;
      scratch.candidate.z = shoulder.z;
      const blend = hand.pointReady ? 1 - Math.exp(-8 * dt) : 1;
      hand.point.x += (scratch.candidate.x - hand.point.x) * blend;
      hand.point.y += (scratch.candidate.y - hand.point.y) * blend;
      hand.point.z += (scratch.candidate.z - hand.point.z) * blend;
      hand.pointReady = true;
    }
    copyVector(debug.forward, basis.forward);
    copyVector(debug.right, basis.right);
    copyVector(debug.up, basis.up);

    const groundRay = scratch.groundRay;
    groundRay.origin.x = position.x - basis.up.x * 0.1;
    groundRay.origin.y = position.y - basis.up.y * 0.1;
    groundRay.origin.z = position.z - basis.up.z * 0.1;
    groundRay.dir.x = -basis.up.x;
    groundRay.dir.y = -basis.up.y;
    groundRay.dir.z = -basis.up.z;
    const ground = world.castRay(
      groundRay,
      LOCOMOTION_TUNING.groundProbeDistance,
      true,
      undefined,
      undefined,
      undefined,
      rigid,
    );
    // The probe still sees the launch surface during the first jump steps.
    const risingJump = traversal.state === "JUMP" &&
      velocity.x * basis.up.x + velocity.y * basis.up.y + velocity.z * basis.up.z > 0;
    const grounded =
      !!ground && grabbedCount(traversal) === 0 && !traversal.tree && !risingJump;
    let interactionRequested =
      selected &&
      (runtime.interact ||
        (!traversal.tree &&
          grabbedCount(traversal) === 0 &&
          runtime.keys.has("KeyE")));
    if (interactionRequested) runtime.interact = false;

    if (traversal.tree) {
      const tree = traversal.tree;
      tree.elapsed += dt;
      if (tree.vineWalk) {
        const walk = tree.vineWalk;
        const input = vineWalkInput(walk.distance, runtime.yaw, inputForward, inputRight, walk);
        const arrived = stepVineWalk(walk, input, dt);
        runtime.jump = false;
        if (tree.site.id === CANOPY_BRIDGE_SITE.id) {
          // Mizaru's sight / Kikazaru's hearing clear as they cross the vine
          // they cooperated to build — ratchets up only (walking backward
          // partway across doesn't undo progress already made), and latches
          // permanently once either reaches the far end.
          const senseProgress = Math.max(0, Math.min(1, walk.distance / walk.length));
          if (id === 0 && senseProgress > runtime.mizaruVineSight)
            runtime.mizaruVineSight = senseProgress;
          if (id === 1 && senseProgress > runtime.kikazaruVineHearing)
            runtime.kikazaruVineHearing = senseProgress;
          const puzzleState = useGame.getState().puzzle;
          if (id === 0 && senseProgress >= 1 && !puzzleState.mizaruSightRestored)
            useGame.getState().restoreMizaruSight();
          if (id === 1 && senseProgress >= 1 && !puzzleState.kikazaruHearingRestored)
            useGame.getState().restoreKikazaruHearing();
        }
        if (arrived) {
          // Finish the kinematic step before restoring collision, above the
          // deck. No gravity frame can strand the capsule under its edge.
          rigid.setTranslation(walk.position, true);
          rigid.setBodyType(rapier.RigidBodyType.Dynamic, true);
          rigid.setLinvel(vector(), true);
          traversal.tree = null;
          capsule.current?.setSensor(false);
          setState(traversal, "LANDING");
          // Hand off to the exit blend (picked up below, once traversal.tree
          // is gone) instead of snapping bodyBasis to undefined this frame.
          // The start snapshot is fixed for the whole exit window — the
          // display basis itself keeps changing every frame, so blending
          // *from* that instead would re-lerp from an already-part-way point
          // each frame and converge faster than intended.
          vineExitStartForward.current.x = walk.basis.forward.x;
          vineExitStartForward.current.y = walk.basis.forward.y;
          vineExitStartForward.current.z = walk.basis.forward.z;
          vineExitBlendRemaining.current = VINE_FACING_BLEND_SECONDS;
          blendFacingBasis(vineDisplayBasis.current, walk.basis.forward, walk.basis.forward, 1);
        } else {
          rigid.setNextKinematicTranslation(walk.position);
          capsule.current?.setSensor(true);
          setState(traversal, "CLIMB");
          // Ease the displayed facing in from wherever the body was already
          // pointed (last frame's basis, since this early return skips the
          // normal buildLocalBasis call below) toward the vine's own
          // direction, over the same window the position eases in over.
          const entryBlend = Math.min(1, walk.entryTime / VINE_FACING_BLEND_SECONDS);
          const entryEase = entryBlend * entryBlend * (3 - 2 * entryBlend);
          blendFacingBasis(vineDisplayBasis.current, basis.forward, walk.basis.forward, entryEase);
        }
        updateLocomotion(traversal, locomotion.current, position, velocity, false);
        locomotion.current.bodyBasis = vineDisplayBasis.current;
        locomotion.current.speed = Math.abs(walk.speed);
        runtime.grounded[id] = false;
        runtime.speeds[id] = locomotion.current.speed;
        runtime.motions[id] = locomotion.current.motion ?? null;
        debug.state = traversal.state;
        return;
      }
      if (interactionRequested && tree.kind === "tree-hold") {
        tree.kind = "tree-descend";
        tree.elapsed = 0;
        interactionRequested = false;
      }
      if (tree.kind === "tree-climb") {
        setTreeTarget(
          scratch.kinematicTarget,
          tree,
          easeInOut(tree.elapsed / TREE_CLIMB_SECONDS),
        );
        rigid.setNextKinematicTranslation(scratch.kinematicTarget);
        if (tree.elapsed >= TREE_CLIMB_SECONDS) {
          if (tree.site.climb.dismount) {
            // This endpoint is above a solid deck; resume walking at the end
            // of the ladder instead of keeping the monkey in a tree hold.
            rigid.setBodyType(rapier.RigidBodyType.Dynamic, true);
            rigid.setLinvel(vector(), true);
            traversal.tree = null;
            capsule.current?.setSensor(false);
            setState(traversal, "LANDING");
          } else {
            tree.kind = "tree-hold";
            tree.elapsed = 0;
          }
        }
      } else if (tree.kind === "tree-descend") {
        setTreeTarget(
          scratch.kinematicTarget,
          tree,
          1 - easeInOut(tree.elapsed / TREE_DESCEND_SECONDS),
        );
        rigid.setNextKinematicTranslation(scratch.kinematicTarget);
        if (tree.elapsed >= TREE_DESCEND_SECONDS) {
          setTreeTarget(scratch.kinematicTarget, tree, 0);
          rigid.setNextKinematicTranslation(scratch.kinematicTarget);
          rigid.setBodyType(rapier.RigidBodyType.Dynamic, true);
          traversal.tree = null;
          setState(traversal, "LANDING");
          capsule.current?.setSensor(false);
        }
      } else {
        setTreeTarget(scratch.kinematicTarget, tree, 1);
        rigid.setNextKinematicTranslation(scratch.kinematicTarget);
      }
      if (traversal.tree) {
        capsule.current?.setSensor(true);
        setState(traversal, "CLIMB");
        updateLocomotion(
          traversal,
          locomotion.current,
          position,
          velocity,
          false,
        );
        runtime.grounded[id] = false;
        runtime.speeds[id] = locomotion.current.speed;
        runtime.motions[id] = locomotion.current.motion ?? null;
        debug.state = traversal.state;
        return;
      }
    }

    if (grabbedCount(traversal) > 0) {
      traversal.motionTime += dt;
      if (selected) applyVineClimbControl(traversal, dt);
      updateHandContact(traversal.hands.left, position, locomotion.current, dt);
      updateHandContact(
        traversal.hands.right,
        position,
        locomotion.current,
        dt,
      );
      if (selected && runtime.jump) {
        runtime.jump = false;
        const grip = grippingHand(traversal);
        traversal.lastReleasedSiteId = traversal.currentSite?.id;
        if (grip) traversal.preferredHand = otherHand(grip);
        detachHand(traversal.hands.left);
        detachHand(traversal.hands.right);
        traversal.reach = null;
        traversal.currentSite = null;
        traversal.handoffRelease = null;
        traversal.handoffElapsed = 0;
        setState(traversal, "RELEASE");
        traversal.releaseTime = 0;
        capsule.current?.setSensor(false);
        if (LOCOMOTION_TUNING.releaseAssist > 0) {
          releaseVelocity(
            scratch.commandVelocity,
            velocity,
            basis.forward,
            LOCOMOTION_TUNING.releaseAssist,
          );
          rigid.setLinvel(scratch.commandVelocity, true);
        }
        if (runtime.activeVine?.monkeyId === id) runtime.activeVine = null;
      } else {
        const grip = grippingHand(traversal);
        const currentSite = grip
          ? traversal.hands[grip].site
          : traversal.currentSite;
        if (
          !traversal.reach &&
          !traversal.handoffRelease &&
          grip &&
          currentSite?.vine.brachiation &&
          // The selected character can just hang there - auto-advance only
          // fires while it is actually holding a direction. A follower has
          // no input of its own, so it keeps auto-advancing as before.
          (!selected || inputForward !== 0)
        ) {
          const nextSite =
            traversal.travelDirection < 0
              ? previousBrachiationSite(currentSite)
              : nextBrachiationSite(currentSite);
          if (nextSite)
            beginReach(
              traversal,
              otherHand(grip),
              nextSite,
              0,
              grip,
              grip === "left" ? debug.rightHand : debug.leftHand,
            );
        } else if (interactionRequested && !traversal.reach && grip) {
          const freeHand = otherHand(grip);
          const lineOfSight = (target: Readonly<Vec3>) => {
            const dx = target.x - position.x;
            const dy = target.y - position.y;
            const dz = target.z - position.z;
            const distance = Math.hypot(dx, dy, dz);
            if (distance < 1e-5) return true;
            groundRay.origin.x = position.x;
            groundRay.origin.y = position.y;
            groundRay.origin.z = position.z;
            groundRay.dir.x = dx / distance;
            groundRay.dir.y = dy / distance;
            groundRay.dir.z = dz / distance;
            const hit = world.castRay(
              groundRay,
              distance,
              true,
              rapier.QueryFilterFlags.ONLY_FIXED,
              undefined,
              undefined,
              rigid,
            );
            return !hit || hit.timeOfImpact >= distance - 0.08;
          };
          const nextSite = currentSite
            ? traversal.travelDirection < 0
              ? previousBrachiationSite(currentSite)
              : nextBrachiationSite(currentSite)
            : undefined;
          // E is an explicit handoff request: try the next pendulum first so
          // a nearby unrelated vine cannot steal the transfer.
          const nextCandidate = nextSite
            ? bestAnchor(
                position,
                velocity,
                scratch.desired,
                basis,
                [nextSite],
                freeHand,
                rootReach(locomotion.current, freeHand),
                currentSite?.id,
                scratch.candidate,
                debug,
                // A pendulum-to-pendulum handoff is an authored route. The
                // intervening upper trees are scenery and must not make one
                // span behave differently from the next.
                () => true,
              )
            : undefined;
          const candidate =
            nextCandidate ??
            bestAnchor(
              position,
              velocity,
              scratch.desired,
              basis,
              sitesForMap(state.map),
              freeHand,
              rootReach(locomotion.current, freeHand),
              currentSite?.id,
              scratch.candidate,
              debug,
              lineOfSight,
            );
          if (candidate)
            beginReach(
              traversal,
              freeHand,
              candidate.site,
              candidate.score,
              grip,
              freeHand === "left" ? debug.leftHand : debug.rightHand,
            );
        }
        if (traversal.reach) {
          const reach = traversal.reach;
          reach.elapsed += dt;
          const hand = traversal.hands[reach.hand];
          hand.maxLength =
            rootReach(locomotion.current, reach.hand) *
            LOCOMOTION_TUNING.maxArmStretch;
          siteHandTarget(reach.site, hand.target, position);
          sampleHandReach(
            hand.point,
            hand.reachOrigin,
            hand.target,
            reach.elapsed / reach.duration,
            physicalBasis.forward,
          );
          const shoulder =
            reach.hand === "left"
              ? scratch.leftShoulder
              : scratch.rightShoulder;
          const hasPhysicalShoulder = !!shoulderOffset(
            locomotion.current,
            reach.hand,
          );
          controller.current.closestReachDistance = Math.min(
            controller.current.closestReachDistance,
            Math.hypot(
              shoulder.x - hand.target.x,
              shoulder.y - hand.target.y,
              shoulder.z - hand.target.z,
            ),
          );
          if (
            reach.elapsed >= reach.duration &&
            canCapture(
              position,
              hand.target,
              // Upper pendulums have a wider authored handoff window. Apply
              // the same padding to the root and shoulder checks so a target
              // is not selected successfully and then rejected one line
              // later by the calibrated arm length.
              hand.maxLength +
                (reach.site.vine.grabRadius ?? LOCOMOTION_TUNING.grabRadius),
              hasPhysicalShoulder ? shoulder : undefined,
              armLength(locomotion.current, reach.hand) +
                (reach.site.vine.grabRadius ?? LOCOMOTION_TUNING.grabRadius),
              !traversal.fromSwing && !reach.handoffFrom,
            )
          ) {
            attachHand(
              traversal,
              reach.hand,
              reach.site,
              position,
              locomotion.current,
            );
            if (reach.handoffFrom) {
              traversal.handoffRelease = reach.handoffFrom;
              traversal.handoffElapsed = 0;
              setState(traversal, "SWING_TWO_HANDS");
            }
          } else if (reach.elapsed >= reach.timeout) cancelReach(traversal);
        }
        if (traversal.handoffRelease) {
          if (
            traversal.handoffElapsed >=
            (inPhaseFour ? 0.16 : LOCOMOTION_TUNING.handoffOverlap)
          ) {
            const released = traversal.handoffRelease;
            detachHand(traversal.hands[released]);
            traversal.preferredHand = released;
            traversal.handoffRelease = null;
            traversal.handoffElapsed = 0;
            traversal.handoffCount += 1;
            setState(traversal, "SWING_ONE_HAND");
          }
        }
        // Idle only counts once nothing is actively in progress - a fresh
        // reach or an ongoing handoff overlap always resets it.
        if (traversal.reach || traversal.handoffRelease)
          traversal.idleElapsed = 0;
        else traversal.idleElapsed += dt;
        updateHandContact(
          traversal.hands.left,
          position,
          locomotion.current,
          dt,
        );
        updateHandContact(
          traversal.hands.right,
          position,
          locomotion.current,
          dt,
        );
        copyVector(scratch.assistedVelocity, velocity);
        const assistGrip = grippingHand(traversal);
        const assistHand = assistGrip ? traversal.hands[assistGrip] : undefined;
        if (assistHand?.grabbed) {
          scratch.radialDirection.x =
            position.x - assistHand.constraint.anchor.x;
          scratch.radialDirection.y =
            position.y - assistHand.constraint.anchor.y;
          scratch.radialDirection.z =
            position.z - assistHand.constraint.anchor.z;
          normalizeVector(
            scratch.radialDirection,
            scratch.radialDirection,
            basis.up,
          );
          let assistAcceleration = 0;
          if (traversal.reach?.handoffFrom) {
            const target = traversal.hands[traversal.reach.hand].target;
            scratch.assistDirection.x = target.x - position.x;
            scratch.assistDirection.y = target.y - position.y;
            scratch.assistDirection.z = target.z - position.z;
            assistAcceleration = LOCOMOTION_TUNING.handoffAssist;
          }
          if (
            assistAcceleration === 0 &&
            LOCOMOTION_TUNING.swingAssist > 0 &&
            (inputForward || inputRight)
          ) {
            copyVector(scratch.assistDirection, basis.forward);
            assistAcceleration = LOCOMOTION_TUNING.swingAssist;
          }
          if (assistAcceleration > 0) {
            projectTangential(
              scratch.assistDirection,
              scratch.assistDirection,
              scratch.radialDirection,
            );
            if (
              Math.hypot(
                scratch.assistDirection.x,
                scratch.assistDirection.y,
                scratch.assistDirection.z,
              ) > 1e-6
            ) {
              normalizeVector(scratch.assistDirection, scratch.assistDirection);
              scratch.assistedVelocity.x +=
                scratch.assistDirection.x * assistAcceleration * dt;
              scratch.assistedVelocity.y +=
                scratch.assistDirection.y * assistAcceleration * dt;
              scratch.assistedVelocity.z +=
                scratch.assistDirection.z * assistAcceleration * dt;
            }
          }
        }
        if (locomotion.current.swingSurface)
          driveSwingSurface(
            scratch.assistedVelocity,
            scratch.assistedVelocity,
            locomotion.current.swingSurface,
            dt,
          );
        constrainedPreStepVelocity(
          scratch.commandVelocity,
          position,
          scratch.assistedVelocity,
          WORLD_GRAVITY,
          traversal.constraints,
          dt,
          LOCOMOTION_TUNING.swingConstraintIterations,
          LOCOMOTION_TUNING.swingDamping,
          scratch,
        );
        rigid.setLinvel(scratch.commandVelocity, true);
        capsule.current?.setSensor(
          !inPhaseFour || shouldDisableSwingCollision(traversal, inPhaseFour),
        );
        const activeGrip = grippingHand(traversal);
        const active = activeGrip ? traversal.hands[activeGrip] : undefined;
        if (active?.site) {
          const currentVine = runtime.activeVine;
          if (
            currentVine?.siteId === active.site.id &&
            currentVine.monkeyId === id
          ) {
            currentVine.elapsed = traversal.motionTime;
            currentVine.grip = active.contact;
          } else
            runtime.activeVine = {
              siteId: active.site.id,
              monkeyId: id,
              elapsed: traversal.motionTime,
              grip: active.contact,
            };
        }
      }
    }

    if (grabbedCount(traversal) === 0) {
      capsule.current?.setSensor(false);
      if (traversal.state === "RELEASE") {
        if (traversal.elapsed >= LOCOMOTION_TUNING.releaseThreshold)
          setState(traversal, "FLIGHT");
      } else if (!grounded) {
        // A ground jump keeps its animation through descent until landing.
        // Walking off an edge and releasing a vine still use free flight.
        if (traversal.state !== "REACH" && traversal.state !== "JUMP")
          setState(traversal, "FLIGHT");
      } else if (
        traversal.state === "JUMP" ||
        traversal.state === "FLIGHT" ||
        traversal.state === "REACH" ||
        traversal.state === "LANDING"
      ) {
        if (traversal.state !== "LANDING") setState(traversal, "LANDING");
        else if (traversal.elapsed >= LOCOMOTION_TUNING.landingDuration) {
          traversal.fromSwing = false;
          setState(traversal, inputForward || inputRight ? "RUN" : "GROUND");
        }
      } else
        setState(traversal, inputForward || inputRight ? "RUN" : "GROUND");

      if (
        interactionRequested &&
        !traversal.reach &&
        !power &&
        runtime.eatingUntil[id] <= performance.now()
      ) {
        const sites = sitesForMap(state.map);
        const interaction = nearestArborealInteraction(position, sites);
        if (interaction?.kind === "tree") {
          startTreeActivity(
            traversal,
            interaction.site,
            position,
            rigid,
            rapier.RigidBodyType.KinematicPositionBased,
          );
          capsule.current?.setSensor(true);
          updateLocomotion(
            traversal,
            locomotion.current,
            position,
            velocity,
            false,
          );
          runtime.motions[id] = locomotion.current.motion ?? null;
          return;
        }
        const candidate = bestAnchor(
          position,
          velocity,
          scratch.desired,
          basis,
          sites,
          traversal.preferredHand,
          rootReach(locomotion.current, traversal.preferredHand),
          traversal.fromSwing && traversal.releaseTime < 0.5
            ? traversal.lastReleasedSiteId
            : undefined,
          scratch.candidate,
          debug,
          (target) => {
            const dx = target.x - position.x;
            const dy = target.y - position.y;
            const dz = target.z - position.z;
            const distance = Math.hypot(dx, dy, dz);
            if (distance < 1e-5) return true;
            groundRay.origin.x = position.x;
            groundRay.origin.y = position.y;
            groundRay.origin.z = position.z;
            groundRay.dir.x = dx / distance;
            groundRay.dir.y = dy / distance;
            groundRay.dir.z = dz / distance;
            const hit = world.castRay(
              groundRay,
              distance,
              true,
              rapier.QueryFilterFlags.ONLY_FIXED,
              undefined,
              undefined,
              rigid,
            );
            return !hit || hit.timeOfImpact >= distance - 0.08;
          },
          !traversal.fromSwing,
        );
        if (candidate)
          beginReach(
            traversal,
            traversal.preferredHand,
            candidate.site,
            candidate.score,
            null,
            traversal.preferredHand === "left"
              ? debug.leftHand
              : debug.rightHand,
            traversal.fromSwing,
          );
      }

      if (traversal.reach) {
        const reach = traversal.reach;
        reach.elapsed += dt;
        const hand = traversal.hands[reach.hand];
        hand.maxLength =
          rootReach(locomotion.current, reach.hand) *
          LOCOMOTION_TUNING.maxArmStretch;
        siteHandTarget(reach.site, hand.target, position);
        sampleHandReach(
          hand.point,
          hand.reachOrigin,
          hand.target,
          reach.elapsed / reach.duration,
          physicalBasis.forward,
        );
        const shoulder =
          reach.hand === "left" ? scratch.leftShoulder : scratch.rightShoulder;
        const hasPhysicalShoulder = !!shoulderOffset(
          locomotion.current,
          reach.hand,
        );
        controller.current.closestReachDistance = Math.min(
          controller.current.closestReachDistance,
          Math.hypot(
            shoulder.x - hand.target.x,
            shoulder.y - hand.target.y,
            shoulder.z - hand.target.z,
          ),
        );
        if (
          reach.elapsed >= reach.duration &&
          canCapture(
            position,
            hand.target,
            hand.maxLength + (reach.site.vine.grabRadius ?? 0),
            hasPhysicalShoulder ? shoulder : undefined,
            armLength(locomotion.current, reach.hand) + (reach.site.vine.grabRadius ?? 0),
            !traversal.fromSwing && !reach.handoffFrom,
          )
        ) {
          attachHand(
            traversal,
            reach.hand,
            reach.site,
            position,
            locomotion.current,
          );
          capsule.current?.setSensor(
            !inPhaseFour || reach.site.vine.disableCharacterCollision === true,
          );
        } else if (reach.elapsed >= reach.timeout) cancelReach(traversal);
      }

      if (grabbedCount(traversal) === 0 && !traversal.tree) {
        let targetX = 0;
        let targetY = 0;
        let targetZ = 0;
        let hasMovementTarget = false;
        let followerWantsJump = false;
        const eating = runtime.eatingUntil[id] > performance.now();
        if (selected && !power && !eating && (inputForward || inputRight)) {
          const inputLength = Math.hypot(inputForward, inputRight);
          targetX =
            (scratch.desired.x / inputLength) * LOCOMOTION_TUNING.groundSpeed;
          targetY =
            (scratch.desired.y / inputLength) * LOCOMOTION_TUNING.groundSpeed;
          targetZ =
            (scratch.desired.z / inputLength) * LOCOMOTION_TUNING.groundSpeed;
          hasMovementTarget = true;
          state.learn("move");
        } else if (!selected && inPhaseTwo) {
          const leader = runtime.positions[puzzle.selected];
          const target = phaseTwoFollowTarget(position, leader);
          const dx = target.x-position.x, dz = target.z-position.z, distance = Math.hypot(dx,dz);
          const leaderDistance = Math.hypot(leader.x-position.x,leader.z-position.z);
          if (leaderDistance > 2 && distance > 0.15) {
            followWait.current = Math.max(0, followWait.current-dt);
            if (followWait.current <= 0) {
              targetX = dx/distance*4; targetZ = dz/distance*4; hasMovementTarget = true;
              followerWantsJump = grounded && jumpCooldown.current <= 0 && phaseTwoFollowerJump(position,dx,dz);
              // Wait at an unsafe landing rather than walking into a river.
              if (grounded && !followerWantsJump && phaseTwoLavaAt(position.x+dx/distance*0.4,position.z+dz/distance*0.4)) {
                targetX = 0; targetZ = 0; hasMovementTarget = false;
              }
            }
          } else followWait.current = 0.25;
        } else if (!selected && !power && state.map === "islands") {
          const leader = runtime.positions[puzzle.selected];
          const { x: followX, z: followZ, stopDistance } = islandFollowerTarget(position, leader, id);
          const dx = followX - position.x;
          const dz = followZ - position.z;
          const distance = Math.hypot(dx, dz);
          const wantsToFollow = distance > stopDistance;
          if (!wantsToFollow) followWait.current = followDelay.current;
          else if (followWait.current > 0)
            followWait.current = Math.max(0, followWait.current - dt);
          if (wantsToFollow && followWait.current <= 0) {
            targetX = (dx / distance) * 3.7;
            targetZ = (dz / distance) * 3.7;
            hasMovementTarget = true;
          }
          if (
            !safeGround(
              position.x + targetX * 0.18,
              position.z + targetZ * 0.18,
              puzzle.bridge,
            )
          ) {
            targetX = 0;
            targetZ = 0;
            hasMovementTarget = false;
          }
          if (grounded && hasMovementTarget && jumpCooldown.current <= 0) {
            const speed = Math.hypot(targetX, targetZ);
            const directionX = targetX / speed;
            const directionZ = targetZ / speed;
            const fixedOnly = rapier.QueryFilterFlags.ONLY_FIXED;
            groundRay.origin.x = position.x;
            groundRay.origin.y = position.y - 0.32;
            groundRay.origin.z = position.z;
            groundRay.dir.x = directionX;
            groundRay.dir.y = 0;
            groundRay.dir.z = directionZ;
            const lowerBlocked = !!world.castRay(
              groundRay,
              0.78,
              true,
              fixedOnly,
              undefined,
              undefined,
              rigid,
            );
            groundRay.origin.y = position.y + 0.38;
            const upperBlocked = !!world.castRay(
              groundRay,
              0.82,
              true,
              fixedOnly,
              undefined,
              undefined,
              rigid,
            );
            followerWantsJump = shouldFollowerJump({
              grounded,
              moving: true,
              lowerBlocked,
              upperBlocked,
              landingSafe: safeGround(
                position.x + directionX * 1.15,
                position.z + directionZ * 1.15,
                puzzle.bridge,
              ),
              cooldown: jumpCooldown.current,
            });
          }
        }

        const verticalSpeed =
          velocity.x * basis.up.x +
          velocity.y * basis.up.y +
          velocity.z * basis.up.z;
        const currentPlanarX = velocity.x - basis.up.x * verticalSpeed;
        const currentPlanarY = velocity.y - basis.up.y * verticalSpeed;
        const currentPlanarZ = velocity.z - basis.up.z * verticalSpeed;
        copyVector(scratch.commandVelocity, velocity);
        if (grounded) {
          scratch.commandVelocity.x = targetX + basis.up.x * verticalSpeed;
          scratch.commandVelocity.y = targetY + basis.up.y * verticalSpeed;
          scratch.commandVelocity.z = targetZ + basis.up.z * verticalSpeed;
        } else if (hasMovementTarget && !traversal.fromSwing) {
          let dx = targetX - currentPlanarX;
          let dy = targetY - currentPlanarY;
          let dz = targetZ - currentPlanarZ;
          const accelerationLength = Math.hypot(dx, dy, dz);
          const maxChange = LOCOMOTION_TUNING.airAcceleration * dt;
          if (accelerationLength > maxChange) {
            const scale = maxChange / accelerationLength;
            dx *= scale;
            dy *= scale;
            dz *= scale;
          }
          scratch.commandVelocity.x += dx;
          scratch.commandVelocity.y += dy;
          scratch.commandVelocity.z += dz;
        }

        const selectedJumpRequest = selected && runtime.jump;
        if (selected) runtime.jump = false;
        const jumping = (selectedJumpRequest || followerWantsJump) && grounded;
        if (jumping) {
          scratch.commandVelocity.x =
            targetX + basis.up.x * LOCOMOTION_TUNING.jumpSpeed;
          scratch.commandVelocity.y =
            targetY + basis.up.y * LOCOMOTION_TUNING.jumpSpeed;
          scratch.commandVelocity.z =
            targetZ + basis.up.z * LOCOMOTION_TUNING.jumpSpeed;
          traversal.fromSwing = false;
          setState(traversal, "JUMP");
          jumpCooldown.current = followerWantsJump ? 0.7 : jumpCooldown.current;
          if (selectedJumpRequest) state.learn("jump");
        }

        if (depth > EDGE_SLOW) {
          const amount = Math.min(
            1,
            (depth - EDGE_SLOW) / (EDGE_DEEP - EDGE_SLOW),
          );
          const slow = 1 - amount * 0.85;
          scratch.commandVelocity.x *= slow;
          scratch.commandVelocity.z *= slow;
        }
        if (
          inPhaseFour &&
          !traversal.fromSwing &&
          traversal.reach &&
          !traversal.reach.handoffFrom
        ) {
          // E guides the body into real arm reach; capture still uses the
          // calibrated shoulder/hand distance and the normal collision body.
          const reach = traversal.reach;
          siteHandTarget(reach.site, scratch.candidate, position);
          const idealDrop = rootReach(locomotion.current, reach.hand) * 0.86;
          const dx = scratch.candidate.x - position.x;
          const dy = scratch.candidate.y - idealDrop - position.y;
          const dz = scratch.candidate.z - position.z;
          const gain = Math.min(
            8,
            4.8 / Math.max(0.01, Math.hypot(dx, dy, dz)),
          );
          scratch.commandVelocity.x = dx * gain;
          scratch.commandVelocity.y = dy * gain + 0.25;
          scratch.commandVelocity.z = dz * gain;
          hasMovementTarget = true;
        }
        if (grounded || hasMovementTarget || jumping)
          rigid.setLinvel(scratch.commandVelocity, true);
      }
    }

    if (state.map === "islands") {
      const zone =
        position.z > 0 ? 0 : position.z > -15 ? 1 : position.z > -21 ? 2 : 3;
      if (zone !== state.zone) state.configure({ zone });
    }

    const command =
      grabbedCount(traversal) > 0 ? scratch.commandVelocity : rigid.linvel();
    updateLocomotion(
      traversal,
      locomotion.current,
      position,
      command,
      grounded,
    );
    runtime.grounded[id] = locomotion.current.grounded;
    runtime.speeds[id] = locomotion.current.speed;
    runtime.motions[id] = locomotion.current.motion ?? null;
    debug.state = traversal.state;
    debug.handoffCount = traversal.handoffCount;
    debug.closestReachDistance = traversal.closestReachDistance;
    debug.hasLeftAnchor = traversal.hands.left.grabbed;
    debug.hasRightAnchor = traversal.hands.right.grabbed;
    debug.leftConstraintError = traversal.hands.left.constraintError;
    debug.rightConstraintError = traversal.hands.right.constraintError;
    if (debug.hasLeftAnchor)
      copyVector(debug.leftAnchor, traversal.hands.left.support);
    if (debug.hasRightAnchor)
      copyVector(debug.rightAnchor, traversal.hands.right.support);
    debug.hasChosenTarget = !!traversal.reach;
    if (traversal.reach)
      copyVector(
        debug.chosenTarget,
        traversal.hands[traversal.reach.hand].target,
      );
    const radialAnchor = traversal.hands.left.grabbed
      ? traversal.hands.left.support
      : traversal.hands.right.grabbed
        ? traversal.hands.right.support
        : undefined;
    if (radialAnchor)
      decomposeVelocity(
        debug.radialVelocity,
        debug.tangentialVelocity,
        command,
        position,
        radialAnchor,
      );
    else {
      debug.radialVelocity.x =
        debug.radialVelocity.y =
        debug.radialVelocity.z =
          0;
      copyVector(debug.tangentialVelocity, command);
    }
    if (radialAnchor) {
      const radialX = position.x - radialAnchor.x;
      const radialY = position.y - radialAnchor.y;
      const radialZ = position.z - radialAnchor.z;
      const tangent = debug.tangentialVelocity;
      const normal = debug.swingPlaneNormal;
      normal.x = radialY * tangent.z - radialZ * tangent.y;
      normal.y = radialZ * tangent.x - radialX * tangent.z;
      normal.z = radialX * tangent.y - radialY * tangent.x;
      const normalLength = Math.hypot(normal.x, normal.y, normal.z);
      if (normalLength > 1e-6) {
        normal.x /= normalLength;
        normal.y /= normalLength;
        normal.z /= normalLength;
      } else copyVector(normal, basis.right);
    } else {
      debug.swingPlaneNormal.x = 0;
      debug.swingPlaneNormal.y = 0;
      debug.swingPlaneNormal.z = 0;
    }
    for (let index = 0; index < debug.trajectory.length; index += 1)
      ballisticPosition(
        debug.trajectory[index],
        position,
        command,
        WORLD_GRAVITY,
        (index * LOCOMOTION_TUNING.landingPredictionTime) /
          (debug.trajectory.length - 1),
      );
  });

  useAfterPhysicsStep(() => {
    const rigid = body.current;
    if (!running || !rigid) return;
    const position = rigid.translation();
    const velocity = rigid.linvel();
    const collider = capsule.current;
    const previousSurface = locomotion.current.swingSurface;
    locomotion.current.swingSurface = undefined;
    if (map === "phase3" && collider && grabbedCount(controller.current) > 0) {
      let found = false;
      const surface = surfaceRef.current;
      world.contactPairsWith(collider, (other) => {
        if (!other.parent()?.isFixed() || other.isSensor()) return;
        world.contactPair(collider, other, (manifold) => {
          if (
            !manifold.numSolverContacts() ||
            manifold.solverContactDist(0) > 0.035
          )
            return;
          const point = manifold.solverContactPoint(0);
          const normal = manifold.normal();
          const outward =
            (position.x - point.x) * normal.x +
            (position.y - point.y) * normal.y +
            (position.z - point.z) * normal.z;
          if (outward < 0) {
            normal.x *= -1;
            normal.y *= -1;
            normal.z *= -1;
          }
          if (found && normal.y < surface.normal.y) return;
          copyVector(surface.point, point);
          copyVector(surface.normal, normal);
          found = true;
        });
      });
      if (found) {
        const tangent = scratchRef.current.candidate;
        projectTangential(tangent, velocity, surface.normal);
        surface.speed = Math.hypot(tangent.x, tangent.y, tangent.z);
        if (!previousSurface) {
          const hand =
            controller.current.hands[
              grippingHand(controller.current) ?? "left"
            ];
          const towardSupport = scratchRef.current.assistDirection;
          towardSupport.x = hand.support.x - position.x;
          towardSupport.y = hand.support.y - position.y;
          towardSupport.z = hand.support.z - position.z;
          const incoming = scratchRef.current.assistedVelocity;
          surfaceTravelDirection(
            surface.tangent,
            surface.normal,
            incoming,
            towardSupport,
            basisRef.current.forward,
          );
          surface.driveSpeed = Math.max(
            1.8,
            Math.min(4, Math.hypot(incoming.x, incoming.y, incoming.z)),
          );
        } else {
          // Reproject the saved travel direction as the surface curves around
          // a trunk; collision impulses must not reverse the walking gait.
          projectTangential(tangent, surface.tangent, surface.normal);
          normalizeVector(surface.tangent, tangent, basisRef.current.forward);
        }
        surface.phase +=
          (surface.speed * PHYSICS_FIXED_DT * SURFACE_STANCE) / SURFACE_STRIDE;
        locomotion.current.swingSurface = surface;
      }
    }
    runtime.movementDebug[id].hasSwingSurface =
      !!locomotion.current.swingSurface;
    for (const side of ["left", "right"] as const) {
      const hand = controller.current.hands[side];
      updateHandContact(hand, position, locomotion.current, 0);
      runtime.vineContacts[id][side] =
        hand.grabbed && hand.site
          ? { siteId: hand.site.id, grip: hand.contact }
          : null;
    }
    runtime.positions[id].x = position.x;
    runtime.positions[id].y = position.y;
    runtime.positions[id].z = position.z;
    copyVector(runtime.movementDebug[id].position, position);
    copyVector(runtime.movementDebug[id].velocity, velocity);
    if (locomotion.current.velocity)
      copyVector(locomotion.current.velocity, velocity);
  });

  useFrame((_, delta) => {
    runtime.movementDebug[id].renderDelta = delta;
    const visual = model.current;
    if (!running || !visual) return;
    const seatIndex = map === "phase2" ? runtime.phase2Seats.indexOf(id) : -1;
    if (seatIndex >= 0) { visual.rotation.set(0, PHASE_TWO_STOOLS[seatIndex].rotationY, 0); return; }
    const basis = locomotion.current.bodyBasis ?? basisRef.current;
    const scratch = scratchRef.current;
    if (map === "phase3" && !locomotion.current.bodyBasis) {
      const velocity = body.current?.linvel();
      if (velocity && Math.hypot(velocity.x, velocity.z) > 0.12) {
        scratch.targetQuaternion.setFromAxisAngle(
          scratch.basisUp.set(0, 1, 0),
          Math.atan2(velocity.x, velocity.z),
        );
        visual.quaternion.slerp(
          scratch.targetQuaternion,
          1 - Math.exp(-12 * Math.min(delta, 0.05)),
        );
      }
      return;
    }
    // Imported rig axes measured in Blender: +X is character-left, +Y up and
    // +Z forward. Negating physical right produces a proper rotation matrix;
    // using (right, up, forward) here was a reflection, not a quaternion-safe
    // right-handed basis.
    scratch.basisRight.set(-basis.right.x, -basis.right.y, -basis.right.z);
    scratch.basisUp.set(basis.up.x, basis.up.y, basis.up.z);
    scratch.basisForward.set(basis.forward.x, basis.forward.y, basis.forward.z);
    scratch.basisMatrix.makeBasis(
      scratch.basisRight,
      scratch.basisUp,
      scratch.basisForward,
    );
    scratch.targetQuaternion.setFromRotationMatrix(scratch.basisMatrix);
    if (locomotion.current.bodyBasis)
      visual.quaternion.copy(scratch.targetQuaternion);
    else
      visual.quaternion.slerp(
        scratch.targetQuaternion,
        1 - Math.exp(-LOCOMOTION_TUNING.torsoSmoothing * Math.min(delta, 0.05)),
      );
  }, -1);

  return (
    <>
      <RigidBody
        ref={body}
        position={[spawn.x, spawn.y, spawn.z]}
        colliders={false}
        enabledRotations={[false, false, false]}
        friction={0}
        linearDamping={0}
        restitution={0}
        gravityScale={1}
        canSleep={false}
        ccd
      >
        <CapsuleCollider
          ref={capsule}
          args={[CHARACTER_CAPSULE_HALF_HEIGHT, CHARACTER_CAPSULE_RADIUS]}
        />
        <group ref={model} name={`Character_${id}`} rotation={[0, Math.PI, 0]}>
          <Monkey id={id} power={power} locomotion={locomotion} />
        </group>
        <SelectionVine
          id={id}
          power={power}
          running={running}
          locomotion={locomotion}
          active={selected || power}
        />
      </RigidBody>
      <MovementDebug id={id} visible={debugEnabled && selected} />
    </>
  );
}
