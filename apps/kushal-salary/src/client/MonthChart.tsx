import { useEffect, useRef, useState } from 'react'
import type { Bar } from '../shared/salary'
import type { ChartMark } from './derive'
import { k, monLabel } from './format'

const TOP_PAD = 24 // room for the payout label over the tallest bar
const PLOT = 200
const BOT = PLOT // x axis
const STRIP = BOT + 40 // first row of event labels, under the year labels
const ROW = 18
const CHAR = 6.8 // px per character of the 11px mono label font
const PADL = 44 // left margin for the grid amounts

type Props = { bars: Bar[]; labels: Record<string, string[]>; marks: ChartMark[] }

/** Event labels in rows under the axis; a label drops to the next row when it would overlap one already placed. */
function placeLabels(marks: (ChartMark & { cx: number })[], W: number) {
  const rows: number[][][] = []
  return marks.map((m) => {
    const w = m.text.length * CHAR + 14
    const x0 = Math.max(0, Math.min(m.cx - 6, W - w))
    let r = 0
    while (rows[r]?.some(([a, b]) => x0 < b + 8 && x0 + w > a)) r++
    ;(rows[r] ??= []).push([x0, x0 + w])
    return { ...m, lx: x0, row: r }
  })
}

/** One bar per month: normal pay, with any one-time payout stacked on top; a step line of normal pay; event dots. */
export default function MonthChart({ bars, labels, marks: markList }: Props) {
  // Draw at the box's real pixel width so text never scales up on wide screens.
  const box = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(348)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBoxW(Math.max(Math.round(el.clientWidth), 280)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = bars.length
  // Fit the box; only a very long history (under 6px a month) scrolls sideways.
  const W = Math.max(boxW, PADL + n * 6)
  const step = (W - PADL) / n
  const bw = Math.max(Math.min(step - 2, 28), 3)
  const peak = Math.max(...bars.map((b) => b.base + b.extra), 1)
  const max = Math.ceil(peak / 50000) * 50000
  const y = (v: number) => BOT - (v / max) * PLOT
  const xOf = (i: number) => PADL + i * step + (step - bw) / 2
  let path = ''
  bars.forEach((b, i) => {
    path += `${i ? 'L' : 'M'}${(PADL + i * step).toFixed(1)},${y(b.base).toFixed(1)}L${(PADL + (i + 1) * step).toFixed(1)},${y(b.base).toFixed(1)}`
  })
  const grid = [max / 4, max / 2, max]

  const marks = placeLabels(
    markList.map((m) => ({ ...m, cx: PADL + m.i * step })),
    W,
  )
  const rows = marks.reduce((a, m) => Math.max(a, m.row + 1), 0)
  const H = STRIP + rows * ROW

  return (
    <div className="chart-scroll" ref={box}>
      <svg
        className="chart"
        data-testid="month-chart"
        viewBox={`0 ${-TOP_PAD} ${W} ${H + TOP_PAD}`}
        width={W}
        height={H + TOP_PAD}
        role="img"
        aria-label="Pay each month"
      >
        {grid.map((g) => (
          <line key={g} x1={PADL} x2={W} y1={y(g)} y2={y(g)} className="grid" />
        ))}
        {bars.map((b, i) => {
          const x = xOf(i)
          const tip = `${monLabel(b.month)} · ${k(b.base)}${b.extra ? ` + ${k(b.extra)} ${(labels[b.month] ?? []).join(' + ').toLowerCase()}` : ''}`
          return (
            <g key={b.month}>
              <rect data-testid="base-bar" x={x} width={bw} y={y(b.base)} height={BOT - y(b.base)} className="bar">
                <title>{tip}</title>
              </rect>
              {b.extra > 0 && (
                <>
                  <rect
                    data-testid="payout-bar"
                    x={x}
                    width={bw}
                    y={y(b.base + b.extra)}
                    height={y(b.base) - y(b.base + b.extra)}
                    rx={2}
                    className="bar-payout"
                  >
                    <title>{tip}</title>
                  </rect>
                  <text x={x + bw / 2} y={y(b.base + b.extra) - 6} textAnchor="middle" className="payout-label">
                    +{k(b.extra)}
                  </text>
                </>
              )}
              {(i === 0 || b.month.endsWith('-01')) && (
                <text x={x} y={BOT + 16} className="axis">
                  {b.month.slice(0, 4)}
                </text>
              )}
            </g>
          )
        })}
        <path d={path} className="step" />
        {grid.map((g) => (
          <text key={g} x={PADL - 6} y={y(g) + 3} textAnchor="end" className="axis">
            {k(g)}
          </text>
        ))}
        {marks.map((m) => {
          const cy = y(bars[m.i].base)
          const ly = STRIP + m.row * ROW
          const cls = m.type === 'promotion' ? 'promo' : 'hike'
          return (
            <g key={`${m.type}-${m.i}`}>
              <line x1={m.cx} x2={m.cx} y1={cy} y2={ly - 12} className={`guide guide-${cls}`} />
              <circle cx={m.cx} cy={cy} r={m.type === 'promotion' ? 6 : 5} className={`dot-${cls}`} />
              <circle cx={m.lx + 4} cy={ly - 4} r={3.5} className={`dot-${cls}`} />
              <text x={m.lx + 12} y={ly} className={`mark-${cls}`}>
                {m.text}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
