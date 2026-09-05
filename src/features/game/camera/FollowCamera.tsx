import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { runtime, useGame } from "../state/store";
export default function FollowCamera({ running }: { running: boolean }) {
  const look = useRef(new Vector3(0, 0.9, 3));
  const target = useRef(new Vector3());
  useFrame(({ camera }, delta) => {
    if (!running) return;
    const state = useGame.getState();
    const p = runtime.positions[state.puzzle.selected];
    const dt = Math.min(delta, 0.04);
    const pitch = state.reduced ? 0.43 : runtime.pitch;
    look.current.lerp(
      target.current.set(p.x, p.y + 0.55, p.z),
      1 - Math.exp(-dt * 7),
    );
    target.current.set(
      p.x + Math.sin(runtime.yaw) * 8,
      p.y + 2.1 + pitch * 5,
      p.z + Math.cos(runtime.yaw) * 8,
    );
    camera.position.lerp(
      target.current,
      1 - Math.exp(-dt * (state.reduced ? 10 : 5)),
    );
    camera.lookAt(look.current);
  });
  return null;
}
