import { useState } from 'react'
import type { Graph, GraphNode, Kind } from '../shared/types'
import { index, KIND_LABEL, matches } from './derive'

type Props = { graph: Graph; query: string; kinds: Set<Kind>; selected: string | null; onPick: (id: string) => void }
type Col = 'name' | 'kind' | 'group' | 'out' | 'in' | 'updated'

export function TableView({ graph, query, kinds, selected, onPick }: Props) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'kind', dir: 1 })
  const { out, inn } = index(graph)
  const val = (n: GraphNode, c: Col): string | number =>
    c === 'out' ? out(n.id).length : c === 'in' ? inn(n.id).length : (n[c] ?? '')
  const rows = graph.nodes
    .filter((n) => (n.kind === 'harness' || kinds.has(n.kind)) && matches(n, query))
    .sort((a, b) => {
      const x = val(a, sort.col)
      const y = val(b, sort.col)
      return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name)) * sort.dir
    })

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
        <h2 id="table-h">Everything</h2>
        <span className="muted small">{rows.length} rows · click a header to sort</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>{head('name', 'Name')}{head('kind', 'Kind')}{head('group', 'Group')}{head('out', 'Calls')}{head('in', 'Called by')}{head('updated', 'Changed')}<th scope="col">What it does</th></tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className={selected === n.id ? 'sel' : ''}>
                <td><button className={`row-link k-${n.kind}`} onClick={() => onPick(n.id)}>{n.name}</button></td>
                <td>{KIND_LABEL[n.kind].replace(/s$/, '')}</td>
                <td>{n.group}</td>
                <td className="num">{out(n.id).length}</td>
                <td className="num">{inn(n.id).length}</td>
                <td className="mono small">{n.updated ?? ''}</td>
                <td className="desc-cell">{n.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
