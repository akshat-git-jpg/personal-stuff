import { useEffect, useMemo, useState } from 'react'
import type { Graph, Kind, Scope } from '../shared/types'
import { getGraph, logout, Unauthorized } from './api'
import { AreasHome } from './AreasHome'
import { index, KIND_LABEL, type Filters } from './derive'
import { Detail } from './Detail'
import { Harness } from './Harness'
import { Login } from './Login'
import { LooseEnds } from './LooseEnds'
import { MapView } from './MapView'
import { TableView } from './TableView'

type View = 'areas' | 'table' | 'loose'
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
  const [view, setView] = useState<View>('areas')
  const [selected, setSelected] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ kinds: new Set(KINDS), query: '', scope: 'personal', area: null })
  const { byId } = useMemo(() => index(graph), [graph])
  const inArea = graph.nodes.filter((n) => n.scope === filters.scope && n.area === filters.area)
  const areaCount = (k: Kind) => (k === 'service' ? null : inArea.filter((n) => n.kind === k).length)

  const toggle = (k: Kind) => { const s = new Set(filters.kinds); if (s.has(k)) s.delete(k); else s.add(k); setFilters({ ...filters, kinds: s }) }
  const setScope = (scope: Scope) => { setFilters({ ...filters, scope, area: null }); setSelected(null) }
  const openArea = (area: string | null) => { setFilters({ ...filters, area }); setView('areas') }

  /** Picking anything opens its area (services and harness stay where you are). */
  const pick = (id: string) => {
    setSelected(id)
    const n = byId.get(id)
    if (n?.area) { setFilters((f) => ({ ...f, scope: n.scope ?? f.scope, area: n.area ?? null })); setView('areas') }
  }

  const scanned = new Date(graph.meta.scannedAt)
  const looseIn = (s: Scope) => graph.findings.filter((f) => byId.get(f.node)?.scope === s).length

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <h1>my-repo</h1>
          <span className="muted small">
            scanned {scanned.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })},{' '}
            {scanned.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · main @ {graph.meta.sha}
          </span>
        </div>
        <nav aria-label="Scope" className="tabs scope">
          {(['personal', 'work'] as Scope[]).map((s) => (
            <button key={s} aria-pressed={filters.scope === s} onClick={() => setScope(s)}>
              {s === 'personal' ? 'Personal' : 'Work'}
              {looseIn(s) > 0 && <span className="badge">{looseIn(s)}</span>}
            </button>
          ))}
        </nav>
        <nav aria-label="View" className="tabs">
          <button aria-pressed={view === 'areas'} onClick={() => openArea(null)}>Areas</button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button>
          <button aria-pressed={view === 'loose'} onClick={() => setView('loose')}>Loose ends</button>
        </nav>
        <div className="search">
          <label className="field">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <span className="sr">Search</span>
            <input type="search" placeholder="Search a skill, CLI, phrase…" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} />
          </label>
          <button className="btn ghost" onClick={() => logout().then(() => location.reload())}>Lock</button>
        </div>
      </header>

      {view === 'areas' && filters.area && (
        <section aria-label="Show on the map" className="chips">
          {KINDS.map((k) => (
            <button key={k} className={`chip k-${k}`} aria-pressed={filters.kinds.has(k)} onClick={() => toggle(k)}>
              {KIND_LABEL[k]} {areaCount(k) != null && <span className="mono">{areaCount(k)}</span>}
            </button>
          ))}
        </section>
      )}

      <div className="body">
        <main className="main">
          {view === 'areas' && !filters.area && (
            <>
              <AreasHome graph={graph} scope={filters.scope} query={filters.query} onOpen={openArea} onPick={pick} />
              {filters.scope === 'personal' && !filters.query && <Harness graph={graph} selected={selected} onPick={pick} />}
            </>
          )}
          {view === 'areas' && filters.area && (
            <MapView graph={graph} filters={filters} selected={selected} onPick={pick} onBack={() => openArea(null)} />
          )}
          {view === 'table' && <TableView graph={graph} scope={filters.scope} query={filters.query} onPick={pick} selected={selected} />}
          {view === 'loose' && <LooseEnds graph={graph} scope={filters.scope} onPick={pick} />}
        </main>
        <Detail graph={graph} id={selected} onPick={pick} onClose={() => setSelected(null)} />
      </div>
    </div>
  )
}
