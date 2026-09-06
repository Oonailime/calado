import type { Locale } from "@/content/story";
export type CharacterId = 0 | 1 | 2;
export type Vec3 = { x: number; y: number; z: number };
export type GameProps = { active: boolean; locale: Locale; onExit: () => void };
export const CHARACTERS = [
  { name: "Mizaru", color: "#c7ced1", light: "#f4f7f8", pose: "eyes" },
  { name: "Kikazaru", color: "#c7942e", light: "#ffd565", pose: "ears" },
  { name: "Iwazaru", color: "#785237", light: "#e2a06a", pose: "mouth" },
] as const;

// The numeric shortcuts follow the visual palette shown in the world:
// 1 = gold, 2 = silver and 3 = bronze.
export const CHARACTER_KEY_BINDINGS = [
  { digit: "1", id: 1 },
  { digit: "2", id: 0 },
  { digit: "3", id: 2 },
] as const satisfies readonly { digit: string; id: CharacterId }[];
