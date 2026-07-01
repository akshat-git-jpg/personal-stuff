/**
 * theme.ts — follow the OS light/dark preference, no toggle.
 * Adds/removes `.dark` on <html> and keeps the browser chrome color in sync.
 */

function apply(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
}

export function initTheme(): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  apply(mq.matches)
  mq.addEventListener('change', (e) => apply(e.matches))
}
