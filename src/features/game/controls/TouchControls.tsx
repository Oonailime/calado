"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Locale } from "@/content/story";
import { useTouchDevice } from "@/features/story/useTouchDevice";
import { runtime, useGame } from "../state/store";
import { JOYSTICK_RADIUS, joystickKeys, pinchZoom } from "./touchInput";
import styles from "./TouchControls.module.css";

function sendKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
}

export default function TouchControls({ active, locale }: { active: boolean; locale: Locale }) {
  const touchDevice = useTouchDevice();
  const paused = useGame(s => s.paused);
  const lockOpen = useGame(s => s.lockOpen);
  const cubeOpen = useGame(s => s.cubePuzzleOpen);
  const abilityKey = useGame(s => s.abilityKey);
  const selected = useGame(s => s.puzzle.selected);
  const [vine, setVine] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickPointer = useRef<number | null>(null);
  const held = useRef(new Set<string>());
  const viewPointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef(0);
  const enabled = touchDevice && active && !paused && !lockOpen && !cubeOpen;

  useEffect(() => {
    if (!enabled) return;
    const update = () => setVine(["vine-swing", "vine-grab", "vine-walk"].includes(runtime.motions[useGame.getState().puzzle.selected] ?? ""));
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
  const action = (code: string, label: string, className = "") => (
    <button
      className={`${styles.action} ${className}`}
      aria-label={label}
      disabled={!enabled}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); press(code); }}
      onPointerUp={() => release(code)}
      onPointerCancel={() => release(code)}
      onLostPointerCapture={() => release(code)}
      type="button"
    >{label}</button>
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
        {vine && <div className={styles.vineActions}>
          {action("ShiftLeft", pt ? "Subir" : "Climb")}
          {action("AltLeft", pt ? "Descer" : "Descend")}
        </div>}
        {action("Space", pt ? "Pular" : "Jump")}
        {action("KeyE", pt ? "Agarrar / interagir" : "Grab / interact")}
        {action(abilityKey, pt ? "Habilidade" : "Ability")}
      </div>
    </>}
    {!paused && <button className={styles.pause} type="button" aria-label={pt ? "Pausar" : "Pause"}
      onClick={() => { runtime.clear(); useGame.getState().configure({ paused: true }); }}>Ⅱ</button>}
  </div>;
}
