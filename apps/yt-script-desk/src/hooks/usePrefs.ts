import { useCallback, useState } from 'react'

// `instructions` is now the ONLY switch over the right column, because the right
// column is now one block.
//
// It used to be a master over three sub-chips — `What to cover`, `Video notes`,
// `General notes` — one per lane. Those three went on 2026-08-29 with the lanes
// they named. Owner: *"remove those sections about video notes separately,
// general notes separately, everything else. Just need a simple bullet points on
// what to do inside that video."* A switch that hides a third of one bullet list
// is not a setting, it is a puzzle.
//
// Old stored prefs are harmless: `loadPrefs` spreads DEFAULTS first, so a
// leftover `videoNotes: false` in localStorage is simply an unread key.
export type Prefs = {
  instructions: boolean // the whole right column
  beatLabels: boolean // the grey margin labels in the full script view
  scriptNotes: boolean // reserved; renders nothing yet
}

const DEFAULTS: Prefs = {
  instructions: true,
  beatLabels: true,
  scriptNotes: false,
}

const STORAGE_KEY = 'script-desk:prefs'

// A private window or a site with blocked storage must not break the page —
// every read and write is wrapped in try/catch and falls back to DEFAULTS.
function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore — a blocked or full store just means prefs don't persist
  }
}

export function usePrefs() {
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs())

  const setPrefs = useCallback((update: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...update }
      savePrefs(next)
      return next
    })
  }, [])

  return { prefs, setPrefs }
}

export { DEFAULTS }
