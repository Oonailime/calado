import type { CharacterId, Vec3 } from "../types";

// World-space ground level. Props use this as their local floor, not sea level.
export const ISLAND_SURFACE_Y = 1.2;
export const ISLAND_THICKNESS = 1.2;
export const ISLAND_BASE_Y = ISLAND_SURFACE_Y - ISLAND_THICKNESS;
export const BEACH_RAMP_SCALE = 1.32;
export const BEACH_BRIDGE_SCALE = 1.06;
export const BEACH_SHORE_Y = 0.05;
export const BEACH_SAND_COLOR = "#d2b777";
// Wider islands leave room for denser forests. Their centers move away from
// the river as depth grows, preserving the original bridge-facing shoreline.
export const ISLANDS = [
  {
    x: 0,
    z: 7.25,
    halfWidth: 9,
    halfDepth: 10,
    seed: 4471,
    grass: "#708d4d",
    earth: "#694a31",
  },
  {
    x: 0,
    z: -27.25,
    halfWidth: 10,
    halfDepth: 11,
    seed: 9142,
    grass: "#637f45",
    earth: "#5e422e",
  },
] as const;

// Four extra units of water make a normal running jump fall well short while
// the longer bridge continues to land safely on both beach ramps.
export const BRIDGE = { z: -9.5, length: 11.2, halfWidth: 1.5 } as const;
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
    z: checkpoint ? -19 : 4 + (id === 2 ? -1 : 1),
  };
}
