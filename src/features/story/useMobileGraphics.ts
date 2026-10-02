import { useSyncExternalStore } from "react";

const query = "(max-width: 760px), (pointer: coarse)";

function subscribe(callback: () => void) {
  const media = matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useMobileGraphics() {
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);
}
