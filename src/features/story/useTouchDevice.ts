import { useSyncExternalStore } from "react";

// Some mobile browsers report a fine primary pointer when a stylus or mouse
// is paired. The viewport and touch capability keep the phone UI available.
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return matchMedia("(pointer: coarse)").matches ||
    (matchMedia("(max-width: 1100px)").matches &&
      (matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0));
}

function subscribe(callback: () => void) {
  const primary = matchMedia("(pointer: coarse)");
  const any = matchMedia("(any-pointer: coarse)");
  const narrow = matchMedia("(max-width: 1100px)");
  for (const media of [primary, any, narrow]) media.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    for (const media of [primary, any, narrow]) media.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

export function useTouchDevice() {
  return useSyncExternalStore(subscribe, isTouchDevice, () => false);
}

function subscribeViewport(callback: () => void) {
  window.addEventListener("resize", callback);
  window.addEventListener("orientationchange", callback);
  return () => {
    window.removeEventListener("resize", callback);
    window.removeEventListener("orientationchange", callback);
  };
}

export function usePortraitViewport() {
  return useSyncExternalStore(subscribeViewport, () => innerHeight > innerWidth, () => false);
}
