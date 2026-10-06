import { useEffect, useRef, useState } from 'react'
import type { MarkerSeries } from '../shared/types'
import { statusOf } from '../shared/status'
import { STATUS_COLOR, STATUS_LABEL, fmtDate, fmtShort } from './format'

const W = 340

/** Line chart with the latest range as a green band; hover, focus or tap a point to see its date. */
export default function LineChart({
  series,
  height,
  labs = {},
  values = true,
}: {
  series: MarkerSeries
  height: number
  labs?: Record<string, string>
  values?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // A tap anywhere outside the chart closes the tooltip (touch has no mouseleave).
  useEffect(() => {
    if (active === null) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [active])

  const pts = series.points.filter((p) => p.value_num !== null)
  if (pts.length === 0) return null
  const last = series.points[series.points.length - 1]
  const top = values ? 24 : 12
  const bottom = 22

  const vals = pts.map((p) => p.value_num as number)
  const refs = [last.ref_low, last.ref_high].filter((v): v is number => v !== null)
  let mn = Math.min(...vals, ...refs)
  let mx = Math.max(...vals, ...refs)
  if (mn === mx) {
    mn -= Math.abs(mn) * 0.1 || 1
    mx += Math.abs(mx) * 0.1 || 1
  }
  const pad = (mx - mn) * 0.15
  mn -= pad
  mx += pad

  const times = pts.map((p) => Date.parse(p.collected_on))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const padX = 28
  const x = (t: number) => (t1 === t0 ? W / 2 : padX + ((t - t0) / (t1 - t0)) * (W - 2 * padX))
  const y = (v: number) => top + (1 - (v - mn) / (mx - mn)) * (height - top - bottom)

  const xy = pts.map((p, i) => ({ p, x: x(times[i]), y: y(p.value_num as number) }))
  const line = xy.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')
  const area = `${line} ${xy[xy.length - 1].x.toFixed(1)},${height - bottom} ${xy[0].x.toFixed(1)},${height - bottom}`
  const bandTop = y(last.ref_high ?? mx)
  const bandBottom = y(last.ref_low ?? mn)
  const hasBand = last.ref_low !== null || last.ref_high !== null
  const lastStatus = statusOf(last)
  const lineColor = STATUS_COLOR[lastStatus]
  const dense = xy.length > 6
  const a = active !== null ? xy[active] : null

  return (
    <div className="lc" ref={box} onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${height}`} className="lc-svg" role="img" aria-label={`${series.name} over time`}>
        {hasBand && <rect className="lc-band" x={0} y={bandTop} width={W} height={Math.max(0, bandBottom - bandTop)} />}
        {last.ref_high !== null && <line className="lc-limit" x1={0} x2={W} y1={bandTop} y2={bandTop} />}
        {xy.length > 1 && <polyline points={area} fill={lineColor} fillOpacity={0.1} stroke="none" />}
        {xy.length > 1 && <polyline className="lc-line" points={line} stroke={lineColor} fill="none" />}
        {a && <line className="lc-guide" x1={a.x} x2={a.x} y1={top - 6} y2={height - bottom} />}
        {xy.map((d, i) => {
          const showLabel = !dense || i === 0 || i === xy.length - 1
          return (
            <g key={d.p.report_id}>
              {values && showLabel && (
                <text className="lc-value" x={d.x} y={d.y - 10} textAnchor="middle">
                  {d.p.value_text}
                </text>
              )}
              {showLabel && (
                <text className="lc-date" x={d.x} y={height - 6} textAnchor="middle">
                  {fmtShort(d.p.collected_on)}
                </text>
              )}
              <circle cx={d.x} cy={d.y} r={active === i ? 6 : 4.5} fill={STATUS_COLOR[statusOf(d.p)]} className="lc-dot" />
              <circle
                cx={d.x}
                cy={d.y}
                r={16}
                className="lc-hit"
                tabIndex={0}
                aria-label={`${fmtDate(d.p.collected_on)}: ${d.p.value_text} ${d.p.unit}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={(e) => {
                  // inside a card link: show the point, do not navigate
                  e.preventDefault()
                  e.stopPropagation()
                  setActive(i)
                }}
              />
            </g>
          )
        })}
      </svg>
      {a && (
        <div
          className="lc-tip"
          role="tooltip"
          style={{ left: `${Math.min(80, Math.max(20, (a.x / W) * 100))}%`, top: `${(a.y / height) * 100}%` }}
        >
          <div className="lc-tip-date">{fmtDate(a.p.collected_on)}</div>
          <div className="lc-tip-val">
            {a.p.value_text} <span className="unit">{a.p.unit}</span>
          </div>
          <div className="lc-tip-meta" style={{ color: STATUS_COLOR[statusOf(a.p)] }}>
            {STATUS_LABEL[statusOf(a.p)]}
            {labs[a.p.report_id] ? <span className="lc-tip-lab"> · {labs[a.p.report_id]}</span> : null}
          </div>
        </div>
      )}
    </div>
  )
}
