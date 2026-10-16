import { useState } from 'react'
import type { Graph, GraphNode, Scope } from '../shared/types'
import { areaCards, index, KIND_LABEL, matches } from './derive'

type Props = { graph: Graph; scope: Scope; query: string; selected: string | null; onPick: (id: string) => void }
type Col = 'name' | 'kind' | 'out' | 'in' | 'updated'

export function TableView({ graph, scope, query, selected, onPick }: Props) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'kind', dir: 1 })
  const { out, inn } = index(graph)
  const val = (n: GraphNode, c: Col): string | number =>
    c === 'out' ? out(n.id).length : c === 'in' ? inn(n.id).length : (n[c] ?? '')
  const cmp = (a: GraphNode, b: GraphNode) => {
    const x = val(a, sort.col)
    const y = val(b, sort.col)
    return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * sort.dir
  }
  const groups = areaCards(graph, scope, '').map((c) => ({
    name: c.area.name,
    rows: graph.nodes.filter((n) => n.scope === scope && n.area === c.area.name && matches(n, query)).sort(cmp),
  })).filter((gr) => gr.rows.length)
  const total = groups.reduce((n, gr) => n + gr.rows.length, 0)

  const head = (c: Col, label: string) => (
    <th scope="col" aria-sort={sort.col === c ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort({ col: c, dir: sort.col === c ? (sort.dir === 1 ? -1 : 1) : 1 })}>
        {label}{sort.col === c ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <section aria-labelledby="table-h" className="card">
      <div className="card-head">
        <h2 id="table-h">{scope === 'personal' ? 'Personal' : 'Work'} · everything by area</h2>
        <span className="muted small">{total} rows · click a header to sort inside each area</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{head('name', 'Name')}{head('kind', 'Kind')}{head('out', 'Calls')}{head('in', 'Called by')}{head('updated', 'Changed')}<th scope="col">What it does</th></tr>
          </thead>
          {groups.map((gr) => (
            <tbody key={gr.name}>
              <tr className="group-row"><th scope="rowgroup" colSpan={6}>{gr.name} <span className="muted small">· {gr.rows.length}</span></th></tr>
              {gr.rows.map((n) => (
                <tr key={n.id} className={selected === n.id ? 'sel' : ''}>
                  <td><button className={`row-link k-${n.kind}`} onClick={() => onPick(n.id)}>{n.name}</button></td>
                  <td>{KIND_LABEL[n.kind].replace(/s$/, '')}</td>
                  <td className="num">{out(n.id).length}</td>
                  <td className="num">{inn(n.id).length}</td>
                  <td className="mono small">{n.updated ?? ''}</td>
                  <td className="desc-cell">{n.desc}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}
