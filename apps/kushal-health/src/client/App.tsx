import { useCallback, useEffect, useState } from 'react'
import type { BloodData } from '../shared/types'
import { Unauthorized, getBlood, logout } from './api'
import BloodTab from './BloodTab'
import Detail from './Detail'
import { Login } from './Login'

// One entry per tab; new tabs (weight, sleep, ...) add a row and a component. The bar shows from 2 tabs.
const TABS = [{ id: 'blood', label: 'Blood tests' }] as const

type State = { kind: 'loading' } | { kind: 'login' } | { kind: 'error' } | { kind: 'ready'; data: BloodData }

/** "#/m/<key>" opens one test's detail; anything else is the home list. */
function routeFromHash(): string | null {
  const m = window.location.hash.match(/^#\/m\/([a-z0-9_]+)$/)
  return m ? m[1] : null
}

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('blood')
  const [marker, setMarker] = useState<string | null>(routeFromHash)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', data: await getBlood() })
    } catch (e) {
      setState(e instanceof Unauthorized ? { kind: 'login' } : { kind: 'error' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onHash = () => {
      setMarker(routeFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (state.kind === 'login') return <Login onDone={load} />

  return (
    <div className="app">
      {!marker && (
        <header className="top">
          <div className="stack">
            <span className="muted small">Kushal Health</span>
            <h1 className="h1">Blood tests</h1>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Log out"
            onClick={async () => {
              await logout()
              setState({ kind: 'login' })
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
            </svg>
          </button>
        </header>
      )}
      {TABS.length > 1 && !marker && (
        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'tab-on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <main>
        {state.kind === 'loading' && <p className="muted">Loading…</p>}
        {state.kind === 'error' && (
          <section className="card">
            <p>Could not load reports.</p>
            <button type="button" className="btn btn-primary" onClick={load}>
              Retry
            </button>
          </section>
        )}
        {state.kind === 'ready' && tab === 'blood' && marker && <Detail data={state.data} markerKey={marker} />}
        {state.kind === 'ready' && tab === 'blood' && !marker && <BloodTab data={state.data} />}
      </main>
    </div>
  )
}
