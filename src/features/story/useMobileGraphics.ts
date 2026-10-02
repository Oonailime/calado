import { useSyncExternalStore } from "react";
import { useTouchDevice } from "./useTouchDevice";

const query = "(max-width: 760px), (pointer: coarse)";

function subscribe(callback: () => void) {
  const media = matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export function useMobileGraphics() {
  const touch = useTouchDevice();
  const compact = useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);
  return touch || compact;
}
