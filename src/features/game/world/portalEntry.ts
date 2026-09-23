import type { Vec3 } from "../types";
import { PORTAL } from "./layout";

export type PortalAnchor = { x: number; y?: number; z: number; rotationY?: number; halfWidth: number; halfDepth: number; groundInset: number };

export const PORTAL_ENTRY_HALF_WIDTH = 0.95;
export const PORTAL_ENTRY_HALF_DEPTH = 0.7;

export function isInsideOpenPortal(position: Vec3, open: boolean, center: PortalAnchor = PORTAL) {
  const dx = position.x - center.x, dz = position.z - center.z;
  const angle = center.rotationY ?? 0;
  return (
    open &&
    Math.abs(dx * Math.cos(angle) - dz * Math.sin(angle)) <= PORTAL_ENTRY_HALF_WIDTH &&
    Math.abs(dx * Math.sin(angle) + dz * Math.cos(angle)) <= PORTAL_ENTRY_HALF_DEPTH &&
    position.y >= (center.y ?? -center.groundInset) - 0.5 &&
    position.y <= (center.y ?? -center.groundInset) + 4.5
  );
}
