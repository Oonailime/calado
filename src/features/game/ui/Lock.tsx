import { useEffect, useRef, useState } from "react";
import { useTouchDevice } from "@/features/story/useTouchDevice";
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
  const touch = useTouchDevice();
  const codeProgress = useGame((state) => state.puzzle.codeProgress);
  const wrongAttempts = useGame((state) => state.puzzle.wrongAttempts);
  const revealedHints = lockHintsForLocale(locale, hintCount);
  const [digits, setDigits] = useState<number[]>(() =>
    Array.from({ length: LOCK_CODE.length }, () => 0),
  );
  const digitsRef = useRef(digits);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);
  // wrongAttempts persists across opening/closing the dial, so a fresh
  // mount must not treat an already-nonzero count as a brand-new miss.
  const [shake, setShake] = useState(false);
  const previousWrongAttempts = useRef(wrongAttempts);
  useEffect(() => {
    // Compare the counter itself: Strict Mode replays mount effects.
    if (wrongAttempts === previousWrongAttempts.current) return;
    previousWrongAttempts.current = wrongAttempts;
    setShake(true);
    const timeout = setTimeout(() => setShake(false), 900);
    return () => clearTimeout(timeout);
  }, [wrongAttempts]);
  // Registered once and reads live state on every keypress (getState() for
  // the store, digitsRef for local state) — a fast keystroke sequence would
  // otherwise be handled by a stale closure from before React re-subscribes.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const state = useGame.getState();
      if (!state.lockOpen) return;
      const progress = state.puzzle.codeProgress;
      if (e.code === "Escape") {
        e.preventDefault();
        useGame.getState().configure({ lockOpen: false });
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || progress >= LOCK_CODE.length) return;
      const chooseDigit = (digit: number) => {
        const next = digitsRef.current.map((value, index) =>
          index === progress ? digit : value,
        );
        // Keep the next Enter correct even before React renders this change.
        digitsRef.current = next;
        setDigits(next);
      };
      // Read the keypad's physical code too, including when Num Lock is off.
      const typedDigit = /^[0-9]$/.test(e.key)
        ? e.key
        : /^Numpad[0-9]$/.test(e.code)
          ? e.code.slice(-1)
          : null;
      if (typedDigit !== null) {
        e.preventDefault();
        chooseDigit(Number(typedDigit));
        panel.current?.focus();
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest("button")) return;
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        chooseDigit((digitsRef.current[progress] + 1) % 10);
      }
      if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        chooseDigit((digitsRef.current[progress] + 9) % 10);
      }
      if (e.key === "Enter" || e.code === "Space") {
        e.preventDefault();
        // Holding Enter to open the panel must not submit the initial zero.
        if (e.repeat) return;
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
          {touch
            ? pt
              ? `Você está resolvendo o algarismo ${codeProgress + 1} de ${LOCK_CODE.length}. Use os botões abaixo para escolher e confirmar.`
              : `You are solving digit ${codeProgress + 1} of ${LOCK_CODE.length}. Use the buttons below to choose and confirm.`
            : pt
              ? `Você está resolvendo o algarismo ${codeProgress + 1} de ${LOCK_CODE.length}. Digite um número no teclado ou use ↑ e ↓ para escolher. Pressione Enter para confirmar e Esc para fechar.`
              : `You are solving digit ${codeProgress + 1} of ${LOCK_CODE.length}. Type a number on your keyboard or use ↑ and ↓ to choose. Press Enter to confirm and Esc to close.`}
        </p>
        <div
          className={`${styles.lockDigits} ${shake ? styles.lockDigitsShake : ""}`}
        >
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
        <p className={styles.lockError} role="alert">
          {shake
            ? pt
              ? "Algarismo incorreto. Tente novamente."
              : "Incorrect digit. Try again."
            : " "}
        </p>
        <p className={styles.lockHint}>
          {pt
            ? "O algarismo foi transmitido por uma sequência de quatro ondas. Se estiver em dúvida, peça as pistas abaixo."
            : "The digit was transmitted as a sequence of four waves. If you are unsure, ask for the clues below."}
        </p>
        <div className={styles.lockTouch}>
          <button type="button" onClick={() => {
            const next = digitsRef.current.map((value, index) => index === codeProgress ? (value + 9) % 10 : value);
            digitsRef.current = next;
            setDigits(next);
          }} aria-label={pt ? "Diminuir algarismo" : "Decrease digit"}>−</button>
          <button type="button" onClick={() => {
            const next = digitsRef.current.map((value, index) => index === codeProgress ? (value + 1) % 10 : value);
            digitsRef.current = next;
            setDigits(next);
          }} aria-label={pt ? "Aumentar algarismo" : "Increase digit"}>+</button>
          <button type="button" onClick={() => useGame.getState().submitLockDigit(runtime.positions[2], digitsRef.current[codeProgress])}>
            {pt ? "Confirmar" : "Confirm"}
          </button>
          <button type="button" onClick={() => useGame.getState().configure({ lockOpen: false })}>{pt ? "Fechar" : "Close"}</button>
        </div>
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
