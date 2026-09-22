import { useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { runtime, useGame } from "../state/store";
import { Vector3 } from "three";
// Observabilidade somente leitura, sem atalhos para alterar ou completar desafios.
export default function Telemetry({
  element,
  running,
}: {
  element: RefObject<HTMLElement | null>;
  running: boolean;
}) {
  const gl = useThree((state) => state.gl);
  const sample = useRef({ elapsed: 0, positionElapsed: 0, frames: 0 });
  const chessPosition = useRef(new Vector3());
  useFrame(({ scene }, delta) => {
    if (!running || !element.current) return;
    sample.current.elapsed += delta;
    sample.current.positionElapsed += delta;
    sample.current.frames++;
    const selected = useGame.getState().puzzle.selected;
    if (sample.current.positionElapsed >= 0.1) {
      if (useGame.getState().map === "phase2") {
        const board = scene.getObjectByName("phase2-chess-pieces");
        element.current.setAttribute("data-chess-visual-fen", board?.userData.fen ?? "");
        element.current.setAttribute("data-chess-seat-indicators", [0, 1].map(index =>
          scene.getObjectByName(`phase2-seat-indicator-${index}`)?.visible === true,
        ).join(","));
        element.current.setAttribute("data-chess-seats", JSON.stringify(runtime.phase2Seats.map(id => {
          if (id === null) return null;
          const character = scene.getObjectByName(`Character_${id}`);
          return character ? {
            id,
            position: character.getWorldPosition(chessPosition.current).toArray(),
            pelvis: character.getObjectByName("Spine")?.getWorldPosition(chessPosition.current).toArray(),
          } : null;
        })));
      }
      const p = runtime.positions[selected];
      element.current.setAttribute(
        "data-position",
        [p.x, p.y, p.z].map((v) => v.toFixed(2)).join(","),
      );
      element.current.setAttribute(
        "data-grounded",
        String(runtime.grounded[selected]),
      );
      element.current.setAttribute(
        "data-motion",
        runtime.motions[selected] ?? "idle",
      );
      element.current.setAttribute(
        "data-locomotion-state",
        runtime.movementDebug[selected].state,
      );
      element.current.setAttribute(
        "data-handoffs",
        String(runtime.movementDebug[selected].handoffCount),
      );
      const movement = runtime.movementDebug[selected];
      element.current.setAttribute("data-swing-surface", String(movement.hasSwingSurface));
      element.current.setAttribute(
        "data-velocity",
        `${movement.velocity.x.toFixed(3)},${movement.velocity.y.toFixed(3)},${movement.velocity.z.toFixed(3)}`,
      );
      element.current.setAttribute(
        "data-constraint-error",
        `${movement.leftConstraintError.toFixed(4)},${movement.rightConstraintError.toFixed(4)}`,
      );
      element.current.setAttribute(
        "data-hand-anchors",
        `${movement.hasLeftAnchor},${movement.hasRightAnchor}`,
      );
      element.current.setAttribute(
        "data-arm-reach",
        `${movement.leftArmLength.toFixed(3)}/${movement.leftArmMax.toFixed(3)},${movement.rightArmLength.toFixed(3)}/${movement.rightArmMax.toFixed(3)}`,
      );
      element.current.setAttribute(
        "data-has-reach-target",
        String(movement.hasChosenTarget),
      );
      const reachTarget = movement.chosenTarget;
      const reachingShoulder = movement.hasLeftAnchor
        ? movement.rightShoulder
        : movement.leftShoulder;
      element.current.setAttribute(
        "data-reach-distance",
        Math.hypot(
          reachTarget.x - reachingShoulder.x,
          reachTarget.y - reachingShoulder.y,
          reachTarget.z - reachingShoulder.z,
        ).toFixed(3),
      );
      element.current.setAttribute(
        "data-closest-reach-distance",
        movement.closestReachDistance.toFixed(3),
      );
      sample.current.positionElapsed = 0;
    }
    if (sample.current.elapsed >= 1) {
      element.current.setAttribute(
        "data-fps",
        (sample.current.frames / sample.current.elapsed).toFixed(0),
      );
      element.current.setAttribute(
        "data-draw-calls",
        gl.info.render.calls.toFixed(0),
      );
      sample.current.elapsed = 0;
      sample.current.frames = 0;
    }
  });
  return null;
}
