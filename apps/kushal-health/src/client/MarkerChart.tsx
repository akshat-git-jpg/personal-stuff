import type { MarkerSeries } from '../shared/types'
import { statusOf } from '../shared/status'
import { STATUS_COLOR, fmtShort } from './format'

const DIMS = {
  small: { w: 96, h: 28, padX: 4, padTop: 4, padBottom: 4, r: 2.2 },
  large: { w: 320, h: 160, padX: 26, padTop: 22, padBottom: 22, r: 4 },
}

/** Inline SVG line chart with the latest reference range as a green band. */
export default function MarkerChart({ series, size }: { series: MarkerSeries; size: 'small' | 'large' }) {
  const pts = series.points.filter((p) => p.value_num !== null)
  if (pts.length === 0) return null
  const d = DIMS[size]
  const last = series.points[series.points.length - 1]

  const values = pts.map((p) => p.value_num as number)
  const refs = [last.ref_low, last.ref_high].filter((v): v is number => v !== null)
  let min = Math.min(...values, ...refs)
  let max = Math.max(...values, ...refs)
  if (min === max) {
    min -= Math.abs(min) * 0.1 || 1
    max += Math.abs(max) * 0.1 || 1
  }
  const pad = (max - min) * 0.1
  min -= pad
  max += pad

  const times = pts.map((p) => Date.parse(p.collected_on))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const x = (t: number) => (t1 === t0 ? d.w / 2 : d.padX + ((t - t0) / (t1 - t0)) * (d.w - 2 * d.padX))
  const y = (v: number) => d.padTop + (1 - (v - min) / (max - min)) * (d.h - d.padTop - d.padBottom)

  const bandTop = y(last.ref_high ?? max)
  const bandBottom = y(last.ref_low ?? min)
  const hasBand = last.ref_low !== null || last.ref_high !== null
  const line = pts.map((p, i) => `${x(times[i])},${y(p.value_num as number)}`).join(' ')

  return (
    <svg
      className={`chart chart-${size}`}
      viewBox={`0 0 ${d.w} ${d.h}`}
      role="img"
      aria-label={`${series.name} over time`}
      preserveAspectRatio={size === 'small' ? 'none' : 'xMidYMid meet'}
    >
      {hasBand && (
        <rect className="ref-band" x={0} y={bandTop} width={d.w} height={Math.max(0, bandBottom - bandTop)} />
      )}
      {pts.length > 1 && <polyline className="chart-line" points={line} fill="none" />}
      {pts.map((p, i) => {
        const cx = x(times[i])
        const cy = y(p.value_num as number)
        return (
          <g key={p.report_id}>
            <circle cx={cx} cy={cy} r={d.r} fill={STATUS_COLOR[statusOf(p)]} />
            {size === 'large' && (
              <>
                <text className="chart-value" x={cx} y={cy - 8} textAnchor="middle">
                  {p.value_text}
                </text>
                <text className="chart-date" x={cx} y={d.h - 6} textAnchor="middle">
                  {fmtShort(p.collected_on)}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
