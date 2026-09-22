import { CatmullRomCurve3, Vector3 } from "three";
import type { ArborealSite } from "./forestLayout";
import { PHASE_FOUR_FEET_OFFSET, PHASE_FOUR_PLATFORMS, type Point3 } from "./phaseFourLayout";

export const CANOPY_FOCUS_DECK = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "crown")!;

// Keyed by physical position, not by who uses them — gold ties at the lower
// stump (near the bridge's low end) and brown builds at the upper one (near
// its high end); neither stump moves, only which action happens at each.
export const CANOPY_STUMPS = {
  lower: [16.6, 14, -25.5] as Point3,
  upper: [15, 31, -47] as Point3,
};
export const CANOPY_BRIDGE_CURVE = new CatmullRomCurve3([
  [15.7, 14.08, -25], [20, 17.5, -29], [22, 23, -36],
  [19, 28, -43], [14, 31.08, -47],
].map(p => new Vector3(...p)), false, "centripetal");
CANOPY_BRIDGE_CURVE.arcLengthDivisions = 600;

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

export const CANOPY_BRIDGE_SITE: ArborealSite = {
  id: "phase3-cooperative-vine",
  tree: { x: 16.6, z: -25.5, scale: 1, rotationY: 0 },
  climb: { x: 15.7, z: -25, baseY: 14.08 + PHASE_FOUR_FEET_OFFSET,
    topX: 14, topZ: -47, topY: 31.08 + PHASE_FOUR_FEET_OFFSET,
    bidirectional: true, dismount: true },
  vine: { x: 14, z: -47, attachY: 31.08, scale: 1, rotationY: 0, grabbable: false },
};
