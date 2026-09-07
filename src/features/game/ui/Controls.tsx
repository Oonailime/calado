import { useEffect, useRef, type CSSProperties } from "react";
import { MonkeyGlyph } from "@/features/story/SceneArt";
import { runtime, useGame, type Quality } from "../state/store";
import { CHARACTERS, CHARACTER_KEY_BINDINGS } from "../types";
import type { Locale } from "@/content/story";
import Inventory from "./Inventory";
import styles from "./Game.module.css";

type Instruction = { title: string; body: string };

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
  const instruction = (
    titlePt: string,
    bodyPt: string,
    titleEn: string,
    bodyEn: string,
  ): Instruction =>
    pt ? { title: titlePt, body: bodyPt } : { title: titleEn, body: bodyEn };
  let hint: Instruction | null = null;
  if (!state.learned.move || !state.learned.camera)
    hint = instruction(
      "Explore a ilha",
      "Use WASD ou as setas para caminhar. Clique na tela para olhar ao redor com o mouse; pressione Esc quando quiser liberar o cursor. Aproxime-se de uma banana e pressione E para coletá-la.",
      "Explore the island",
      "Use WASD or the arrow keys to walk. Click the screen to look around with the mouse; press Esc whenever you want to release the cursor. Approach a banana and press E to collect it.",
    );
  else if (!state.learned.jump && state.zone === 0)
    hint = instruction(
      "Aprenda a pular",
      "Pressione Espaço para pular obstáculos. Depois, siga até o símbolo dourado próximo à ponte.",
      "Learn to jump",
      "Press Space to jump over obstacles. Then follow the path to the golden symbol near the bridge.",
    );
  else if (!p.bridge) {
    if (!p.powers[1])
      hint =
        p.selected !== 1
          ? instruction(
              "Primeiro, revele as madeiras",
              "Pressione 1 para controlar Kikazaru, o macaco dourado. Leve-o até o círculo dourado diante da ponte.",
              "First, reveal the timber",
              "Press 1 to control Kikazaru, the golden monkey. Take him to the golden circle in front of the bridge.",
            )
          : instruction(
              "Ative o poder de Kikazaru",
              `Posicione Kikazaru dentro do círculo dourado e pressione ${f}. O poder dele marcará as três madeiras escondidas.`,
              "Activate Kikazaru's power",
              `Place Kikazaru inside the golden circle and press ${f}. His power will mark the three hidden pieces of timber.`,
            );
    else if (!p.logs.every(Boolean))
      hint =
        p.selected !== 2
          ? instruction(
              "Agora, reúna as madeiras",
              "Pressione 3 para controlar Iwazaru. Somente ele consegue recolher as madeiras reveladas por Kikazaru.",
              "Now, gather the timber",
              "Press 3 to control Iwazaru. Only he can collect the timber revealed by Kikazaru.",
            )
          : instruction(
              "Colete as três madeiras",
              "Aproxime Iwazaru de cada palmeira marcada e pressione E ou Enter. O contador no inventário mostra quanto ainda falta.",
              "Collect all three pieces",
              "Take Iwazaru to each marked palm and press E or Enter. The inventory counter shows how many pieces remain.",
            );
    else
      hint =
        p.selected !== 2
          ? instruction(
              "Construa a ponte",
              "Pressione 3 para controlar Iwazaru. As três madeiras coletadas já estão prontas para a construção.",
              "Build the bridge",
              "Press 3 to control Iwazaru. The three collected pieces of timber are ready for construction.",
            )
          : instruction(
              "Construa a ponte",
              "Leve Iwazaru ao totem à direita da ponte e pressione E ou Enter para usar as madeiras.",
              "Build the bridge",
              "Take Iwazaru to the totem on the right of the bridge and press E or Enter to use the timber.",
            );
  } else if (!p.unlocked && state.zone < 3)
    hint = instruction(
      "Atravesse para a segunda ilha",
      "A ponte está pronta. Atravesse-a e siga em frente até encontrar o cadeado e os símbolos dourado e prateado.",
      "Cross to the second island",
      "The bridge is ready. Cross it and continue until you find the padlock and the golden and silver symbols.",
    );
  else if (!p.unlocked && state.zone === 3) {
    if (!p.powers[0])
      hint =
        p.selected !== 0
          ? instruction(
              "Revele a mensagem escondida",
              "Pressione 2 para controlar Mizaru, o macaco prateado, e leve-o até o símbolo prateado.",
              "Reveal the hidden message",
              "Press 2 to control Mizaru, the silver monkey, and take him to the silver symbol.",
            )
          : instruction(
              "Ative o poder de Mizaru",
              `Fique sobre o símbolo prateado e pressione ${f}. Ao trocar de personagem, o poder continuará ativo.`,
              "Activate Mizaru's power",
              `Stand on the silver symbol and press ${f}. His power will remain active when you switch characters.`,
            );
    else if (!p.powers[1])
      hint =
        p.selected !== 1
          ? instruction(
              "Silencie a barreira",
              "Mantenha o poder de Mizaru ativo e pressione 1 para controlar Kikazaru. Leve-o ao símbolo dourado.",
              "Silence the barrier",
              "Keep Mizaru's power active and press 1 to control Kikazaru. Take him to the golden symbol.",
            )
          : instruction(
              "Ative o poder de Kikazaru",
              `Fique sobre o símbolo dourado e pressione ${f}. Com os dois poderes ativos, Mizaru poderá perceber a sequência.`,
              "Activate Kikazaru's power",
              `Stand on the golden symbol and press ${f}. With both powers active, Mizaru will be able to perceive the sequence.`,
            );
    else if (p.selected === 0)
      hint = instruction(
        "Memorize um algarismo",
        "Observe as quatro ondas emitidas em sequência. Cada grupo representa um algarismo. Memorize-o e pressione 3 para usar Iwazaru.",
        "Memorize one digit",
        "Watch the four waves emitted in sequence. Each group represents one digit. Memorize it, then press 3 to use Iwazaru.",
      );
    else if (p.selected === 2)
      hint = instruction(
        "Digite o algarismo memorizado",
        "Aproxime-se do cadeado e pressione E ou Enter. Se precisar observar as ondas novamente, pressione 2 para voltar a Mizaru.",
        "Enter the digit you memorized",
        "Approach the padlock and press E or Enter. To watch the waves again, press 2 to return to Mizaru.",
      );
    else
      hint = instruction(
        "Observe a sequência com Mizaru",
        "Pressione 2 para voltar a Mizaru. Somente ele consegue perceber as quatro ondas que formam cada algarismo.",
        "Observe the sequence with Mizaru",
        "Press 2 to return to Mizaru. Only he can perceive the four waves that form each digit.",
      );
  } else if (p.bridge && p.unlocked && !p.built && state.zone === 3)
    hint =
      p.selected !== 2
        ? instruction(
            "Conclua o ritual",
            "O cadeado está aberto. Pressione 3 para controlar Iwazaru; mantenha os poderes dos outros dois macacos ativos.",
            "Complete the ritual",
            "The padlock is open. Press 3 to control Iwazaru while keeping the other two monkeys' powers active.",
          )
        : instruction(
            "Ative o mecanismo final",
            `Leve Iwazaru ao mecanismo atrás do cadeado e pressione E, Enter ou ${f} para concluir.`,
            "Activate the final mechanism",
            `Take Iwazaru to the mechanism behind the padlock and press E, Enter, or ${f} to finish.`,
          );
  else if (p.built)
    hint = instruction(
      "O portal foi construído",
      "O ritual ergueu um portal no extremo da segunda ilha. Siga além do mecanismo final para encontrá-lo.",
      "The portal has been built",
      "The ritual raised a portal at the far end of the second island. Continue beyond the final mechanism to find it.",
    );
  return (
    <>
      <Inventory locale={locale} />
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
          <strong>{hint.title}</strong>
          <span>{hint.body}</span>
        </div>
      )}
      <div
        className={styles.portraits}
        aria-label={pt ? "Selecionar personagem" : "Select character"}
      >
        {CHARACTER_KEY_BINDINGS.map(({ digit, id }) => {
          const character = CHARACTERS[id];
          return (
            <button
              key={id}
              className={styles.portrait}
              style={{ "--character": character.light } as CSSProperties}
              aria-label={`${character.name}${p.sustained[id] ? (pt ? ", habilidade sustentada" : ", ability sustained") : ""}`}
              aria-keyshortcuts={digit}
              aria-pressed={p.selected === id}
              onClick={() => state.select(id)}
            >
              <span className={styles.characterKey} aria-hidden="true">
                {digit}
              </span>
              <svg viewBox="-60 -80 150 180" aria-hidden="true">
                <MonkeyGlyph color={character.color} pose={character.pose} />
              </svg>
              {p.powers[id] && <span className={styles.sustained} />}
            </button>
          );
        })}
      </div>
      <button
        className={styles.exit}
        onClick={() => {
          runtime.clear();
          state.configure({ paused: true });
        }}
      >
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
            <button className={styles.exitPanel} onClick={onExit}>
              {pt ? "Sair do jogo" : "Exit game"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
