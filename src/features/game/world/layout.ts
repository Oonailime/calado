import type { CharacterId, Vec3 } from "../types";

// World-space ground level. Props use this as their local floor, not sea level.
export const ISLAND_SURFACE_Y = 1.2;
export const ISLAND_THICKNESS = 1.2;
export const ISLAND_BASE_Y = ISLAND_SURFACE_Y - ISLAND_THICKNESS;
export const BEACH_RAMP_SCALE = 1.32;
export const BEACH_BRIDGE_SCALE = 1.06;
export const BEACH_SHORE_Y = 0.05;
export const ISLANDS = [
  {
    x: 0,
    z: 1,
    halfWidth: 6,
    halfDepth: 7,
    seed: 4471,
    grass: "#708d4d",
    earth: "#694a31",
  },
  {
    x: 0,
    z: -21,
    halfWidth: 7,
    halfDepth: 8,
    seed: 9142,
    grass: "#637f45",
    earth: "#5e422e",
  },
] as const;

export const BRIDGE = { z: -9.5, length: 7.2, halfWidth: 1.5 } as const;
export const BRIDGE_COLLIDER_HALF_HEIGHT = 0.16;
export const BRIDGE_COLLIDER_CENTER_Y = 0.38;
export const BRIDGE_ORIGIN_Y =
  -BRIDGE_COLLIDER_CENTER_Y - BRIDGE_COLLIDER_HALF_HEIGHT;

export const CHARACTER_CAPSULE_HALF_HEIGHT = 0.28;
export const CHARACTER_CAPSULE_RADIUS = 0.27;
export const CHARACTER_SPAWN_Y =
  ISLAND_SURFACE_Y +
  CHARACTER_CAPSULE_HALF_HEIGHT +
  CHARACTER_CAPSULE_RADIUS +
  0.1;

export function characterSpawn(id: CharacterId, checkpoint = false): Vec3 {
  return {
    x: (id - 1) * 1.45,
    y: CHARACTER_SPAWN_Y,
    z: checkpoint ? -17 : 4 + (id === 2 ? -1 : 1),
  };
}
