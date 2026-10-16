import type { Graph, Scope } from '../shared/types'
import { areaCards, index } from './derive'

const LEVEL = { error: 'Broken', warn: 'Fix soon', info: 'Worth knowing' } as const

export function LooseEnds({ graph, scope, onPick }: { graph: Graph; scope: Scope; onPick: (id: string) => void }) {
  const { byId } = index(graph)
  const mine = graph.findings.filter((f) => byId.get(f.node)?.scope === scope)
  const other = graph.findings.length - mine.length
  const groups = areaCards(graph, scope, '')
    .map((c) => ({ name: c.area.name, list: mine.filter((f) => byId.get(f.node)?.area === c.area.name) }))
    .filter((gr) => gr.list.length)

  return (
    <section aria-labelledby="loose-h" className="card">
      <div className="card-head">
        <h2 id="loose-h">{scope === 'personal' ? 'Personal' : 'Work'} · loose ends · {mine.length}</h2>
        <span className="muted small">
          {other > 0 ? `${other} more in the ${scope === 'personal' ? 'Work' : 'Personal'} tab · ` : ''}fix one, then say "update my-repo"
        </span>
      </div>
      {mine.length === 0 && <p className="muted empty">Nothing loose here. Everything is wired and inside its budget.</p>}
      {groups.map((gr) => (
        <div key={gr.name} className="loose-group">
          <h3>{gr.name} · {gr.list.length}</h3>
          <ul className="loose">
            {gr.list.map((f, i) => {
              const n = byId.get(f.node)
              return (
                <li key={i}>
                  <button className={`loose-item lvl-${f.level}`} onClick={() => onPick(f.node)}>
                    <span className="loose-top">
                      <span className={`mono name k-${n?.kind ?? 'skill'}`}>{n?.name ?? f.node}</span>
                      <span className={`lvl lvl-${f.level}`}>{LEVEL[f.level]}</span>
                    </span>
                    <span className="muted">{f.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
