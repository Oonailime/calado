import { CatmullRomCurve3, Vector3 } from "three";
import type { ArborealSite } from "./forestLayout";
import { PHASE_FOUR_FEET_OFFSET, PHASE_FOUR_PLATFORMS, type Point3 } from "./phaseFourLayout";

export const CANOPY_FOCUS_DECK = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "crown")!;

// Both anchors sit inside the left corners, clear of the deck approaches.
export const CANOPY_STUMPS = {
  lower: [11.25, 14, -25.6] as Point3,
  upper: [9.25, 31, -46] as Point3,
};
// One straight span rests on the tops of both stumps. Rendering and the
// character's route share these endpoints, including their height.
export const CANOPY_BRIDGE_ENDPOINTS = [CANOPY_STUMPS.lower, CANOPY_STUMPS.upper]
  .map(([x, y, z]) => new Vector3(x, y + 1.14, z));
export const CANOPY_BRIDGE_CURVE = new CatmullRomCurve3([
  CANOPY_BRIDGE_ENDPOINTS[0],
  CANOPY_BRIDGE_ENDPOINTS[0].clone().lerp(CANOPY_BRIDGE_ENDPOINTS[1], 0.5),
  CANOPY_BRIDGE_ENDPOINTS[1],
], false, "centripetal");
CANOPY_BRIDGE_CURVE.arcLengthDivisions = 600;

// The pedestal has eight flat faces, rotated so one faces the approach.
// Place each prism's centre on a face: exactly half projects out of the stone.
export const CANOPY_PEDESTAL_ROTATION = Math.PI / 8;
export const CANOPY_PRISM_HEIGHT = 0.5;
const pedestalRadius = 1.55 + (1.3 - 1.55) * CANOPY_PRISM_HEIGHT / 0.7;
const pedestalApothem = pedestalRadius * Math.cos(Math.PI / 8);
export const CANOPY_PRISM_SOCKETS = [-Math.PI / 4, 0, Math.PI / 4].map(angle => ({
  angle,
  position: [Math.sin(angle) * pedestalApothem, CANOPY_PRISM_HEIGHT,
    Math.cos(angle) * pedestalApothem] as Point3,
}));

/** The three tree-hanging vines actually built as their own toggleable
 * objects (see HARVESTABLE_TREE_VINES in phaseFourAssets.ts) rather than
 * fused into their tree's static decoration batch — the earlier version of
 * this used the path-side liana ties instead, which hung right against the
 * walking branch itself and were effectively invisible/unreachable from the
 * deck above. These ids and positions were measured against that same
 * tree-vine curve (treeVineCurvePoints, same file) and checked live against
 * the actual in-game character position at each spot — keep both in sync by
 * hand if the trees or vine indices ever change. */
export const CANOPY_HARVESTS: { id: string; position: Point3 }[] = [
  { id: "tree-vine-a", position: [27.18, 9.61, -4.44] },
  { id: "tree-vine-b", position: [27.95, 9.4, -1.95] },
  { id: "tree-vine-c", position: [-21.34, 13.52, -4.83] },
];

const [lowerEnd, upperEnd] = CANOPY_BRIDGE_ENDPOINTS;
export const CANOPY_BRIDGE_SITE: ArborealSite = {
  id: "phase3-cooperative-vine",
  tree: { x: CANOPY_STUMPS.lower[0], z: CANOPY_STUMPS.lower[2], scale: 1, rotationY: 0 },
  climb: { x: lowerEnd.x, z: lowerEnd.z, baseY: lowerEnd.y + PHASE_FOUR_FEET_OFFSET,
    topX: upperEnd.x, topZ: upperEnd.z, topY: upperEnd.y + PHASE_FOUR_FEET_OFFSET,
    bidirectional: true, dismount: true },
  vine: { x: upperEnd.x, z: upperEnd.z, attachY: upperEnd.y, scale: 1, rotationY: 0, grabbable: false },
};
