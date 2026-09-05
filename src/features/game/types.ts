import type { Locale } from "@/content/story";
export type CharacterId = 0 | 1 | 2;
export type Vec3 = { x: number; y: number; z: number };
export type GameProps = { active: boolean; locale: Locale; onExit: () => void };
export const CHARACTERS = [
  { name: "Mizaru", color: "#bd914e", light: "#ffcf69", pose: "eyes" },
  { name: "Kikazaru", color: "#d3d4c6", light: "#ebf3df", pose: "ears" },
  { name: "Calado", color: "#785237", light: "#e2a06a", pose: "mouth" },
] as const;
