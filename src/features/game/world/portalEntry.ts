import type { Vec3 } from "../types";
import { PORTAL } from "./layout";

export const PORTAL_ENTRY_HALF_WIDTH = 0.95;
export const PORTAL_ENTRY_HALF_DEPTH = 0.7;

export function isInsideOpenPortal(position: Vec3, open: boolean) {
  return (
    open &&
    Math.abs(position.x - PORTAL.x) <= PORTAL_ENTRY_HALF_WIDTH &&
    Math.abs(position.z - PORTAL.z) <= PORTAL_ENTRY_HALF_DEPTH
  );
}
