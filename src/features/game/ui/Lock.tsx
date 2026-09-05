import { useEffect, useRef, useState } from "react";
import { runtime, useGame } from "../state/store";
import { LOCK_CODE } from "../state/rules";
import type { Locale } from "@/content/story";
import styles from "./Game.module.css";

export default function Lock({ locale }: { locale: Locale }) {
  const pt = locale === "pt";
  const codeProgress = useGame((state) => state.puzzle.codeProgress);
  const [digits, setDigits] = useState<number[]>(() =>
    Array.from({ length: LOCK_CODE.length }, () => 0),
  );
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        useGame.getState().configure({ lockOpen: false });
        return;
      }
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        setDigits((current) =>
          current.map((value, index) =>
            index === codeProgress ? (value + 1) % 10 : value,
          ),
        );
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        setDigits((current) =>
          current.map((value, index) =>
            index === codeProgress ? (value + 9) % 10 : value,
          ),
        );
      }
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        useGame
          .getState()
          .submitLockDigit(runtime.positions[2], digits[codeProgress]);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [codeProgress, digits]);
  return (
    <div className={styles.overlay}>
      <div
        ref={panel}
        tabIndex={-1}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={pt ? "Cadeado do totem" : "Totem padlock"}
      >
        <h2>{pt ? "Cadeado" : "Padlock"}</h2>
        <p className={styles.lockHint}>
          {pt
            ? "↑/↓ muda o algarismo atual · Enter confirma · Esc cancela"
            : "↑/↓ changes the current digit · Enter confirms · Esc cancels"}
        </p>
        <div className={styles.lockDigits}>
          {digits.map((digit, i) => (
            <span
              key={i}
              data-state={
                i < codeProgress
                  ? "correct"
                  : i === codeProgress
                    ? "current"
                    : "locked"
              }
              aria-label={
                i < codeProgress
                  ? pt
                    ? `Algarismo ${i + 1} correto`
                    : `Digit ${i + 1} correct`
                  : i === codeProgress
                    ? pt
                      ? `Algarismo ${i + 1} atual`
                      : `Digit ${i + 1} current`
                    : pt
                      ? `Algarismo ${i + 1} bloqueado`
                      : `Digit ${i + 1} locked`
              }
              className={`${styles.lockDigit} ${
                i < codeProgress
                  ? styles.lockDigitCorrect
                  : i === codeProgress
                    ? styles.lockDigitActive
                    : styles.lockDigitLocked
              }`}
            >
              {i < codeProgress ? LOCK_CODE[i] : i === codeProgress ? digit : "–"}
            </span>
          ))}
        </div>
        <p className={styles.lockHint}>
          {pt
            ? "Somente o Mizaru (cego) consegue perceber ondas sonoras."
            : "Only Mizaru (blind) can perceive the sound waves."}
        </p>
      </div>
    </div>
  );
}
