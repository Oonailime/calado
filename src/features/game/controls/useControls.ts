import { useEffect } from "react";
import { runtime, useGame } from "../state/store";
import { anchors, distance, LOCK_RANGE } from "../state/rules";
import { CHARACTER_KEY_BINDINGS } from "../types";
export function useControls(active: boolean, onExit: () => void) {
  useEffect(() => {
    if (!active) return;
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest("input,select,textarea");
    const down = (e: KeyboardEvent) => {
      const state = useGame.getState();
      // The lock dial owns the keyboard entirely while open — see Lock.tsx.
      if (state.lockOpen) return;
      if (e.code === "Escape") {
        e.preventDefault();
        runtime.clear();
        onExit();
        return;
      }
      if (isField(e.target) || state.paused) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("button") &&
        ["Enter", "Space"].includes(e.code)
      )
        return;
      const tracked = [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowLeft",
        "ArrowDown",
        "ArrowRight",
        "Space",
        "KeyE",
        "Enter",
        "KeyQ",
        "KeyR",
        "Digit1",
        "Digit2",
        "Digit3",
        state.abilityKey,
      ];
      if (!tracked.includes(e.code)) return;
      e.preventDefault();
      runtime.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "Space") {
        runtime.jump = true;
        state.learn("jump");
      }
      const binding = CHARACTER_KEY_BINDINGS.find(
        ({ digit }) => e.code === `Digit${digit}`,
      );
      if (binding) state.select(binding.id);
      if (e.code === "KeyQ") {
        const current = CHARACTER_KEY_BINDINGS.findIndex(
          ({ id }) => id === state.puzzle.selected,
        );
        state.select(
          CHARACTER_KEY_BINDINGS[(current + 1) % CHARACTER_KEY_BINDINGS.length]
            .id,
        );
      }
      if (e.code === "KeyR") {
        runtime.clear();
        state.reset();
      }
      if (e.code === state.abilityKey) {
        const id = state.puzzle.selected;
        // The gesture communicates who was invoked even when the character is
        // away from the checkpoint and the gameplay effect cannot activate.
        runtime.triggerPose(id);
        if (id === 2) {
          state.build(runtime.positions[id]);
        } else state.power(id, runtime.positions[id]);
      }
      if (e.code === "KeyE" || e.code === "Enter") {
        const id = state.puzzle.selected;
        const position = runtime.positions[id];
        if (state.eat(id, position)) {
          runtime.triggerEating(id);
          return;
        }
        if (
          id === 2 &&
          !state.puzzle.unlocked &&
          distance(position, anchors.padlock) < LOCK_RANGE
        ) {
          runtime.clear();
          state.configure({ lockOpen: true });
        } else {
          if (id === 2) runtime.triggerPose(id);
          state.build(position);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      runtime.keys.delete(e.code);
    };
    const blur = () => {
      runtime.clear();
      useGame.getState().configure({ paused: true });
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    const mouse = (e: MouseEvent) => {
      if (
        useGame.getState().paused ||
        !(e.buttons === 1 || document.pointerLockElement)
      )
        return;
      if ((e.target as HTMLElement)?.closest("button,input,select")) return;
      runtime.yaw -= e.movementX * 0.004;
      runtime.pitch = Math.max(
        0.18,
        Math.min(0.85, runtime.pitch + e.movementY * 0.003),
      );
      useGame.getState().learn("camera");
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("mousemove", mouse);
    window.addEventListener("wheel", wheel, { passive: false });
    return () => {
      runtime.clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("mousemove", mouse);
      window.removeEventListener("wheel", wheel);
    };
  }, [active, onExit]);
}
