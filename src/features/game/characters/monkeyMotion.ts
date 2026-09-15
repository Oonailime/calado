export type MonkeyMotion =
  | "biped-walk"
  | "tree-climb"
  | "tree-descend"
  | "vine-grab"
  | "vine-swing"
  | "vine-jump"
  // Hand-over-hand pull up a hanging liana, distinct from tree-climb's
  // flat-against-the-trunk pose - not part of the animation-studio catalog
  // since it has no baked reference clip, only the procedural pose below.
  | "vine-pull";

export type LocomotionState =
  | "GROUND"
  | "RUN"
  | "JUMP"
  | "FLIGHT"
  | "REACH"
  | "SWING_ONE_HAND"
  | "SWING_TWO_HANDS"
  | "HANDOFF"
  | "RELEASE"
  | "LANDING"
  | "CLIMB";

export type HandLocomotion = {
  grabbed: boolean;
  reaching: boolean;
  anchor?: { x: number; y: number; z: number };
  target?: { x: number; y: number; z: number };
  /** Fixed-step wrist trajectory, including the free-hand recovery. */
  point?: { x: number; y: number; z: number };
  reachProgress?: number;
  constraintLength?: number;
  maxLength?: number;
  constraintError?: number;
};

// Exact baked action used by the game before the procedural rebuild. It is a
// permanent fallback/selection, not a temporary source to be overwritten.
export const CLASSIC_QUADRUPED_CLIP = "monkey_run";

// Keep the existing route/catalogue key, but let the original mixer animate
// ground travel. Only climbing and vine motions replace its bone transforms.
export function proceduralMonkeyMotion(motion: MonkeyMotion | undefined) {
  return motion === "biped-walk" ? undefined : motion;
}

export const MONKEY_ANIMATION_PREVIEWS = [
  {
    motion: "biped-walk",
    title: "Caminhada original",
    file: "macaco-andando-bipede.webm",
    duration: 4,
  },
  {
    motion: "tree-climb",
    title: "Escalando a árvore",
    file: "macaco-escalando-arvore.webm",
    duration: 4,
  },
  {
    motion: "tree-descend",
    title: "Descendo da árvore",
    file: "macaco-descendo-arvore.webm",
    duration: 4,
  },
  {
    motion: "vine-swing",
    title: "Balançando no cipó",
    file: "macaco-balancando-cipo.webm",
    duration: 5,
  },
  {
    motion: "vine-jump",
    title: "Pulando do cipó",
    file: "macaco-pulando-cipo.webm",
    duration: 4,
  },
  {
    motion: "vine-grab",
    title: "Agarrando o cipó",
    file: "macaco-agarrando-cipo.webm",
    duration: 6.2,
  },
] as const satisfies readonly {
  motion: MonkeyMotion;
  title: string;
  file: string;
  duration: number;
}[];

export const MONKEY_MOTIONS = MONKEY_ANIMATION_PREVIEWS.map(
  ({ motion }) => motion,
) as MonkeyMotion[];

export function isMonkeyMotion(value: string): value is MonkeyMotion {
  return MONKEY_MOTIONS.includes(value as MonkeyMotion);
}

export function motionPhase(motion: MonkeyMotion, elapsed: number) {
  const speed =
    motion === "biped-walk"
      ? 5.2
      : motion === "tree-climb" || motion === "tree-descend"
        ? 4.4
        : 2.7;
  const direction = motion === "tree-descend" ? -1 : 1;
  return elapsed * speed * direction;
}

export type MonkeyLocomotion = {
  speed: number;
  grounded: boolean;
  classicGroundMotion?: boolean;
  state?: LocomotionState;
  velocity?: { x: number; y: number; z: number };
  forward?: { x: number; y: number; z: number };
  right?: { x: number; y: number; z: number };
  up?: { x: number; y: number; z: number };
  /** Body orientation is separate from travel: shoulders run along the vine. */
  bodyBasis?: import("./brachiationPhysics").LocalBasis;
  swingSurface?: import("./swingSurface").SwingSurface;
  hands?: { left: HandLocomotion; right: HandLocomotion };
  armLengthLeft?: number;
  armLengthRight?: number;
  rootReachLeft?: number;
  rootReachRight?: number;
  /**
   * Neutral-pose shoulder origins in the character root's local space.  They
   * are calibrated once from the imported skeleton; animated/rendered bones
   * must never become an input to the fixed-step capture test.
   */
  shoulderOffsetLeft?: { x: number; y: number; z: number };
  shoulderOffsetRight?: { x: number; y: number; z: number };
  distance?: number;
  metersPerStride?: number;
  motion?: MonkeyMotion;
  // Time since the current state began. Unlike motionTime, this does not
  // preserve the preceding swing phase after a vine release.
  motionElapsed?: number;
  motionTime?: number;
  // World-space point where the final rope fragment meets the gripping
  // hand(s). Read by both the reference-rig IK and the legacy Verlet solve.
  vineAnchor?: { x: number; y: number; z: number };
  // Phase-three brachiation alternates one fixed support hand with the free
  // hand reaching toward the following support. Both targets are world-space
  // so IK remains locked to the authored vines while the body moves below.
  previousVineAnchor?: { x: number; y: number; z: number };
  nextVineAnchor?: { x: number; y: number; z: number };
  brachiationProgress?: number;
  gripHand?: "left" | "right";
  // Shared physical pendulum data. The phase is derived from the same elapsed
  // value that bends the segmented vine instead of running a second animation
  // clock inside the character model.
  swingAngle?: number;
  swingAngularVelocity?: number;
  // Seconds spent grabbed with nothing in progress (no reach/handoff). Drives
  // the idle vine-hang fidget once it passes a threshold.
  idleElapsed?: number;
  // -1 climbing up a held rope, 1 paying it out, 0 otherwise (see
  // applyVineClimbControl). Boosts the leg pump so climbing reads as active
  // effort even while the pendulum itself is nearly still.
  climbRate?: number;
};
