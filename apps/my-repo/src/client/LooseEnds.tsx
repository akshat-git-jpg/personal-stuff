import type { Graph } from '../shared/types'
import { index } from './derive'

const LEVEL = { error: 'Broken', warn: 'Fix soon', info: 'Worth knowing' } as const

export function LooseEnds({ graph, onPick }: { graph: Graph; onPick: (id: string) => void }) {
  const { byId } = index(graph)
  return (
    <section aria-labelledby="loose-h" className="card">
      <div className="card-head">
        <h2 id="loose-h">Loose ends · {graph.findings.length}</h2>
        <span className="muted small">found by the last scan · fix one, then say "update my-repo"</span>
      </div>
      {graph.findings.length === 0 && <p className="muted empty">Nothing loose. Everything is wired and inside its budget.</p>}
      {(['error', 'warn', 'info'] as const).map((lvl) => {
        const list = graph.findings.filter((f) => f.level === lvl)
        if (!list.length) return null
        return (
          <div key={lvl} className="loose-group">
            <h3 className={`lvl-${lvl}`}>{LEVEL[lvl]} · {list.length}</h3>
            <ul className="loose">
              {list.map((f, i) => {
                const n = byId.get(f.node)
                return (
                  <li key={i}>
                    <button className={`loose-item lvl-${lvl}`} onClick={() => onPick(f.node)}>
                      <span className={`mono name k-${n?.kind ?? 'skill'}`}>{n?.name ?? f.node}{n?.group === 'work' ? ' (work-skills)' : ''}</span>
                      <span className="muted">{f.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
