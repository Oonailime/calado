/** The arrival portal is fully gone at three seconds of active map time. */
export function treePortalPresence(elapsed: number, lifetime = 3) {
  const t = Math.max(0, Math.min(1, (elapsed - (lifetime - 1.4)) / 1.4));
  return 1 - t * t * (3 - 2 * t);
}
