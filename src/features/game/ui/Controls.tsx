import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { MonkeyGlyph } from "@/features/story/SceneArt";
import { runtime, useGame, type Quality } from "../state/store";
import { CHARACTERS, CHARACTER_KEY_BINDINGS, type CharacterId } from "../types";
import type { Locale } from "@/content/story";
import Inventory from "./Inventory";
import { phase2Chess } from "../world/phase2Chess";
import { canopyInteractionHint, type CanopyInteractionHint } from "../state/rules";
import { PHASE_FOUR_PLATFORMS } from "../world/phaseFourLayout";
import { brownPrismGuidance, canopyRouteGuidance, onBrownPrismDeck, onShrineDeck, shrineGuidance } from "./canopyGuidance";
import styles from "./Game.module.css";

type Instruction = { title: string; body: string };
const HIGH_PLATEAU = PHASE_FOUR_PLATFORMS.find(deck => deck.id === "vine-plateau")!;
// Matches CHARACTERS' order — each monkey's own cube-piece colour.
const CUBE_PIECE_NAMES: Record<CharacterId, { pt: string; en: string }> = {
  0: { pt: "branca", en: "white" },
  1: { pt: "amarela", en: "yellow" },
  2: { pt: "marrom", en: "brown" },
};

function MovementDebugPanel() {
  const output = useRef<HTMLPreElement>(null);
  // requestAnimationFrame counts actual browser paint frames, independent of
  // the R3F render loop's per-frame delta (which this panel only samples
  // every 100ms below) — a much steadier FPS reading than 1/renderDelta.
  const fps = useRef(0);
  useEffect(() => {
    let frames = 0,
      last = performance.now(),
      raf: number;
    const tick = (now: number) => {
      frames++;
      if (now - last >= 500) {
        fps.current = (frames * 1_000) / (now - last);
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const update = () => {
      const element = output.current;
      if (!element) return;
      const id = useGame.getState().puzzle.selected;
      const map = useGame.getState().map;
      const frame = runtime.movementDebug[id];
      const formatVector = (value: { x: number; y: number; z: number }) =>
        `${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}`;
      element.textContent = [
        `${fps.current.toFixed(0)} fps  map ${map}  pos ${formatVector(frame.position)}`,
        `${frame.state}  physics ${(frame.physicsDt * 1_000).toFixed(2)}ms  render ${(frame.renderDelta * 1_000).toFixed(2)}ms`,
        `v ${formatVector(frame.velocity)}`,
        `g ${formatVector(frame.gravity)}`,
        `radial ${formatVector(frame.radialVelocity)}`,
        `tangent ${formatVector(frame.tangentialVelocity)}`,
        `swing plane n ${formatVector(frame.swingPlaneNormal)}`,
        `L arm ${frame.leftArmLength.toFixed(3)}/${frame.leftArmMax.toFixed(3)}  error ${frame.leftConstraintError.toFixed(4)}`,
        `R arm ${frame.rightArmLength.toFixed(3)}/${frame.rightArmMax.toFixed(3)}  error ${frame.rightConstraintError.toFixed(4)}`,
        `candidates ${frame.candidateCount}  target ${frame.hasChosenTarget ? "yes" : "no"}  handoffs ${frame.handoffCount}`,
      ].join("\n");
    };
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, []);
  return <pre ref={output} className={styles.movementDebug} aria-live="off" />;
}

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
  const chess = useSyncExternalStore(phase2Chess.subscribe, phase2Chess.getSnapshot, phase2Chess.getSnapshot);
  const f = state.abilityKey.replace("Key", "");
  // Player position lives in `runtime` (per-frame data, not React state — see
  // store.ts), so a plain state subscription never notices proximity to a
  // stump/harvest site. Poll it at a coarse, UI-appropriate rate instead of
  // wiring this panel into the physics frame loop.
  const [canopyContext, setCanopyContext] = useState<{
    near: CanopyInteractionHint | null;
    highPlateau: boolean;
    shrine: boolean;
    brownPrismDeck: boolean;
    motion: string | null;
  }>({ near: null, highPlateau: false, shrine: false, brownPrismDeck: false, motion: null });
  useEffect(() => {
    if (state.map !== "phase3" || state.paused) return;
    const timer = window.setInterval(() => {
      const puzzle = useGame.getState().puzzle;
      const position = runtime.positions[puzzle.selected];
      const deck = HIGH_PLATEAU;
      setCanopyContext({
        near: canopyInteractionHint(puzzle, position),
        shrine: onShrineDeck(position),
        brownPrismDeck: onBrownPrismDeck(position),
        highPlateau:
          Math.abs(position.x - deck.center[0]) <= deck.width / 2 + 0.5 &&
          Math.abs(position.z - deck.center[2]) <= deck.depth / 2 + 0.5 &&
          Math.abs(position.y - (deck.center[1] + 0.55)) < 2.5,
        motion: runtime.motions[puzzle.selected],
      });
    }, 150);
    return () => window.clearInterval(timer);
  }, [state.map, state.paused]);
  const instruction = (
    titlePt: string,
    bodyPt: string,
    titleEn: string,
    bodyEn: string,
  ): Instruction =>
    pt ? { title: titlePt, body: bodyPt } : { title: titleEn, body: bodyEn };
  let hint: Instruction | null = null;
  if (state.map === "phase2") {
    if (!chess.tabOpen) hint = chess.historicalSolved
      ? instruction("Fase 2 · Portal aberto", "Vá ao portal da cerejeira para a fase 3. A mesa continua disponível para partidas livres.",
          "Phase 2 · Portal open", "Enter the cherry tree portal for phase 3. The chess table is open for free games.")
      : instruction("Fase 2 · Caminho", "WASD: andar · Espaço: saltar a lava · 1/2/3: trocar macaco. Siga para a cerejeira.",
          "Phase 2 · Path", "WASD: move · Space: jump over lava · 1/2/3: switch monkey. Head for the cherry tree.");
  } else if (state.map === "phase3") {
    const route = canopyRouteGuidance(p, pt);
    const { near, highPlateau, shrine, brownPrismDeck, motion } = canopyContext;
    if (p.cubeSolved) hint = null;
    else if (motion === "vine-swing" || motion === "vine-grab")
      hint = instruction("Balanço no cipó", "WASD: balançar · E: alcançar o próximo cipó · Shift/Alt: subir/descer · Espaço: soltar.",
        "Swinging on a vine", "WASD: swing · E: reach the next vine · Shift/Alt: climb up/down · Space: release.");
    else if (motion === "vine-walk")
      hint = instruction("Travessia no cipó", "WASD: caminhe pelo cipó; inverta a direção para voltar.",
        "Walking the vine", "WASD: cross the vine; reverse direction to go back.");
    else if (shrine)
      hint = shrineGuidance(p, pt);
    else if (brownPrismDeck && !p.cubeDelivered[2])
      hint = brownPrismGuidance(p, pt);
    else if (p.cubePieces[2] && !p.cubeDelivered[2])
      hint = brownPrismGuidance(p, pt);
    else if (p.cubeDelivered.every(Boolean))
      hint = instruction("Os três prismas foram entregues", "Vá ao totem do cume e pressione E para abrir o cubo.",
        "All three prisms delivered", "Go to the summit shrine and press E to open the cube.");
    else if (near)
      hint = instruction("Ação próxima", near.pt, "Nearby action", near.en);
    else if (highPlateau)
      hint = instruction("Platô alto · cipós pendulares", "Com Iwazaru (3), vá à borda e pressione E para agarrar o cipó. WASD balança; E alcança o próximo.",
        "High plateau · swinging vines", "With Iwazaru (3), go to the edge and press E to grab the vine. WASD swings; E reaches the next one.");
    else if (route)
      hint = route;
    else if (p.cubePieces[p.selected] && !p.cubeDelivered[p.selected])
      hint = instruction("Entregar o prisma", "Leve seu prisma ao totem e pressione E para entregá-lo.",
        "Deliver the prism", "Take your prism to the shrine and press E to deliver it.");
    else if (p.cubeDelivered[p.selected])
      hint = instruction("Prisma entregue", "Troque para um macaco que ainda precisa entregar o prisma.",
        "Prism delivered", "Switch to a monkey that still needs to deliver a prism.");
    else {
      const color = CUBE_PIECE_NAMES[p.selected];
      const location = p.selected === 0 ? ["na Copa alta", "on the High Canopy deck"]
        : p.selected === 1 ? ["no mirante da cachoeira", "at the waterfall lookout"]
          : ["no cume atrás da cachoeira", "on the summit behind the waterfall"];
      hint = instruction("Coletar prisma", `Com este macaco, pressione E junto ao prisma ${color.pt} ${location[0]}.`,
        "Collect prism", `With this monkey, press E by the ${color.en} prism ${location[1]}.`);
    }
  } else if (!state.learned.move || !state.learned.camera)
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
              "Pressione 1 para controlar Kikazaru. Leve-o até o círculo dourado diante da ponte.",
              "First, reveal the timber",
              "Press 1 to control Kikazaru. Take him to the golden circle in front of the bridge.",
            )
          : instruction(
              "Ative o poder de Kikazaru (1)",
              `Posicione Kikazaru (1) dentro do círculo dourado e pressione ${f}. O poder dele marcará as três madeiras escondidas.`,
              "Activate Kikazaru's power (1)",
              `Place Kikazaru (1) inside the golden circle and press ${f}. His power will mark the three hidden pieces of timber.`,
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
              "Aproxime Iwazaru (3) de cada palmeira marcada e pressione E ou Enter. O contador no inventário mostra quanto ainda falta.",
              "Collect all three pieces",
              "Take Iwazaru (3) to each marked palm and press E or Enter. The inventory counter shows how many pieces remain.",
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
              "Leve Iwazaru (3) ao totem à direita da ponte e pressione E ou Enter para usar as madeiras.",
              "Build the bridge",
              "Take Iwazaru (3) to the totem on the right of the bridge and press E or Enter to use the timber.",
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
              "Ative o poder de Mizaru (2)",
              `Fique sobre o símbolo prateado e pressione ${f}. Ao trocar de personagem, o poder continuará ativo.`,
              "Activate Mizaru's power (2)",
              `Stand on the silver symbol and press ${f}. His power will remain active when you switch characters.`,
            );
    else if (!p.powers[1])
      hint =
        p.selected !== 1
          ? instruction(
              "Silencie a barreira",
              "Mantenha o poder de Mizaru (2) ativo e pressione 1 para controlar Kikazaru. Leve-o ao símbolo dourado.",
              "Silence the barrier",
              "Keep Mizaru (2)'s power active and press 1 to control Kikazaru. Take him to the golden symbol.",
            )
          : instruction(
              "Ative o poder de Kikazaru (1)",
              `Fique sobre o símbolo dourado e pressione ${f}. Com os dois poderes ativos, Mizaru (2) poderá perceber a sequência.`,
              "Activate Kikazaru's power (1)",
              `Stand on the golden symbol and press ${f}. With both powers active, Mizaru (2) will be able to perceive the sequence.`,
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
        "Observe a sequência com Mizaru (2)",
        "Pressione 2 para voltar a Mizaru. Somente ele consegue perceber as quatro ondas que formam cada algarismo.",
        "Observe the sequence with Mizaru (2)",
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
            `Leve Iwazaru (3) ao mecanismo atrás do cadeado e pressione E, Enter ou ${f} para concluir.`,
            "Activate the final mechanism",
            `Take Iwazaru (3) to the mechanism behind the padlock and press E, Enter, or ${f} to finish.`,
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
            if (state.map === "phase2") { phase2Chess.stop(); runtime.phase2Restore.fill(null); }
            runtime.clear();
            state.reset();
          }}
        >
          ↺
        </button>
        <button
          className={styles.icon}
          aria-label={pt ? "Debug de movimentação" : "Movement debug"}
          aria-pressed={state.movementDebug}
          aria-keyshortcuts="`"
          onClick={() =>
            state.configure({ movementDebug: !state.movementDebug })
          }
        >
          ∿
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
      {state.movementDebug && <MovementDebugPanel />}
      {hint && !state.paused && !state.cubePuzzleOpen && (
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
                <option value="ultra">Ultra</option>
              </select>
            </label>
            <p className={styles.controlHelp}>
              {pt
                ? "Fase 2: as bases das árvores são checkpoints. Pressione E no tronco ou cipó; durante o balanço, use Espaço para saltar e os galhos largos para deslizar. O modo Ultra acrescenta vegetação densa."
                : "Stage 2: tree bases are checkpoints. Press E at a trunk or vine; while swinging, use Space to jump and broad branches to slide. Ultra mode adds dense vegetation."}
            </p>
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
