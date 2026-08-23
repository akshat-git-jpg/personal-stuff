import { useCallback, useState } from 'react'

// One name per thing, and the SAME name on the toggle and on the block header
// in the right column — owner's rule 2026-08-23. Three of the old four chips
// were called "notes" and none of them said which was which.
export type Prefs = {
  instructions: boolean // the whole right column; master switch for the four below
  whatToCover: boolean // the body-beat brief (outline ANGLE)
  screenRecording: boolean // what to film or screen-record (outline SHOW)
  generalNotes: boolean // section rules + the beat's facts, merged
  videoEditor: boolean // post-production notes (outline EDIT)
  beatLabels: boolean // the grey margin labels in the full script view
  scriptNotes: boolean // reserved; renders nothing yet
}

const DEFAULTS: Prefs = {
  instructions: true,
  whatToCover: true, // the brief — on by default, or a body beat is a blank box
  screenRecording: true,
  generalNotes: true,
  videoEditor: false,
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
