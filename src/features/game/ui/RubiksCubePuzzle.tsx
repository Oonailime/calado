import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/story";
import { runtime, useGame } from "../state/store";
import {
  faceMove,
  RESTING_FACE_BASIS,
  stepFaceBasis,
  type FaceBasis,
  type FaceName,
  type ViewStep,
} from "../world/rubiksCubeView";
import styles from "./Game.module.css";

// Standard notation order. Whichever raw axis/layer each letter currently
// corresponds to is recomputed from faceBasis on every render — see the
// component body — so the labels always match what's actually in front of
// the player, however they've reoriented the view.
const FACE_ORDER: FaceName[] = ["U", "D", "L", "R", "F", "B"];
const FACE_LABELS: Record<FaceName, { pt: string; en: string }> = {
  U: { pt: "Mover o topo", en: "Turn the top" },
  D: { pt: "Mover a base", en: "Turn the bottom" },
  L: { pt: "Mover a face esquerda", en: "Turn the left face" },
  R: { pt: "Mover a face direita", en: "Turn the right face" },
  F: { pt: "Mover a face frontal", en: "Turn the front face" },
  B: { pt: "Mover a face traseira", en: "Turn the back face" },
};

export default function RubiksCubePuzzle({ locale }: { locale: Locale }) {
  const pt = locale === "pt";
  const cubeLayersSolved = useGame((s) => s.puzzle.cubeLayersSolved);
  const cubeTurning = useGame((s) => s.puzzle.cubeTurning);
  const panel = useRef<HTMLDivElement>(null);
  // Mirrors runtime.cubeInspect.faceBasis so the labels below re-render
  // whenever it changes — runtime is a plain mutable object outside
  // Zustand/React state (see store.ts), so React wouldn't otherwise notice.
  const [faceBasis, setFaceBasis] = useState<FaceBasis>(RESTING_FACE_BASIS);

  useEffect(() => {
    panel.current?.focus();
    // React state already starts at RESTING_FACE_BASIS (this component fully
    // unmounts/remounts each time the overlay closes/opens); only the
    // runtime mirror needs an explicit reset here.
    runtime.cubeInspect.faceBasis = RESTING_FACE_BASIS;
  }, []);
  // Mirrors Lock.tsx: this overlay owns Escape while open (see
  // useControls.ts's `if (state.lockOpen || state.cubePuzzleOpen) return;`).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        useGame.getState().configure({ cubePuzzleOpen: false });
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // View-only — never touches puzzle state. Each click adds a persistent
  // ±90° step (e.g. press "down" repeatedly to cycle top → side → bottom
  // into view); unlike a drag it does not spring back on its own.
  // RubiksCube.tsx's useFrame animates the visible transition toward it.
  const step = (direction: ViewStep) => {
    const next = stepFaceBasis(faceBasis, direction);
    runtime.cubeInspect.faceBasis = next;
    setFaceBasis(next);
  };
  const turn = (name: FaceName, clockwise: boolean) => {
    if (useGame.getState().puzzle.cubeTurning) return;
    const move = faceMove(faceBasis, name);
    const direction = clockwise ? move.direction : ((-move.direction) as 1 | -1);
    useGame.getState().turnCubeFace(move.axis, move.layer, direction);
  };

  return (
    // Deliberately not the Lock.tsx-style full-screen modal: the whole point
    // of this panel is that the 3D cube (camera-focused behind it — see
    // FollowCamera.tsx) stays visible, so it's a HUD sidebar like
    // .bar/.inventory rather than a darkened, centered dialog.
    <div
      ref={panel}
      tabIndex={-1}
      className={styles.cubeSidebar}
      role="dialog"
      aria-modal="true"
      aria-label={pt ? "Cubo mágico" : "Magic cube"}
    >
      <h2>{pt ? "Cubo mágico" : "Magic cube"}</h2>
      <p className={styles.lockHint}>
        {pt
          ? "Notação oficial: cada letra gira a camada correspondente 90° no sentido horário (vista de fora); o botão com apóstrofo gira no sentido anti-horário. As letras seguem sempre o que está na sua frente — use a rotação para reorientar a vista."
          : "Standard notation: each letter turns its layer 90° clockwise (viewed from outside); the apostrophe button turns counter-clockwise. Letters always follow whatever's currently in front of you — use the rotation controls to look from another angle."}
      </p>
      <div className={styles.cubeDpadBlock}>
        <span className={styles.cubeDpadLabel}>
          {pt ? "Rotação da vista" : "View rotation"}
        </span>
        <div className={styles.cubeDpad}>
          <button
            type="button"
            className={styles.cubeDpadUp}
            aria-label={pt ? "Girar vista para cima" : "Rotate view up"}
            onClick={() => step("up")}
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.cubeDpadLeft}
            aria-label={pt ? "Girar vista para a esquerda" : "Rotate view left"}
            onClick={() => step("left")}
          >
            ←
          </button>
          <button
            type="button"
            className={styles.cubeDpadRight}
            aria-label={pt ? "Girar vista para a direita" : "Rotate view right"}
            onClick={() => step("right")}
          >
            →
          </button>
          <button
            type="button"
            className={styles.cubeDpadDown}
            aria-label={pt ? "Girar vista para baixo" : "Rotate view down"}
            onClick={() => step("down")}
          >
            ↓
          </button>
        </div>
      </div>
      <p className={styles.cubeProgress} role="status">
        {pt
          ? `${cubeLayersSolved} de 3 níveis corretos`
          : `${cubeLayersSolved} of 3 levels correct`}
      </p>
      <div className={styles.cubeControls}>
        {FACE_ORDER.map((name) => {
          return (
            <div key={name} className={styles.cubeRow}>
              <span>
                {pt ? FACE_LABELS[name].pt : FACE_LABELS[name].en}: {name}
              </span>
              <button
                type="button"
                disabled={cubeTurning}
                aria-label={
                  pt ? `Girar ${name} sentido horário` : `Turn ${name} clockwise`
                }
                onClick={() => turn(name, true)}
              >
                {name}
              </button>
              <button
                type="button"
                disabled={cubeTurning}
                aria-label={
                  pt ? `Girar ${name} sentido anti-horário` : `Turn ${name} counter-clockwise`
                }
                onClick={() => turn(name, false)}
              >
                {name}&apos;
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className={styles.exitPanel}
        onClick={() => useGame.getState().configure({ cubePuzzleOpen: false })}
      >
        {pt ? "Fechar (Esc)" : "Close (Esc)"}
      </button>
    </div>
  );
}
