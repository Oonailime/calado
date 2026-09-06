// The current bridge GLB contains 28 disconnected pieces (deck planks, posts
// and rails). Keeping this documented also catches accidental asset changes.
export const BRIDGE_PIECE_COUNT = 28;
export const BRIDGE_BUILD_DURATION = 3.2;

const STAGGER_SHARE = 0.58;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

// Every section starts after the previous one, but they overlap enough for the
// construction to read as one continuous flow rather than many slow steps.
export function bridgePieceProgress(
  index: number,
  total: number,
  constructionProgress: number,
) {
  const delay = total > 1 ? (index / (total - 1)) * STAGGER_SHARE : 0;
  const linear = clamp01(
    (clamp01(constructionProgress) - delay) / (1 - STAGGER_SHARE),
  );
  // Quartic ease-out: cover most of the long trip immediately, then shed
  // speed continuously as the timber approaches its exact socket.
  return 1 - (1 - linear) ** 4;
}

export type BridgePieceTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export function bridgePieceTransform(
  index: number,
  total: number,
  constructionProgress: number,
): BridgePieceTransform {
  const progress = bridgePieceProgress(index, total, constructionProgress);
  const remaining = 1 - progress;
  if (remaining <= 0)
    return { position: [0, 0, 0], rotation: [0, 0, 0] };
  const side = index % 2 === 0 ? 1 : -1;

  return {
    // The model's local -X points toward the first island after its final
    // rotation. Pieces begin far inland and high above the ground, alternating
    // sides so they remain visually distinct during the rapid approach.
    position: [
      -(7.2 + (index % 4) * 0.85) * remaining,
      ((3.2 + (index % 5) * 0.38) * remaining +
        Math.sin(progress * Math.PI) * 0.42),
      side * (4.1 + (index % 3) * 0.7) * remaining,
    ],
    rotation: [
      side * 0.18 * remaining,
      ((index % 3) - 1) * 0.3 * remaining,
      side * 0.42 * remaining,
    ],
  };
}
