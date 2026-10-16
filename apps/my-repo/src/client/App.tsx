import { useEffect, useMemo, useState } from 'react'
import type { Graph, Kind } from '../shared/types'
import { getGraph, logout, Unauthorized } from './api'
import { counts, KIND_LABEL, SKILL_GROUPS, type Filters } from './derive'
import { Detail } from './Detail'
import { Harness } from './Harness'
import { Login } from './Login'
import { LooseEnds } from './LooseEnds'
import { MapView } from './MapView'
import { TableView } from './TableView'

type View = 'map' | 'table' | 'loose'
const KINDS: Kind[] = ['skill', 'cli', 'mcp', 'service']

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    getGraph()
      .then((g) => { setGraph(g); setNeedLogin(false) })
      .catch((e) => (e instanceof Unauthorized ? setNeedLogin(true) : setError(String(e.message ?? e))))
  }
  useEffect(load, [])

  if (needLogin) return <Login onDone={load} />
  if (error) return <div className="center"><p>Could not load the map: {error}</p><button className="btn" onClick={load}>Try again</button></div>
  if (!graph) return <div className="center"><p className="muted">Loading the map…</p></div>
  return <Shell graph={graph} />
}

export function Shell({ graph }: { graph: Graph }) {
  const [view, setView] = useState<View>('map')
  const [selected, setSelected] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ kinds: new Set(KINDS), groups: new Set(SKILL_GROUPS), query: '' })
  const c = useMemo(() => counts(graph), [graph])

  const toggle = <T,>(set: Set<T>, v: T) => { const s = new Set(set); if (s.has(v)) s.delete(v); else s.add(v); return s }
  const pick = (id: string) => { setSelected(id); if (view === 'loose') setView('map') }
  const scanned = new Date(graph.meta.scannedAt)
  const groupCount = (g: string) => graph.nodes.filter((n) => n.kind === 'skill' && n.group === g).length

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <h1>my-repo</h1>
          <span className="muted small">
            {graph.meta.repo} · scanned {scanned.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })},{' '}
            {scanned.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · main @ {graph.meta.sha}
          </span>
        </div>
        <nav aria-label="View" className="tabs">
          <button aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
          <button aria-pressed={view === 'loose'} onClick={() => setView('loose')}>
            Loose ends {graph.findings.length > 0 && <span className="badge">{graph.findings.length}</span>}
          </button>
        </nav>
        <div className="search">
          <label className="field">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span className="sr">Search the map</span>
            <input type="search" placeholder="Search a skill, CLI, phrase…" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
          </label>
          <button className="btn ghost" onClick={() => logout().then(() => location.reload())}>Lock</button>
        </div>
      </header>

      <section aria-label="Filter by kind" className="chips">
        {KINDS.map((k) => (
          <button key={k} className={`chip k-${k}`} aria-pressed={filters.kinds.has(k)} onClick={() => setFilters({ ...filters, kinds: toggle(filters.kinds, k) })}>
            {KIND_LABEL[k]} <span className="mono">{k === 'mcp' ? `${c.mcpWired} wired · ${c.mcp - c.mcpWired} other` : c[k]}</span>
          </button>
        ))}
        <span className="divider" aria-hidden="true" />
        {SKILL_GROUPS.map((g) => (
          <button key={g} className="chip k-group" aria-pressed={filters.groups.has(g)} onClick={() => setFilters({ ...filters, groups: toggle(filters.groups, g) })}>
            {g} <span className="mono">{groupCount(g)}</span>
          </button>
        ))}
      </section>

      <div className="body">
        <main className="main">
          {view === 'map' && (
            <>
              <MapView graph={graph} filters={filters} selected={selected} onPick={pick} />
              <Harness graph={graph} selected={selected} onPick={pick} />
            </>
          )}
          {view === 'table' && <TableView graph={graph} query={filters.query} kinds={filters.kinds} onPick={pick} selected={selected} />}
          {view === 'loose' && <LooseEnds graph={graph} onPick={pick} />}
        </main>
        <Detail graph={graph} id={selected} onPick={pick} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}
