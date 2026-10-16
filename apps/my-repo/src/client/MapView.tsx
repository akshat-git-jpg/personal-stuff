import { useEffect, useMemo, useRef } from 'react'
import type { Graph } from '../shared/types'
import { BOX_H, LANES, layout, MAP_W, pathFor, trace, type Filters } from './derive'

type Props = { graph: Graph; filters: Filters; selected: string | null; onPick: (id: string) => void; onBack: () => void }

export function MapView({ graph, filters, selected, onPick, onBack }: Props) {
  const lay = useMemo(() => layout(graph, filters), [graph, filters])
  const lit = useMemo(() => trace(graph, selected), [graph, selected])
  const scroller = useRef<HTMLDivElement>(null)

  // Bring the picked box into view, e.g. after picking it from the table or loose ends.
  useEffect(() => {
    const box = selected ? scroller.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(selected)}"]`) : null
    box?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }, [selected])
  const on = (id: string) => !lit || lit.has(id)
  const skillCount = lay.boxes.filter((b) => b.lane === 1).length
  const area = graph.meta.areas.find((a) => a.name === filters.area && a.scope === filters.scope)

  return (
    <section aria-labelledby="map-h" className="card">
      <div className="card-head">
        <div className="crumb">
          <button className="btn ghost back" onClick={onBack}>← All areas</button>
          <h2 id="map-h">{filters.area}</h2>
        </div>
        <span className="muted small">
          {area?.blurb ? `${area.blurb} · ` : ''}{skillCount} skills · click any box to trace it
        </span>
      </div>
      {lay.boxes.length === 0 ? (
        <p className="muted empty">Nothing matches. Clear the search or turn a filter back on.</p>
      ) : (
        <div className="map-scroll" ref={scroller}>
          <div className="lane-head" style={{ width: MAP_W }}>
            {LANES.map((l) => (
              <div key={l.key} className="lane-title" style={{ left: l.x, width: l.w }}>{l.title}</div>
            ))}
          </div>
          <div className="map" style={{ width: MAP_W, height: lay.height }}>
            <svg aria-hidden="true" width={MAP_W} height={lay.height} className="lines">
              {lay.lines.map((l, i) => {
                const hot = !!lit && lit.has(l.from.node.id) && lit.has(l.to.node.id)
                return (
                  <path
                    key={i}
                    d={pathFor(l)}
                    className={`line ${l.kind === 'hands-off' ? 'dashed' : ''} ${hot ? 'hot' : lit ? 'dim' : ''}`}
                  />
                )
              })}
            </svg>
            {lay.boxes.map((b) => {
              const lane = LANES[b.lane]
              const style = { left: lane.x, top: b.y, width: lane.w, height: BOX_H }
              if (b.lane === 0) {
                return (
                  <div key={`p-${b.node.id}`} className={`phrase ${on(b.node.id) ? '' : 'dim'}`} style={style} title={b.phrase}>
                    “{b.phrase}”
                  </div>
                )
              }
              const n = b.node
              return (
                <button
                  key={n.id}
                  data-id={n.id}
                  className={`node k-${n.kind} ${selected === n.id ? 'sel' : ''} ${on(n.id) ? '' : 'dim'} ${n.status ? `st-${n.status}` : ''}`}
                  style={style}
                  onClick={() => onPick(n.id)}
                  title={n.desc}
                >
                  <span className="node-name">{n.name}</span>
                  {b.away && <span className="away">{b.away}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="legend">
        <span><i className="sw k-skill" />Skill · rounded</span>
        <span><i className="sw k-cli" />CLI · square</span>
        <span><i className="sw k-mcp" />MCP · pill</span>
        <span><i className="sw k-service" />Outside service</span>
        <span><i className="sw-line" />skill hands off to skill</span>
        <span><span className="away static">Area</span>lives in another area</span>
      </div>
    </section>
  )
}
