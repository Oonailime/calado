import { CHESS_TROPHIES } from "./chessTrophies";

export const BANANA_TROPHY = {
  id: "all-bananas",
  name: "Todas as bananas",
  color: "#f2c94c",
} as const;

export const TROPHIES = [...CHESS_TROPHIES, BANANA_TROPHY] as const;
export type TrophyId = (typeof TROPHIES)[number]["id"];
export const BANANA_TROPHY_STORAGE_KEY = "allBananasTrophy";

export function readBananaTrophy() {
  try {
    return localStorage.getItem(BANANA_TROPHY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
