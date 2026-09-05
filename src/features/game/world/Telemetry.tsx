import { useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { runtime, useGame } from "../state/store";
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
  useFrame((_, delta) => {
    if (!running || !element.current) return;
    sample.current.elapsed += delta;
    sample.current.positionElapsed += delta;
    sample.current.frames++;
    const selected = useGame.getState().puzzle.selected;
    if (sample.current.positionElapsed >= 0.1) {
      const p = runtime.positions[selected];
      element.current.setAttribute(
        "data-position",
        [p.x, p.y, p.z].map((v) => v.toFixed(2)).join(","),
      );
      element.current.setAttribute(
        "data-grounded",
        String(runtime.grounded[selected]),
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
