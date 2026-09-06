import { useEffect, useRef, useState } from "react";
import { runtime, useGame } from "../state/store";
import { LOCK_CODE } from "../state/rules";
import type { Locale } from "@/content/story";
import { LOCK_HINTS, lockHintsForLocale } from "./lockHints";
import styles from "./Game.module.css";

export default function Lock({
  locale,
  hintCount,
  onRequestHint,
}: {
  locale: Locale;
  hintCount: number;
  onRequestHint: () => void;
}) {
  const pt = locale === "pt";
  const codeProgress = useGame((state) => state.puzzle.codeProgress);
  const revealedHints = lockHintsForLocale(locale, hintCount);
  const [digits, setDigits] = useState<number[]>(() =>
    Array.from({ length: LOCK_CODE.length }, () => 0),
  );
  const digitsRef = useRef(digits);
  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  // Registered once and reads live state on every keypress (getState() for
  // the store, digitsRef for local state) — a fast keystroke sequence would
  // otherwise be handled by a stale closure from before React re-subscribes.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const progress = useGame.getState().puzzle.codeProgress;
      if (e.code === "Escape") {
        e.preventDefault();
        useGame.getState().configure({ lockOpen: false });
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest("button")) return;
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        setDigits((current) =>
          current.map((value, index) =>
            index === progress ? (value + 1) % 10 : value,
          ),
        );
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        setDigits((current) =>
          current.map((value, index) =>
            index === progress ? (value + 9) % 10 : value,
          ),
        );
      }
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        useGame
          .getState()
          .submitLockDigit(runtime.positions[2], digitsRef.current[progress]);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
  return (
    <div className={styles.overlay}>
      <div
        ref={panel}
        tabIndex={-1}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={pt ? "Cadeado do totem" : "Totem padlock"}
        data-hints={hintCount}
      >
        <h2>{pt ? "Cadeado" : "Padlock"}</h2>
        <p className={styles.lockHint}>
          {pt
            ? `Você está resolvendo o algarismo ${codeProgress + 1} de ${LOCK_CODE.length}. Use ↑ ou ↓ para escolher um número, Enter para confirmar e Esc para fechar.`
            : `You are solving digit ${codeProgress + 1} of ${LOCK_CODE.length}. Use ↑ or ↓ to choose a number, Enter to confirm, and Esc to close.`}
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
              {i < codeProgress
                ? LOCK_CODE[i]
                : i === codeProgress
                  ? digit
                  : "–"}
            </span>
          ))}
        </div>
        <p className={styles.lockHint}>
          {pt
            ? "O algarismo foi transmitido por uma sequência de quatro ondas. Se estiver em dúvida, peça as pistas abaixo."
            : "The digit was transmitted as a sequence of four waves. If you are unsure, ask for the clues below."}
        </p>
        <div className={styles.lockHelp}>
          <button
            type="button"
            className={styles.hintButton}
            disabled={hintCount >= LOCK_HINTS.length}
            onClick={onRequestHint}
          >
            {hintCount === 0
              ? pt
                ? "Pedir uma dica"
                : "Ask for a hint"
              : hintCount < LOCK_HINTS.length
                ? pt
                  ? "Pedir a próxima dica"
                  : "Ask for the next hint"
                : pt
                  ? "Todas as dicas foram reveladas"
                  : "All hints have been revealed"}
          </button>
          <ol className={styles.lockHintList} aria-live="polite">
            {revealedHints.map((hint, index) => (
              <li key={hint}>
                <strong>
                  {pt ? "Dica" : "Hint"} {index + 1}/{LOCK_HINTS.length}
                </strong>
                <span>{hint}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
