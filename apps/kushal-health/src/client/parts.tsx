// Small shared pieces: status chip, range bar, sparkline.
import type { MarkerPoint, MarkerSeries } from '../shared/types'
import { statusOf, type Status } from '../shared/status'
import { rangeBar } from './derive'
import { STATUS_CLASS, STATUS_COLOR, STATUS_LABEL, fmtDate } from './format'

export function Chip({ status, extra }: { status: Status; extra?: string }) {
  return (
    <span className={`chip ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
      {extra ? ` · ${extra}` : ''}
    </span>
  )
}

export function RangeBar({ point, big = false }: { point: MarkerPoint; big?: boolean }) {
  const b = rangeBar(point)
  if (!b) return null
  const color = STATUS_COLOR[statusOf(point)]
  return (
    <div className={big ? 'rb rb-big' : 'rb'} aria-hidden="true">
      <div className="rb-track">
        <div className="rb-out" style={{ width: `${b.lowW}%` }} />
        <div className="rb-in" style={{ width: `${b.okW}%` }} />
        <div className="rb-out" style={{ width: `${b.highW}%` }} />
      </div>
      <div className="rb-mark" style={{ left: `${b.pos}%`, background: color }} />
      {big && (
        <div className="rb-ticks">
          {b.loPos !== null && <span style={{ left: `${b.loPos}%` }}>{point.ref_low}</span>}
          {b.hiPos !== null && <span style={{ left: `${b.hiPos}%` }}>{point.ref_high}</span>}
        </div>
      )}
    </div>
  )
}

/** Tiny trend line. Its <title> lists every test date, so a hover shows the history. */
export function Sparkline({ series }: { series: MarkerSeries }) {
  const pts = series.points.filter((p) => p.value_num !== null)
  if (pts.length === 0) return null
  const w = 72
  const h = 32
  const last = series.points[series.points.length - 1]
  const vals = pts.map((p) => p.value_num as number)
  const refs = [last.ref_low, last.ref_high].filter((v): v is number => v !== null)
  let mn = Math.min(...vals, ...refs)
  let mx = Math.max(...vals, ...refs)
  if (mn === mx) {
    mn -= 1
    mx += 1
  }
  const pad = (mx - mn) * 0.15
  mn -= pad
  mx += pad
  const times = pts.map((p) => Date.parse(p.collected_on))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const x = (t: number) => (t1 === t0 ? w / 2 : 4 + ((t - t0) / (t1 - t0)) * (w - 8))
  const y = (v: number) => 4 + (1 - (v - mn) / (mx - mn)) * (h - 8)
  const xy = pts.map((p, i) => [x(times[i]), y(p.value_num as number)] as const)
  const color = STATUS_COLOR[statusOf(last)]
  const title = pts.map((p) => `${fmtDate(p.collected_on)}: ${p.value_text}`).join('\n')
  const [lx, ly] = xy[xy.length - 1]
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <title>{title}</title>
      {xy.length > 1 && (
        <polyline
          points={xy.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <circle cx={lx} cy={ly} r={2.8} fill={color} />
    </svg>
  )
}
