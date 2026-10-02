import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/content/story";
import { useTouchDevice } from "./useTouchDevice";
import styles from "./fullscreen.module.css";

// Fullscreen covers the whole page (<html>), not the story or the game alone,
// so leaving the game for the story keeps the browser in fullscreen.

// Opened from a home-screen icon (see app/manifest.ts), the page already
// fills the screen without the browser's bars.
const HOME_SCREEN_APP = "(display-mode: standalone), (display-mode: fullscreen)";

function subscribeFullscreen(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

function subscribeHomeScreenApp(listener: () => void) {
  const media = matchMedia(HOME_SCREEN_APP);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function subscribeNever() {
  return () => {};
}

function openedFromHomeScreen() {
  return matchMedia(HOME_SCREEN_APP).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * `native`: the page can enter fullscreen itself. Otherwise a phone (an
 * iPhone's Safari has no fullscreen API for pages) still gets the button,
 * which explains the home-screen route. All false on the server.
 */
export function useFullscreen() {
  const native = useSyncExternalStore(subscribeNever, () => document.fullscreenEnabled === true, () => false);
  const active = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  const homeScreenApp = useSyncExternalStore(subscribeHomeScreenApp, openedFromHomeScreen, () => false);
  const touch = useTouchDevice();
  return { available: native || (touch && !homeScreenApp), native, active };
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

/** The story header's and the game bar's fullscreen button, styled by `className`. */
export function FullscreenButton({ className, locale }: { className?: string; locale: Locale }) {
  const { available, native, active } = useFullscreen();
  const [homeScreenHelp, setHomeScreenHelp] = useState(false);
  if (!available) return null;
  const pt = locale === "pt";
  return (
    <>
      <button
        className={className}
        type="button"
        onClick={native ? toggleFullscreen : () => setHomeScreenHelp(true)}
        aria-label={pt ? "Tela cheia" : "Fullscreen"}
        title={pt ? (active ? "Sair da tela cheia" : "Tela cheia")
          : (active ? "Exit fullscreen" : "Fullscreen")}
        aria-pressed={active}
      >
        <FullscreenIcon active={active} />
      </button>
      {/* Portalled out of the header and the game bar's stacking contexts. */}
      {homeScreenHelp && createPortal(
        <div className={styles.backdrop}>
          <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="fullscreen-help-title">
            <h2 id="fullscreen-help-title">{pt ? "Tela cheia pela Tela de Início" : "Fullscreen from the Home Screen"}</h2>
            <p>{pt
              ? "Este navegador não abre sites em tela cheia. Para jogar sem as barras do navegador, toque em Compartilhar, depois em “Adicionar à Tela de Início”, e abra o Templo dos Três pelo novo ícone."
              : "This browser can't open sites in fullscreen. To play without the browser bars, tap Share, then “Add to Home Screen”, and open the Temple of Three from the new icon."}</p>
            <button type="button" autoFocus onClick={() => setHomeScreenHelp(false)}>
              {pt ? "Entendi" : "Got it"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
