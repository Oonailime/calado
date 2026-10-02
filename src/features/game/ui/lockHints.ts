import type { Locale } from "@/content/story";

// From where to look, through riddles, to the full method. The waves need
// both powers active and Mizaru selected (see World.tsx's NoiseBarrier); each
// digit is four bits, first wave most significant (soundCode.ts).
export const LOCK_HINTS = [
  {
    pt: "Selecione Mizaru (2), leve-o ao triângulo prateado e ative o poder dele. Depois, ative o poder de Kikazaru (1) no círculo dourado e volte a controlar Mizaru: só ele enxerga as ondas sonoras que saem da barreira perto do cadeado. Observe-as com atenção, porque elas transmitem o algarismo que o cadeado pede.",
    en: "Select Mizaru (2), take him to the silver triangle and activate his power. Then activate Kikazaru's (1) power in the golden circle and switch back to Mizaru: only he can see the sound waves coming from the barrier by the padlock. Watch them closely, as they carry the digit the padlock is asking for.",
  },
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
  {
    pt: "Cada grupo de quatro sinais sonoros é um número binário de 4 bits, e cada grupo representa um algarismo decimal. Converta esses 4 bits para decimal, lendo-os na ordem em que aparecem. Seu computador provavelmente tem uma calculadora que faz essa conversão no modo “Programador”.",
    en: "Each group of four sound signals is a 4-bit binary number, and each group stands for one decimal digit. Convert those 4 bits to decimal, reading them in the order they appear. Your computer probably has a calculator that does this conversion in “Programmer” mode.",
  },
] as const;

export function lockHintsForLocale(locale: Locale, count: number): string[] {
  const revealed = Math.max(0, Math.min(LOCK_HINTS.length, count));
  return LOCK_HINTS.slice(0, revealed).map((hint) => hint[locale]);
}

export function nextLockHintCount(count: number): number {
  return Math.min(LOCK_HINTS.length, Math.max(0, count) + 1);
}
