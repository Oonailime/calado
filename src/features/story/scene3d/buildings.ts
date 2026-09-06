export type BuildingId =
  | "birth"
  | "school"
  | "science"
  | "engineering"
  | "work"
  | "mobility";

export const BUILDING_DIR = "/assets/models/buildings/";
export const PLANTER_URL = `${BUILDING_DIR}PlanterBox_Pink01.glb`;
export const SCHOOL_URL = "/assets/models/school/schoolhouse.glb";
export const BUSINESS_URL = "/assets/models/business/business-building.glb";

export const BUILDING_ORDER: readonly BuildingId[] = [
  "birth",
  "school",
  "science",
  "engineering",
  "work",
  "mobility",
];

export function buildingIndex(id: BuildingId): number {
  return BUILDING_ORDER.indexOf(id);
}

// Which asset/component renders each beat: the original snap-together house
// kit only remains for "birth" — school/science/engineering/mobility reuse
// the one schoolhouse model (with its bell + door animations) re-labeled per
// beat, and "work" uses the business-building model instead.
export type BuildingKind = "kit" | "school" | "business";
export const BUILDING_KIND: Record<BuildingId, BuildingKind> = {
  birth: "kit",
  school: "school",
  science: "school",
  engineering: "school",
  work: "business",
  mobility: "school",
};

export const BUILDING_LABELS: Record<BuildingId, { pt: string; en: string }> = {
  birth: { pt: "Início", en: "Home" },
  school: { pt: "Escola", en: "School" },
  science: { pt: "UFBA - C&T", en: "UFBA - C&T" },
  engineering: { pt: "UFBA - Computação", en: "UFBA - Computer" },
  work: { pt: "Trabalho", en: "Work" },
  mobility: { pt: "UFMG", en: "UFMG" },
};

type BuildingParts = {
  house: string;
  roof: string;
  door: string;
  window: string;
};

// One color family per beat, all parts sharing that family's local transform
// (this kit is a modular snap-together set — same part number, same origin).
// Not every color exists for every part (e.g. no Orange roof, no Blue/White
// roof) — the fallbacks below were confirmed against the real file listing.
export const BUILDINGS: Record<BuildingId, BuildingParts> = {
  birth: {
    house: "House01_White_Black.glb",
    roof: "Roof01_White_Black.glb",
    door: "Door01_White_Black.glb",
    window: "Window01_White_Black.glb",
  },
  school: {
    house: "House01_Orange_Wood.glb",
    roof: "Roof01_Wood.glb",
    door: "Door01_Orange_Wood.glb",
    window: "Window01_Orange_Wood.glb",
  },
  science: {
    house: "House02_Blue_Wood.glb",
    roof: "Roof02_Blue.glb",
    door: "Door02_Blue_Wood.glb",
    window: "Window02_Blue_Wood.glb",
  },
  engineering: {
    house: "House02_Blue_White.glb",
    roof: "Roof02_Blue.glb",
    door: "Door02_Blue_White.glb",
    window: "Window02_Blue_White.glb",
  },
  work: {
    house: "House03_Green.glb",
    roof: "Roof03_Green_Wood.glb",
    door: "Door03_Green_Wood.glb",
    window: "Window03_Green_Wood.glb",
  },
  mobility: {
    house: "House03_Black.glb",
    roof: "Roof03_Black_White.glb",
    door: "Door03_Black_White.glb",
    window: "Window03_Black_White.glb",
  },
};
