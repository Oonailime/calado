import type { Locale } from "@/content/story";

export const LOCK_HINTS = [
  {
    pt: "A vida é feita de altos e baixos.",
    en: "Life is made of ups and downs.",
  },
  {
    pt: "Algumas vezes, a vida é preto e branco.",
    en: "Sometimes, life is black and white.",
  },
  {
    pt: "Você deveria estudar binário, com isso você pode contar até 1023 com as mãos",
    en: "You should study binary; with it, you can count to 1023 using your hands.",
  },
] as const;

export function lockHintsForLocale(locale: Locale, count: number): string[] {
  const revealed = Math.max(0, Math.min(LOCK_HINTS.length, count));
  return LOCK_HINTS.slice(0, revealed).map((hint) => hint[locale]);
}

export function nextLockHintCount(count: number): number {
  return Math.min(LOCK_HINTS.length, Math.max(0, count) + 1);
}
