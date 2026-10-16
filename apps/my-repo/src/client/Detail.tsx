import type { Graph, GraphNode } from '../shared/types'
import { index } from './derive'

type Props = { graph: Graph; id: string | null; onPick: (id: string) => void; onClose: () => void }

const KIND_TAG: Record<GraphNode['kind'], string> = { skill: 'SKILL', cli: 'CLI', mcp: 'MCP', harness: 'HARNESS', service: 'SERVICE' }
const VERB: Record<string, string> = { calls: 'calls', 'hands-off': 'hands off to', routes: 'routes to', reaches: 'reaches' }

export function Detail({ graph, id, onPick, onClose }: Props) {
  const { byId, out, inn } = index(graph)
  const n = id ? byId.get(id) : null
  if (!n) {
    return (
      <aside aria-label="Details" className="card detail">
        <h2 className="detail-empty-h">Pick anything</h2>
        <p className="muted">Click a box on the map, a harness item or a table row. Its path lights up, and this panel shows what it calls, what calls it and where it lives.</p>
      </aside>
    )
  }
  const findings = graph.findings.filter((f) => f.node === n.id)
  const LinkList = ({ ids, label }: { ids: { id: string; kind: string }[]; label: string }) =>
    ids.length ? (
      <>
        <h3>{label}</h3>
        <ul className="links">
          {ids.map(({ id: other, kind }) => {
            const o = byId.get(other)
            if (!o) return null
            return (
              <li key={other + kind}>
                <button className={`link k-${o.kind}`} onClick={() => onPick(o.id)}>
                  <span className="node-name">{o.name}</span>
                  <span className="muted small">{VERB[kind] ?? kind}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </>
    ) : null

  return (
    <aside aria-labelledby="detail-h" className="card detail">
      <div className="detail-head">
        <span className={`kind-tag k-${n.kind}`}>{KIND_TAG[n.kind]}</span>
        <h2 id="detail-h" className="mono">{n.name}</h2>
        <button className="btn ghost close" aria-label="Close details" onClick={onClose}>×</button>
      </div>
      {n.desc && <p className="desc">{n.desc}</p>}
      <dl className="facts">
        {n.path && (<><dt>Lives at</dt><dd className="mono">{n.path}</dd></>)}
        <dt>Group</dt><dd>{n.group}</dd>
        {n.descLen != null && (<><dt>Description</dt><dd>{n.descLen} / 500 chars</dd></>)}
        {n.updated && (<><dt>Changed</dt><dd>{n.updated}</dd></>)}
        {n.status && (<><dt>Status</dt><dd className="warn-text">{n.status}</dd></>)}
      </dl>
      {findings.length > 0 && (
        <ul className="finding-list">
          {findings.map((f, i) => <li key={i} className={`lvl-${f.level}`}>{f.text}</li>)}
        </ul>
      )}
      {n.triggers && n.triggers.length > 0 && (
        <>
          <h3>Fires on</h3>
          <div className="phrases">{n.triggers.map((t) => <span key={t} className="mono">{t}</span>)}</div>
        </>
      )}
      <LinkList label="Calls" ids={out(n.id).map((e) => ({ id: e.to, kind: e.kind }))} />
      <LinkList label="Called by" ids={inn(n.id).map((e) => ({ id: e.from, kind: e.kind }))} />
    </aside>
  )
}
