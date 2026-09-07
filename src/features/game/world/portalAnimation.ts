export const PORTAL_BUILD_DURATION = 4.2;

export function advancePortalConstruction(
  progress: number,
  delta: number,
  built: boolean,
  running: boolean,
  reduced: boolean,
) {
  if (!built) return 0;
  if (reduced) return 1;
  if (!running) return progress;
  return Math.min(1, progress + Math.max(0, delta) / PORTAL_BUILD_DURATION);
}

export function portalConstructionScale(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  const eased = clamped * clamped * (3 - 2 * clamped);
  return {
    horizontal: 0.82 + eased * 0.18,
    vertical: Math.max(0.001, eased),
  };
}
