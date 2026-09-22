import type { CharacterId } from "../types";

export const CHESS_TROPHIES = [
  { id: "chess-mizaru", opponent: 0, name: "Mizaru", color: "#c7ced1" },
  { id: "chess-kikazaru", opponent: 1, name: "Kikazaru", color: "#ffd565" },
  { id: "chess-iwazaru", opponent: 2, name: "Iwazaru", color: "#e2a06a" },
] as const satisfies readonly { id: string; opponent: CharacterId; name: string; color: string }[];

export type ChessTrophyId = (typeof CHESS_TROPHIES)[number]["id"];
export const CHESS_TROPHIES_STORAGE_KEY = "chessTrophies";

export function readChessTrophies(): ChessTrophyId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(CHESS_TROPHIES_STORAGE_KEY) ?? "[]");
    if (Array.isArray(saved)) return CHESS_TROPHIES.filter(trophy => saved.includes(trophy.id)).map(trophy => trophy.id);
  } catch {}
  return [];
}
