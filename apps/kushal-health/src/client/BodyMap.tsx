import type { BloodData } from '../shared/types'
import { PARTS, partStatus } from './derive'
import { BUCKET_COLOR } from './format'

const CHIP_W = 96
const R_EDGE = 254
const L_EDGE = 8 + CHIP_W

/** Figure with one dot + button per body part; a button filters the test list. */
export default function BodyMap({
  data,
  selected,
  onPick,
}: {
  data: BloodData
  selected: string | null
  onPick: (key: string | null) => void
}) {
  return (
    <div className="body">
      <svg width="358" height="440" viewBox="0 0 358 440" className="body-fig" aria-hidden="true">
        <g>
          <circle cx="179" cy="52" r="28" />
          <rect x="167" y="78" width="24" height="22" rx="8" />
          <path d="M131 104 Q179 92 227 104 L238 236 Q179 256 120 236 Z" />
          <path d="M131 108 Q110 112 104 140 L92 250 Q90 262 100 262 Q108 262 110 250 L124 150 Z" />
          <path d="M227 108 Q248 112 254 140 L266 250 Q268 262 258 262 Q250 262 248 250 L234 150 Z" />
          <path d="M124 238 Q150 252 176 248 L172 420 Q160 428 150 420 L136 300 Z" />
          <path d="M234 238 Q208 252 182 248 L186 420 Q198 428 208 420 L222 300 Z" />
        </g>
      </svg>
      {PARTS.map((p) => {
        const s = partStatus(data, p)
        const color = BUCKET_COLOR[s.worst]
        const on = selected === p.key
        const lineL = p.side === 'R' ? p.x : L_EDGE
        const lineW = p.side === 'R' ? R_EDGE - p.x : p.x - L_EDGE
        return (
          <div key={p.key}>
            <div className="body-line" style={{ left: lineL, top: p.y, width: Math.max(0, lineW), background: color }} />
            <div
              className={`body-dot body-dot-${s.worst}`}
              style={{ left: p.x - 7, top: p.y - 7, background: color }}
            />
            <button
              type="button"
              className={on ? 'body-chip on' : 'body-chip'}
              data-testid={`part-${p.key}`}
              aria-pressed={on}
              disabled={s.count === 0}
              style={{ left: p.side === 'R' ? R_EDGE : 8, top: p.y - 20, borderColor: on ? color : undefined }}
              onClick={() => onPick(on ? null : p.key)}
            >
              <span className="body-chip-name">{p.name}</span>
              <span className="body-chip-sum" style={{ color }}>
                {s.summary}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
