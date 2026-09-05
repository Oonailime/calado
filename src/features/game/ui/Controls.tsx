import { useEffect, useRef, type CSSProperties } from "react";
import { MonkeyGlyph } from "@/features/story/SceneArt";
import { runtime, useGame, type Quality } from "../state/store";
import { CHARACTERS, type CharacterId } from "../types";
import type { Locale } from "@/content/story";
import styles from "./Game.module.css";

export default function Controls({
  locale,
  onExit,
}: {
  locale: Locale;
  onExit: () => void;
}) {
  const state = useGame();
  const pt = locale === "pt";
  const first = useRef<HTMLButtonElement>(null);
  const pause = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.paused) first.current?.focus();
  }, [state.paused]);
  const resume = () => {
    state.configure({ paused: false });
    pause.current?.focus();
  };
  const p = state.puzzle;
  const f = state.abilityKey.replace("Key", "");
  let hint = "";
  if (!state.learned.move || !state.learned.camera)
    hint = pt
      ? "WASD / setas · mover     Arraste o mouse · câmera"
      : "WASD / arrows · move     Drag the mouse · camera";
  else if (!state.learned.jump && state.zone === 0)
    hint = pt ? "Espaço · pular" : "Space · jump";
  else if (!p.bridge && state.zone === 1)
    hint =
      p.selected !== 0
        ? pt
          ? "1 · trocar de personagem"
          : "1 · switch character"
        : p.powers[0]
          ? pt
            ? "Troque de personagem · a habilidade continua ativa"
            : "Switch character · the ability stays active"
          : pt
            ? `${f} sobre o símbolo dourado · ativa a habilidade`
            : `${f} over the golden symbol · activates the ability`;
  else if (!p.bridge && state.zone === 2)
    hint = pt
      ? "3 · selecionar     E / Enter · construir"
      : "3 · select     E / Enter · build";
  else if (p.bridge && !p.built && state.zone === 3)
    hint = pt
      ? `1 / 2 / 3 · trocar     ${f} sobre um símbolo · ativa     Troque de personagem para sustentar     E · construir`
      : `1 / 2 / 3 · switch     ${f} over a symbol · activates     Switch character to sustain     E · build`;
  return (
    <>
      <div className={styles.bar}>
        <button
          className={styles.icon}
          aria-label={
            pt
              ? state.muted
                ? "Ativar som"
                : "Desativar som"
              : state.muted
                ? "Enable sound"
                : "Mute sound"
          }
          aria-pressed={!state.muted}
          onClick={() => state.configure({ muted: !state.muted })}
        >
          {state.muted ? "♩" : "♫"}
        </button>
        <button
          className={styles.icon}
          aria-label={pt ? "Reposicionar grupo" : "Reset group"}
          onClick={() => {
            runtime.clear();
            state.reset();
          }}
        >
          ↺
        </button>
        <button
          ref={pause}
          className={styles.icon}
          aria-label={pt ? "Pausa e configurações" : "Pause and settings"}
          onClick={() => {
            runtime.clear();
            state.configure({ paused: true });
          }}
        >
          Ⅱ
        </button>
      </div>
      {hint && !state.paused && (
        <div className={styles.hint} role="status">
          {hint}
        </div>
      )}
      <div
        className={styles.portraits}
        aria-label={pt ? "Selecionar personagem" : "Select character"}
      >
        {CHARACTERS.map((character, id) => (
          <button
            key={id}
            className={styles.portrait}
            style={{ "--character": character.light } as CSSProperties}
            aria-label={`${character.name}${p.sustained[id] ? (pt ? ", habilidade sustentada" : ", ability sustained") : ""}`}
            aria-pressed={p.selected === id}
            onClick={() => state.select(id as CharacterId)}
          >
            <svg viewBox="-60 -80 150 180" aria-hidden="true">
              <MonkeyGlyph color={character.color} pose={character.pose} />
            </svg>
            {p.powers[id] && <span className={styles.sustained} />}
          </button>
        ))}
      </div>
      <button className={styles.exit} onClick={onExit}>
        ESC ↗
      </button>
      {state.paused && (
        <div className={styles.overlay}>
          <div
            ref={dialog}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={pt ? "Configurações de controles" : "Control settings"}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const items = dialog.current?.querySelectorAll<HTMLElement>(
                "button,select,input",
              );
              if (!items?.length) return;
              const first = items[0],
                last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              }
              if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }}
          >
            <h2>{pt ? "Configurações" : "Settings"}</h2>
            <label>
              {pt ? "Qualidade gráfica" : "Graphics quality"}
              <select
                value={state.quality}
                onChange={(e) =>
                  state.configure({ quality: e.target.value as Quality })
                }
              >
                <option value="low">{pt ? "Baixa" : "Low"}</option>
                <option value="medium">{pt ? "Média" : "Medium"}</option>
                <option value="high">{pt ? "Alta" : "High"}</option>
              </select>
            </label>
            <label>
              {pt ? "Volume ambiente" : "Ambient volume"}
              <input
                aria-label={pt ? "Volume ambiente" : "Ambient volume"}
                type="range"
                min="0"
                max="1"
                step=".05"
                value={state.ambientVolume}
                onChange={(e) =>
                  state.configure({ ambientVolume: Number(e.target.value) })
                }
              />
            </label>
            <label>
              {pt ? "Volume de efeitos" : "Effects volume"}
              <input
                aria-label={pt ? "Volume de efeitos" : "Effects volume"}
                type="range"
                min="0"
                max="1"
                step=".05"
                value={state.effectsVolume}
                onChange={(e) =>
                  state.configure({ effectsVolume: Number(e.target.value) })
                }
              />
            </label>
            <label>
              {pt ? "Alto contraste" : "High contrast"}
              <input
                type="checkbox"
                checked={state.contrast}
                onChange={(e) =>
                  state.configure({ contrast: e.target.checked })
                }
              />
            </label>
            <label>
              {pt ? "Reduzir movimento" : "Reduce motion"}
              <input
                type="checkbox"
                checked={state.reduced}
                onChange={(e) => state.configure({ reduced: e.target.checked })}
              />
            </label>
            <label>
              {pt ? "Tecla da habilidade" : "Ability key"}
              <select
                value={state.abilityKey}
                onChange={(e) => {
                  runtime.clear();
                  state.configure({ abilityKey: e.target.value });
                }}
              >
                <option value="KeyF">F</option>
                <option value="KeyG">G</option>
                <option value="KeyH">H</option>
              </select>
            </label>
            <button ref={first} className={styles.resume} onClick={resume}>
              {pt ? "Retomar" : "Resume"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
