import type { Graph } from '../shared/types'
import { HARNESS_GROUPS } from './derive'

type Props = { graph: Graph; selected: string | null; onPick: (id: string) => void }

export function Harness({ graph, selected, onPick }: Props) {
  const parts = graph.nodes.filter((n) => n.kind === 'harness')
  return (
    <section aria-labelledby="harness-h" className="card">
      <div className="card-head">
        <h2 id="harness-h">Harness · what runs around every session</h2>
        <span className="muted small">these fire on their own; nothing you say triggers them</span>
      </div>
      <div className="harness">
        {HARNESS_GROUPS.map((g) => {
          const items = parts.filter((p) => p.group === g.key)
          if (!items.length) return null
          return (
            <div key={g.key} className="h-group">
              <div className="h-title">{g.title} · {items.length}</div>
              <ul>
                {items.map((p) => (
                  <li key={p.id}>
                    <button className={`h-item ${selected === p.id ? 'sel' : ''}`} onClick={() => onPick(p.id)} title={p.desc}>
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
