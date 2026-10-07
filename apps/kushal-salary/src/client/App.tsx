import { useCallback, useEffect, useState } from 'react'
import type { SalaryData } from '../shared/types'
import { Unauthorized, getSalary, logout } from './api'
import { Login } from './Login'
import MonthsTab from './MonthsTab'
import TimelineTab from './TimelineTab'

type State = { kind: 'loading' } | { kind: 'login' } | { kind: 'error' } | { kind: 'ready'; data: SalaryData }
type Tab = 'months' | 'timeline'

const tabFromHash = (): Tab => (window.location.hash === '#/timeline' ? 'timeline' : 'months')

export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [tab, setTab] = useState<Tab>(tabFromHash)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'ready', data: await getSalary() })
    } catch (e) {
      setState(e instanceof Unauthorized ? { kind: 'login' } : { kind: 'error' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (state.kind === 'login') return <Login onDone={load} />

  return (
    <div className="app">
      <header className="top">
        <span className="eyebrow">KUSHAL SALARY</span>
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
      <nav className="pills" aria-label="Views">
        <a href="#/" className="pill" aria-current={tab === 'months' ? 'page' : undefined}>
          Every month
        </a>
        <a href="#/timeline" className="pill" aria-current={tab === 'timeline' ? 'page' : undefined}>
          Timeline
        </a>
      </nav>
      <main>
        {state.kind === 'loading' && <p className="muted">Loading…</p>}
        {state.kind === 'error' && (
          <section className="card stack-8">
            <p>Could not load salary data.</p>
            <button type="button" className="btn btn-primary" onClick={load}>
              Retry
            </button>
          </section>
        )}
        {state.kind === 'ready' && tab === 'months' && <MonthsTab months={state.data.months} />}
        {state.kind === 'ready' && tab === 'timeline' && <TimelineTab months={state.data.months} notes={state.data.notes} />}
      </main>
    </div>
  )
}
