"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Locale } from "@/content/story";
import { useTouchDevice } from "@/features/story/useTouchDevice";
import { runtime, useGame } from "../state/store";
import { cameraButtonZoom, cameraIsFar, JOYSTICK_RADIUS, joystickKeys, pinchZoom } from "./touchInput";
import styles from "./TouchControls.module.css";

function sendKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

// Drawn for these buttons on a 24px grid; an action's key is also its grid area.
const ICONS = {
  // An arrow lifting off the ground.
  jump: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M6 20h12" /></>,
  // An open hand, to grab or use what is near.
  interact: <><path d="M8.5 12V6.5a1.5 1.5 0 0 1 3 0V11" /><path d="M11.5 11V5a1.5 1.5 0 0 1 3 0v6" /><path d="M14.5 11V7a1.5 1.5 0 0 1 3 0v6.5a7 7 0 0 1-7 7h-.6a5.5 5.5 0 0 1-4.2-2l-1.9-2.6a1.5 1.5 0 0 1 2.3-1.9L8.5 16v-4" /></>,
  // A four-point spark: the selected monkey's power.
  ability: <path d="M12 3q1 8 9 9-8 1-9 9-1-8-9-9 8-1 9-9Z" fill="currentColor" />,
  climb: <path d="m6 15 6-6 6 6" />,
  descend: <path d="m6 9 6 6 6-6" />,
  // A magnifier: minus pulls the camera back, plus brings it in again.
  zoomOut: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /><path d="M7.5 10.5h6" /></>,
  zoomIn: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /><path d="M7.5 10.5h6M10.5 7.5v6" /></>,
};

export default function TouchControls({ active, locale }: { active: boolean; locale: Locale }) {
  const touchDevice = useTouchDevice();
  const paused = useGame(s => s.paused);
  const lockOpen = useGame(s => s.lockOpen);
  const cubeOpen = useGame(s => s.cubePuzzleOpen);
  const abilityKey = useGame(s => s.abilityKey);
  const selected = useGame(s => s.puzzle.selected);
  const [vine, setVine] = useState(false);
  // Zoom lives in `runtime` and pinching changes it too; polled with the vine state.
  const [cameraFar, setCameraFar] = useState(false);
  const zoomBeforeFar = useRef(1);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickPointer = useRef<number | null>(null);
  const held = useRef(new Set<string>());
  const viewPointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef(0);
  const enabled = touchDevice && active && !paused && !lockOpen && !cubeOpen;

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      setVine(["vine-swing", "vine-grab", "vine-walk"].includes(runtime.motions[useGame.getState().puzzle.selected] ?? ""));
      setCameraFar(cameraIsFar(runtime.zoom));
    };
    update();
    const timer = window.setInterval(update, 120);
    return () => window.clearInterval(timer);
  }, [enabled, selected]);

  useEffect(() => {
    if (enabled) return;
    for (const code of held.current) sendKey("keyup", code);
    held.current.clear();
    stickPointer.current = null;
    viewPointers.current.clear();
    pinchDistance.current = 0;
  }, [enabled]);
  useEffect(() => () => {
    for (const code of held.current) sendKey("keyup", code);
    held.current.clear();
  }, []);

  if (!touchDevice || !active) return null;
  const pt = locale === "pt";
  const press = (code: string) => {
    if (!enabled || held.current.has(code)) return;
    held.current.add(code);
    sendKey("keydown", code);
  };
  const release = (code: string) => {
    if (!held.current.delete(code)) return;
    sendKey("keyup", code);
  };
  const moveStick = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const magnitude = Math.hypot(x, y);
    const scale = magnitude > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / magnitude : 1;
    const next = { x: x * scale, y: y * scale };
    setStick(next);
    const keys = new Set(joystickKeys(next.x, next.y));
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) {
      if (keys.has(code)) press(code);
      else release(code);
    }
  };
  const stopStick = (event: PointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== event.pointerId) return;
    stickPointer.current = null;
    setStick({ x: 0, y: 0 });
    for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) release(code);
  };
  const distance = () => {
    const [a, b] = [...viewPointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const viewMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = viewPointers.current.get(event.pointerId);
    if (!previous) return;
    viewPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (viewPointers.current.size > 1) {
      const nextDistance = distance();
      runtime.zoom = pinchZoom(runtime.zoom, pinchDistance.current, nextDistance);
      pinchDistance.current = nextDistance;
      return;
    }
    runtime.yaw -= (event.clientX - previous.x) * 0.004;
    runtime.pitch = Math.max(0.18, Math.min(0.85, runtime.pitch + (event.clientY - previous.y) * 0.003));
    useGame.getState().learn("camera");
  };
  const viewEnd = (event: PointerEvent<HTMLDivElement>) => {
    viewPointers.current.delete(event.pointerId);
    pinchDistance.current = distance();
  };
  const action = (code: string, label: string, icon: keyof typeof ICONS) => (
    <button
      className={styles.action}
      style={{ gridArea: icon }}
      aria-label={label}
      disabled={!enabled}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); press(code); }}
      onPointerUp={() => release(code)}
      onPointerCancel={() => release(code)}
      onLostPointerCapture={() => release(code)}
      type="button"
    ><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[icon]}</svg></button>
  );
  return <div className={styles.layer} aria-label={pt ? "Controles de toque" : "Touch controls"}>
    {enabled && <>
      <div className={styles.joystick} aria-label={pt ? "Mover" : "Move"}
        onPointerDown={event => {
          event.preventDefault();
          if (stickPointer.current !== null) return;
          stickPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveStick(event);
        }}
        onPointerMove={event => { if (stickPointer.current === event.pointerId) moveStick(event); }}
        onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}
      ><span style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} /></div>
      <div className={styles.view} aria-label={pt ? "Arraste para girar a câmera; pince para zoom" : "Drag to turn the camera; pinch to zoom"}
        onPointerDown={event => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          viewPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          pinchDistance.current = distance();
        }}
        onPointerMove={viewMove} onPointerUp={viewEnd} onPointerCancel={viewEnd} onLostPointerCapture={viewEnd}
      />
      <div className={styles.actions}>
        <button
          className={styles.camera}
          style={{ gridArea: "camera" }}
          aria-label={pt ? "Afastar câmera" : "Pull camera back"}
          aria-pressed={cameraFar}
          onClick={() => {
            if (!cameraIsFar(runtime.zoom)) zoomBeforeFar.current = runtime.zoom;
            runtime.zoom = cameraButtonZoom(runtime.zoom, zoomBeforeFar.current);
            setCameraFar(cameraIsFar(runtime.zoom));
          }}
          type="button"
        ><svg viewBox="0 0 24 24" aria-hidden="true">{cameraFar ? ICONS.zoomIn : ICONS.zoomOut}</svg></button>
        {vine && <>
          {action("ShiftLeft", pt ? "Subir" : "Climb", "climb")}
          {action("AltLeft", pt ? "Descer" : "Descend", "descend")}
        </>}
        {action("Space", pt ? "Pular" : "Jump", "jump")}
        {action("KeyE", pt ? "Agarrar / interagir" : "Grab / interact", "interact")}
        {action(abilityKey, pt ? "Habilidade" : "Ability", "ability")}
      </div>
    </>}
    {!paused && <button className={styles.pause} type="button" aria-label={pt ? "Pausar" : "Pause"}
      onClick={() => { runtime.clear(); useGame.getState().configure({ paused: true }); }}>Ⅱ</button>}
  </div>;
}
