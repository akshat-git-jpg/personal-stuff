import { useCallback, useState } from 'react'

export type Prefs = {
  showRecording: boolean
  showEdit: boolean
  showFacts: boolean
  notesTrack: boolean // the whole right track
  beatLabels: boolean // the grey margin labels in the full script view
  scriptNotes: boolean // reserved; renders nothing yet
}

const DEFAULTS: Prefs = {
  showRecording: true,
  showEdit: false,
  showFacts: true,
  notesTrack: true,
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
