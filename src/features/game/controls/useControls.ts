import { useEffect } from "react";
import { runtime, useGame } from "../state/store";
import { anchors, distance, LOCK_RANGE, nearCubeShrine } from "../state/rules";
import { CHARACTER_KEY_BINDINGS } from "../types";
import { phase2Chess } from "../world/phase2Chess";
// Multiplier range applied to each map's own base follow distance (see
// FollowCamera.tsx) — comfortably closer/farther without letting the wheel
// clip the camera into the character or lose it in the distance.
// Exported so FollowCamera.tsx can blend the volcanic map's camera between
// its own wide framing and the other maps' close one across this same range.
export const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.9;
const ZOOM_SPEED = 0.0012;
export function useControls(active: boolean, onExit: () => void) {
  const paused = useGame((s) => s.paused);
  const lockOpen = useGame((s) => s.lockOpen);
  const cubePuzzleOpen = useGame((s) => s.cubePuzzleOpen);
  // The pointer stays locked only while actually playing — any dialog that
  // needs a visible, clickable cursor (settings, the padlock's hint button,
  // the cube shrine's turn buttons) must force it to release, since a locked
  // pointer can't reliably hit UI.
  useEffect(() => {
    if ((!active || paused || lockOpen || cubePuzzleOpen) && document.pointerLockElement)
      document.exitPointerLock();
  }, [active, paused, lockOpen, cubePuzzleOpen]);
  useEffect(() => {
    if (!active) return;
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest("input,select,textarea");
    const down = (e: KeyboardEvent) => {
      const state = useGame.getState();
      if (state.map === "phase2" && phase2Chess.getSnapshot().tabOpen && e.code === "Escape") {
        e.preventDefault(); phase2Chess.stop(); return;
      }
      if (runtime.chessActive) {
        if (e.code === "Escape") { e.preventDefault(); phase2Chess.stop(); }
        return;
      }
      // The lock dial and the cube shrine's overlay each own the keyboard
      // entirely while open — see Lock.tsx / RubiksCubePuzzle.tsx.
      if (state.lockOpen || state.cubePuzzleOpen) return;
      if (e.code === "Escape") {
        e.preventDefault();
        // The browser itself already force-releases pointer lock on Escape;
        // this just brings up the settings panel, which is where exiting the
        // game now lives (see Controls.tsx) instead of leaving immediately.
        if (state.paused) state.configure({ paused: false });
        else {
          runtime.clear();
          state.configure({ paused: true });
        }
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
        "Backquote",
        "ShiftLeft",
        "ShiftRight",
        "ControlLeft",
        "ControlRight",
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
        if (state.map === "phase2") { phase2Chess.stop(); runtime.phase2Restore.fill(null); }
        runtime.clear();
        state.reset();
      }
      if (e.code === "Backquote")
        state.configure({ movementDebug: !state.movementDebug });
      if (e.code === state.abilityKey) {
        const id = state.puzzle.selected;
        // The gesture communicates who was invoked even when the character is
        // away from the checkpoint and the gameplay effect cannot activate.
        runtime.triggerPose(id);
        if (state.map === "phase2") return;
        if (state.map === "phase3") { state.canopyInteract(runtime.positions[id]); return; }
        if (id === 2) {
          state.build(runtime.positions[id]);
        } else state.power(id, runtime.positions[id]);
      }
      if (e.code === "KeyE" || e.code === "Enter") {
        runtime.interact = true;
        if (state.map === "phase2") { phase2Chess.interact(); return; }
        const id = state.puzzle.selected;
        const position = runtime.positions[id];
        if (state.map === "phase3") {
          const collected = state.collectCube(id, position);
          const cooperated = state.canopyInteract(position);
          if (collected || cooperated) {
            runtime.interact = false;
            runtime.triggerPose(id);
            return;
          }
          if (state.puzzle.cubeDelivered.every(Boolean) && !state.puzzle.cubeSolved && nearCubeShrine(position)) {
            runtime.clear();
            state.configure({ cubePuzzleOpen: true });
          }
          return;
        }
        if (state.eat(id, position)) {
          runtime.triggerEating(id);
          return;
        }
        if (state.collectCube(id, position)) {
          runtime.triggerPose(id);
          return;
        }
        if (
          id === 2 &&
          !state.puzzle.unlocked &&
          distance(position, anchors.padlock) < LOCK_RANGE
        ) {
          runtime.clear();
          state.configure({ lockOpen: true });
        } else if (
          state.puzzle.cubeDelivered.every(Boolean) &&
          !state.puzzle.cubeSolved &&
          nearCubeShrine(position)
        ) {
          runtime.clear();
          state.configure({ cubePuzzleOpen: true });
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
      const state = useGame.getState();
      if (state.paused || runtime.chessActive) return;
      if ((e.target as HTMLElement)?.closest("button,input,select")) return;
      // While the cube puzzle is open, the camera holds a fixed angle so
      // "Front" (facing the camera) is a stable reference for U/D/L/R/F/B —
      // reorienting the view is the D-pad's job (RubiksCubePuzzle.tsx),
      // which turns the cube itself rather than orbiting the camera.
      if (state.cubePuzzleOpen) return;
      if (!(e.buttons === 1 || document.pointerLockElement)) return;
      runtime.yaw -= e.movementX * 0.004;
      runtime.pitch = Math.max(
        0.18,
        Math.min(0.85, runtime.pitch + e.movementY * 0.003),
      );
      state.learn("camera");
    };
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement)?.closest?.("[data-chess-tab]")) return;
      e.preventDefault();
      const state = useGame.getState();
      // Left fixed while focusing the shrine's cube — that view already
      // sits at a deliberately tight, consistent distance.
      if (state.paused || state.cubePuzzleOpen || runtime.chessActive) return;
      runtime.zoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, runtime.zoom + e.deltaY * ZOOM_SPEED),
      );
    };
    // Ctrl+W (and other tab-close paths) can't actually be blocked by a
    // webpage — browsers deliberately don't allow that. This is the only
    // thing the web platform permits: a native, non-customizable "leave
    // site?" confirmation, shown only while a run is actually in progress
    // (not while paused, where closing loses nothing unsaved).
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (useGame.getState().paused) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // A click directly on the canvas engages pointer lock, after which
    // mousemove above drives the camera continuously — no more holding the
    // button down. Clicks on any UI chrome (portraits, icons, dialogs) must
    // not trigger this, so it's scoped to the canvas itself as the target.
    const click = (e: MouseEvent) => {
      const state = useGame.getState();
      if (state.paused || (state.map === "phase2" && phase2Chess.getSnapshot().tabOpen) || runtime.chessActive || state.lockOpen || state.cubePuzzleOpen || state.puzzle.cubeSolved)
        return;
      if (document.pointerLockElement) return;
      if (e.target !== runtime.canvasElement) return;
      // Browsers enforce a brief cooldown after exitPointerLock() before a
      // new request is allowed, rejecting with a SecurityError if one lands
      // inside it (e.g. right as an overlay that had just released the lock
      // closes). Some browsers throw synchronously; newer ones return a
      // rejected Promise — requesting is best-effort either way, the next
      // click retries.
      try {
        const result = runtime.canvasElement?.requestPointerLock() as
          | Promise<void>
          | undefined;
        result?.catch(() => {});
      } catch {
        // Ignored — see above.
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("mousemove", mouse);
    window.addEventListener("click", click);
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      runtime.clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("mousemove", mouse);
      window.removeEventListener("click", click);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [active, onExit]);
}
