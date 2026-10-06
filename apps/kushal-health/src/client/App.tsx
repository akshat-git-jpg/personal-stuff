import { useCallback, useEffect, useState } from 'react'
import type { BloodData } from '../shared/types'
import { Unauthorized, getBlood, logout } from './api'
import BloodTab from './BloodTab'
import { Login } from './Login'

// One entry per tab; new tabs (weight, sleep, ...) add a row and a component.
const TABS = [{ id: 'blood', label: 'Blood tests' }] as const

type State = { kind: 'loading' } | { kind: 'login' } | { kind: 'error' } | { kind: 'ready'; data: BloodData }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('blood')

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

  if (state.kind === 'login') return <Login onDone={load} />

  return (
    <div className="app">
      <header className="top">
        <h1>Kushal Health</h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await logout()
            setState({ kind: 'login' })
          }}
        >
          Log out
        </button>
      </header>
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
        {state.kind === 'ready' && tab === 'blood' && <BloodTab data={state.data} />}
      </main>
    </div>
  )
}
