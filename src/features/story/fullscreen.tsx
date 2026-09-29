import { useSyncExternalStore } from "react";

// Fullscreen covers the whole page (<html>), not the story or the game alone,
// so leaving the game for the story keeps the browser in fullscreen.

function subscribeFullscreen(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

function subscribeNever() {
  return () => {};
}

/** Both false on the server and where the page may not go fullscreen. */
export function useFullscreen() {
  const available = useSyncExternalStore(subscribeNever, () => document.fullscreenEnabled, () => false);
  const active = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  return { available, active };
}

export function toggleFullscreen() {
  // Rejected without a user gesture or by browser policy; the button just stays as it is.
  const request = document.fullscreenElement
    ? document.exitFullscreen()
    : document.documentElement.requestFullscreen();
  request.catch(() => {});
}

/** Corners pointing out to enter, pointing in to leave. Stroked with currentColor. */
export function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d={
          active
            ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
            : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        }
      />
    </svg>
  );
}
