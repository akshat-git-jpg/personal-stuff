import type { Graph, Scope } from '../shared/types'
import { areaCards } from './derive'

type Props = { graph: Graph; scope: Scope; query: string; onOpen: (area: string) => void; onPick: (id: string) => void }

export function AreasHome({ graph, scope, query, onOpen, onPick }: Props) {
  const cards = areaCards(graph, scope, query).filter((c) => !query || c.hits.length)
  const total = cards.reduce((n, c) => n + c.hits.length, 0)
  return (
    <section aria-labelledby="areas-h" className="card">
      <div className="card-head">
        <h2 id="areas-h">{scope === 'personal' ? 'Personal' : 'Work'} · {query ? `${total} matches for “${query}”` : `${cards.length} areas`}</h2>
        <span className="muted small">{query ? 'click a match to open it' : 'open an area to see how its requests flow'}</span>
      </div>
      {cards.length === 0 && <p className="muted empty">Nothing here matches. Try the other tab, or clear the search.</p>}
      <ul className="areas">
        {cards.map((c) => (
          <li key={c.area.name} className={`area ${c.area.collapsed ? 'quiet' : ''}`}>
            <button className="area-open" onClick={() => onOpen(c.area.name)}>
              <span className="area-name">{c.area.name}</span>
              {c.loose > 0 && <span className="badge" aria-label={`${c.loose} loose ends`}>{c.loose}</span>}
            </button>
            <p className="muted small area-blurb">{c.area.blurb}</p>
            <p className="area-counts mono small">
              <span className="t-skill">{c.skills} skills</span>
              {c.clis > 0 && <span className="t-cli">{c.clis} CLIs</span>}
              {c.mcps > 0 && <span className="t-mcp">{c.mcps} MCPs</span>}
            </p>
            <ul className="area-items">
              {(query ? c.hits : c.top).map((n) => (
                <li key={n.id}>
                  <button className={`mini k-${n.kind}`} onClick={() => onPick(n.id)}>{n.name}</button>
                </li>
              ))}
              {!query && c.skills > c.top.length && (
                <li><button className="mini more" onClick={() => onOpen(c.area.name)}>+{c.skills - c.top.length} more</button></li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
