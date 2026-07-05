// Theme: "system" (default) follows the OS; "light"/"dark" are explicit choices.
// Persisted in localStorage; applied by toggling `.dark` on <html>.
export type Theme = "light" | "dark" | "system";

const KEY = "tracker-theme";

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(t: Theme): "light" | "dark" {
  return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
}

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", resolveTheme(t) === "dark");
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  applyTheme(t);
}

// Apply the stored theme immediately (call before React renders to avoid a flash),
// and keep "system" in sync if the OS theme changes while the app is open.
export function initTheme() {
  applyTheme(getStoredTheme());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getStoredTheme() === "system") applyTheme("system");
  });
}
