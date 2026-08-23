import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// One place that knows whether ANYTHING on the page is still unsaved.
//
// Before this, each write box tracked its own state and printed it in its own
// footer, so answering "is my work safe?" meant scrolling 26 beats and reading
// 15 little labels. Worse, a box said "Saved" during its 600ms debounce — the
// text was still only in the browser. The owner's complaint on 2026-08-23 was
// exactly that: no way to tell whether what he typed got saved.
//
// `dirty` is the state that fixes it: the moment a key is pressed the beat is
// unsaved, and it stays unsaved until the server has actually acknowledged it.

export type SaveState = 'saved' | 'dirty' | 'saving' | 'retrying'

// Worst state wins — one failing beat must not be hidden by fourteen happy ones.
export type OverallSave = 'saved' | 'pending' | 'failed'

type Ctx = {
  report: (id: string, state: SaveState) => void
  overall: OverallSave
}

const SaveStatusContext = createContext<Ctx | null>(null)

function summarise(states: Map<string, SaveState>): OverallSave {
  let pending = false
  for (const s of states.values()) {
    if (s === 'retrying') return 'failed'
    if (s === 'dirty' || s === 'saving') pending = true
  }
  return pending ? 'pending' : 'saved'
}

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const states = useRef(new Map<string, SaveState>())
  const [overall, setOverall] = useState<OverallSave>('saved')

  const report = useCallback((id: string, state: SaveState) => {
    const prev = states.current.get(id)
    if (prev === state) return
    if (state === 'saved') states.current.delete(id)
    else states.current.set(id, state)
    setOverall(summarise(states.current))
  }, [])

  const value = useMemo(() => ({ report, overall }), [report, overall])
  return <SaveStatusContext.Provider value={value}>{children}</SaveStatusContext.Provider>
}

// Returns a no-op reporter when there is no provider, so a component can be
// unit-tested on its own without one.
export function useSaveReporter(): (id: string, state: SaveState) => void {
  const ctx = useContext(SaveStatusContext)
  return ctx?.report ?? noop
}

export function useOverallSave(): OverallSave {
  return useContext(SaveStatusContext)?.overall ?? 'saved'
}

function noop() {}
