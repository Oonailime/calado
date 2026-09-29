"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";

// Tells the page when a story scene is really on screen, so the loading
// screen can lift. Loaders don't share one LoadingManager (the monkey's FBX
// has its own), so each Suspense boundary is marked instead.

/** Mounts only once its Suspense boundary has resolved. */
export function BoundaryLoaded({ id, loaded }: { id: string; loaded: RefObject<Set<string>> }) {
  useEffect(() => {
    loaded.current.add(id);
  }, [id, loaded]);
  return null;
}

// Frames drawn after everything loaded, so first-use shader compilation also
// happens behind the loading screen.
const SETTLE_FRAMES = 3;

export function SceneReady({
  boundaries,
  loaded,
  onReady,
}: {
  boundaries: readonly string[];
  loaded: RefObject<Set<string>>;
  onReady?: () => void;
}) {
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > SETTLE_FRAMES) return;
    if (!boundaries.every((id) => loaded.current.has(id))) return;
    frames.current += 1;
    if (frames.current > SETTLE_FRAMES) onReady?.();
  });
  return null;
}
