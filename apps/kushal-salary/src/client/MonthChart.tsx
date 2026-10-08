import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Bar } from '../shared/salary'
import type { ChartMark } from './derive'
import { inr, monLabel } from './format'

const PADL = 78 // room for full rupee amounts on the y axis
const PADR = 12
const ROW = 16 // one row of event labels above the plot
const PLOT = 220
const XAXIS = 36 // month row + year row
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CHAR = 6.6 // px per character of the 11px mono label font
const MIN_STEP = 26 // px per month, so every month gets a label; a wider chart scrolls

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
 * Line chart of usual monthly pay, one point per month. A payout month adds an amber stem up to
 * what came in that month. Promotions and hikes are vertical markers. Hover, tap or arrow keys
 * move a crosshair with the month's full numbers.
 */
export default function MonthChart({ bars, labels, marks: markList }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(348)
  const [hover, setHover] = useState<number | null>(null)
  const tip = useRef<HTMLDivElement>(null)
  const [tipH, setTipH] = useState(0)
  useLayoutEffect(() => setTipH(tip.current?.offsetHeight ?? 0), [hover])
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBoxW(Math.max(Math.round(el.clientWidth), 260)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // The visible slice of a scrolled chart, so the tooltip and year label stay in view.
  const [view, setView] = useState({ l: 0, w: 348 })
  const onScroll = () => {
    const el = box.current
    if (el) setView({ l: el.scrollLeft, w: el.clientWidth })
  }

  const n = bars.length
  const W = Math.max(boxW, PADL + PADR + n * MIN_STEP)
  const step = (W - PADL - PADR) / n
  const cx = (i: number) => PADL + (i + 0.5) * step
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.scrollLeft = el.scrollWidth // open on the latest month
    onScroll()
  }, [n, W])
  const firstSeen = Math.min(n - 1, Math.max(0, Math.ceil((view.l + PADL) / step - 0.5)))
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

  const pay = bars.map((b, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(b.base).toFixed(1)}`).join('')

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
  useEffect(() => {
    const el = box.current
    if (!el || hover === null) return
    const x = cx(hover)
    if (x < el.scrollLeft + PADL + step) el.scrollLeft = x - PADL - step
    else if (x > el.scrollLeft + el.clientWidth - step) el.scrollLeft = x - el.clientWidth + step
  }, [hover])

  // Above the month's top dot when it fits; else beside it, so the box never hides the month.
  const GAP = 12
  const TIPW = 190
  const minL = view.l + PADL
  const maxL = view.l + view.w - TIPW
  const pos = (() => {
    if (!h || hover === null) return { left: 0, top: 0 }
    const x = cx(hover)
    const top = y(h.base + h.extra)
    if (top - GAP - tipH >= 0) return { left: Math.min(Math.max(x - TIPW / 2, minL), maxL), top: top - GAP - tipH }
    const mid = Math.min(Math.max((top + y(h.base)) / 2 - tipH / 2, 0), H - tipH)
    if (x + GAP <= maxL) return { left: x + GAP, top: mid }
    if (x - GAP - TIPW >= minL) return { left: x - GAP - TIPW, top: mid }
    // Too narrow for either side (phone): under the month's line dot.
    return { left: Math.min(Math.max(x - TIPW / 2, minL), maxL), top: Math.min(y(h.base) + GAP, H - tipH) }
  })()

  return (
    <div className="chart-frame">
      <div className="chart-scroll" ref={box} onScroll={onScroll}>
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
              </g>
            ))}
            {bars.map((b, i) => {
              const mo = Number(b.month.slice(5, 7))
              const showYear = i === firstSeen || (i > firstSeen && b.month.slice(0, 4) !== bars[i - 1].month.slice(0, 4))
              return (
                <g key={b.month}>
                  <line x1={cx(i)} x2={cx(i)} y1={BOT} y2={BOT + 4} className="tick" />
                  <text x={cx(i)} y={BOT + 16} textAnchor="middle" className="axis" data-testid="month-label">
                    {MON[mo - 1]}
                  </text>
                  {showYear && (
                    <text x={cx(i) - 9} y={BOT + 30} className="axis axis-year">
                      {b.month.slice(0, 4)}
                    </text>
                  )}
                </g>
              )
            })}
            {marks.map((m) => (
              <g key={`${m.type}-${m.i}`} data-testid="event-mark">
                <line x1={m.cx} x2={m.cx} y1={m.row * ROW + 14} y2={BOT} className={`guide guide-${m.type === 'promotion' ? 'promo' : 'hike'}`} />
                <text x={m.lx} y={m.row * ROW + 11} className={m.type === 'promotion' ? 'mark-promo' : 'mark-hike'}>
                  {m.text}
                </text>
              </g>
            ))}
            <path d={pay} className="line-pay" />
            {bars.map((b, i) =>
              b.extra > 0 ? (
                <g key={b.month} data-testid="payout-dot">
                  <line x1={cx(i)} x2={cx(i)} y1={y(b.base)} y2={y(b.base + b.extra)} className="stem-payout" />
                  <circle cx={cx(i)} cy={y(b.base + b.extra)} r={4} className="dot-payout" />
                </g>
              ) : null,
            )}
            {bars.map((b, i) => (
              <circle key={b.month} data-testid="month-point" cx={cx(i)} cy={y(b.base)} r={2.75} className="dot-month" />
            ))}
            {h && hover !== null && (
              <g className="crosshair">
                <line x1={cx(hover)} x2={cx(hover)} y1={TOP} y2={BOT} />
                <circle cx={cx(hover)} cy={y(h.base)} r={5} className="hover-pay" />
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
            <div ref={tip} className="chart-tip" data-testid="chart-tip" style={pos} role="status">
              <div className="tip-month">{monLabel(h.month)}</div>
              <div className="tip-row">
                <b>{inr(h.base)}</b>
                <span>monthly pay</span>
              </div>
              {h.extra > 0 && (
                <>
                  <div className="tip-row tip-payout">
                    <b>+{inr(h.extra)}</b>
                    <span>{(labels[h.month] ?? ['payout']).join(' + ').toLowerCase()}</span>
                  </div>
                  <div className="tip-row tip-total">
                    <b>{inr(h.base + h.extra)}</b>
                    <span>in bank</span>
                  </div>
                </>
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
      <svg className="chart y-axis" width={PADL} height={H} aria-hidden="true">
        <rect width={PADL} height={H} className="y-axis-bg" />
        {t.list.map((v) => (
          <text key={v} x={PADL - 8} y={y(v) + 3.5} textAnchor="end" className="axis">
            {inr(v)}
          </text>
        ))}
      </svg>
    </div>
  )
}
