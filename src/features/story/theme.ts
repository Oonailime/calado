// Light mode is the original story; dark mode is the volcanic one (design2).
// The theme lives on <html data-theme>, set before the first paint by
// THEME_SCRIPT (app/layout.tsx) so the loading screen starts in the right
// colours.
export type Theme = "light" | "dark";

const STORAGE_KEY = "emiliano-theme";
const listeners = new Set<() => void>();

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function storedOrSystemTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist)
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  listeners.forEach((listener) => listener());
}

// Strict Mode's development remount resets <html> to its JSX attributes,
// dropping the one THEME_SCRIPT set; this puts it back (a no-op in production).
export function restoreTheme(forced?: Theme) {
  applyTheme(forced ?? storedOrSystemTheme(), false);
}
