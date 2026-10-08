import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Bar } from '../shared/salary'
import type { ChartMark } from './derive'
import { inr, monLabel } from './format'

const PADL = 78 // room for full rupee amounts on the y axis
const PADR = 12
const ROW = 16 // one row of event labels above the plot
const PLOT = 220
const XAXIS = 22
const CHAR = 6.6 // px per character of the 11px mono label font

type Props = { bars: Bar[]; labels: Record<string, string[]>; marks: ChartMark[] }

/** Event labels in rows above the plot; a label moves up a row when it would overlap one already placed. */
function placeLabels(marks: (ChartMark & { cx: number })[], W: number) {
  const rows: number[][][] = []
  return marks.map((m) => {
    const w = m.text.length * CHAR + 6
    const x0 = Math.max(PADL, Math.min(m.cx - 4, W - PADR - w))
    let r = 0
    while (rows[r]?.some(([a, b]) => x0 < b + 10 && x0 + w > a)) r++
    ;(rows[r] ??= []).push([x0, x0 + w])
    return { ...m, lx: x0, row: r }
  })
}

/** Zero-based ticks on a tidy step, at most 5 lines. */
function ticks(peak: number) {
  const step = [25000, 50000, 100000, 200000, 500000, 1000000].find((st) => Math.ceil(peak / st) <= 4) ?? 2000000
  const max = Math.ceil(peak / step) * step
  const list: number[] = []
  for (let v = 0; v <= max; v += step) list.push(v)
  return { max, list }
}

/**
 * Line chart, one point per month: a solid line for what was paid that month (payout months
 * spike up and get a dot) and a dashed line for normal pay. Promotions and hikes are vertical
 * markers. Hover, tap or arrow keys move a crosshair with the month's full numbers.
 */
export default function MonthChart({ bars, labels, marks: markList }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(348)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBoxW(Math.max(Math.round(el.clientWidth), 260)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = bars.length
  const W = Math.max(boxW, PADL + PADR + n * 5)
  const step = (W - PADL - PADR) / n
  const cx = (i: number) => PADL + (i + 0.5) * step
  const t = ticks(Math.max(...bars.map((b) => b.base + b.extra), 1))

  const marks = placeLabels(
    markList.map((m) => ({ ...m, cx: cx(m.i) })),
    W,
  )
  const rows = marks.reduce((a, m) => Math.max(a, m.row + 1), 0)
  const TOP = rows * ROW + 10
  const BOT = TOP + PLOT
  const H = BOT + XAXIS
  const y = (v: number) => BOT - (v / t.max) * PLOT

  const line = (f: (b: Bar) => number) => bars.map((b, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(f(b)).toFixed(1)}`).join('')
  const paid = line((b) => b.base + b.extra)
  const normal = line((b) => b.base)

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left) / step)
    setHover(Math.min(n - 1, Math.max(0, i)))
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === 'ArrowRight' ? 1 : -1))))
  }

  const h = hover === null ? null : bars[hover]
  const hMarks = hover === null ? [] : markList.filter((m) => m.i === hover)
  const tipLeft = hover === null ? 0 : Math.min(Math.max(cx(hover) - 95, 0), W - 190)

  return (
    <div className="chart-scroll" ref={box}>
      <div className="chart-wrap" style={{ width: W }}>
        <svg
          className="chart"
          data-testid="month-chart"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Pay each month. Use the left and right arrow keys to read each month."
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setHover((v) => v ?? n - 1)}
          onBlur={() => setHover(null)}
        >
          {t.list.map((v) => (
            <g key={v}>
              <line x1={PADL} x2={W - PADR} y1={y(v)} y2={y(v)} className={v === 0 ? 'baseline' : 'grid'} />
              <text x={PADL - 8} y={y(v) + 3.5} textAnchor="end" className="axis">
                {inr(v)}
              </text>
            </g>
          ))}
          {bars.map((b, i) =>
            i === 0 || b.month.endsWith('-01') ? (
              <text key={b.month} x={cx(i)} y={BOT + 16} textAnchor={i === 0 ? 'start' : 'middle'} className="axis">
                {i === 0 ? monLabel(b.month) : b.month.slice(0, 4)}
              </text>
            ) : null,
          )}
          {marks.map((m) => (
            <g key={`${m.type}-${m.i}`} data-testid="event-mark">
              <line x1={m.cx} x2={m.cx} y1={m.row * ROW + 14} y2={BOT} className={`guide guide-${m.type === 'promotion' ? 'promo' : 'hike'}`} />
              <text x={m.lx} y={m.row * ROW + 11} className={m.type === 'promotion' ? 'mark-promo' : 'mark-hike'}>
                {m.text}
              </text>
            </g>
          ))}
          <path d={normal} className="line-normal" />
          <path d={paid} className="line-paid" />
          {bars.map((b, i) =>
            b.extra > 0 ? <circle key={b.month} data-testid="payout-dot" cx={cx(i)} cy={y(b.base + b.extra)} r={4.5} className="dot-payout" /> : null,
          )}
          {h && hover !== null && (
            <g className="crosshair">
              <line x1={cx(hover)} x2={cx(hover)} y1={TOP} y2={BOT} />
              <circle cx={cx(hover)} cy={y(h.base)} r={4} className="hover-normal" />
              <circle cx={cx(hover)} cy={y(h.base + h.extra)} r={5} className="hover-paid" />
            </g>
          )}
          <rect
            x={PADL}
            y={0}
            width={W - PADL - PADR}
            height={BOT}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
          />
        </svg>
        {h && hover !== null && (
          <div className="chart-tip" data-testid="chart-tip" style={{ left: tipLeft, top: TOP + 6 }} role="status">
            <div className="tip-month">{monLabel(h.month)}</div>
            <div className="tip-row">
              <i className="key-paid" />
              <b>{inr(h.base + h.extra)}</b>
              <span>paid</span>
            </div>
            <div className="tip-row">
              <i className="key-normal" />
              <b>{inr(h.base)}</b>
              <span>normal</span>
            </div>
            {h.extra > 0 && (
              <div className="tip-row tip-payout">
                <b>+{inr(h.extra)}</b>
                <span>{(labels[h.month] ?? ['payout']).join(' + ').toLowerCase()}</span>
              </div>
            )}
            {hMarks.map((m) => (
              <div key={m.type} className={`tip-row ${m.type === 'promotion' ? 'tip-promo' : 'tip-hike'}`}>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
