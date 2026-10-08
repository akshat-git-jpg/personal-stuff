import { useState } from 'react'
import { arrearsOf, bars, variableOf, type Mode, type Month } from '../shared/salary'
import { chartMarks, summary } from './derive'
import { inr, monLabel, plural } from './format'
import MonthChart from './MonthChart'

const MODE_KEY = 'ksalary.mode'

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'gross' ? 'gross' : 'net'
  } catch {
    return 'net'
  }
}

export function Empty() {
  return (
    <section className="card stack-8" data-testid="empty">
      <p>No payslips yet.</p>
      <p className="muted small">In a Claude session, say "add my payslips".</p>
    </section>
  )
}

export default function MonthsTab({ months }: { months: Month[] }) {
  const [mode, setModeState] = useState<Mode>(readMode)
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* private window: the choice just isn't remembered */
    }
  }

  if (!months.length) {
    return (
      <div className="page" data-testid="months-tab">
        <Empty />
      </div>
    )
  }

  const s = summary(months, mode)
  const b = bars(months, mode)
  const labels: Record<string, string[]> = {}
  for (const m of months) {
    const l = m.items.filter((i) => i.category === 'variable').map((i) => i.label)
    if (arrearsOf(m) > 0) l.push('Arrears')
    if (variableOf(m) + arrearsOf(m) > 0) labels[m.month] = l
  }
  const recent = b.slice(-6).reverse()
  const pdf = new Map(months.map((m) => [m.month, m.has_pdf]))

  return (
    <div className="page" data-testid="months-tab">
      <div className="stack">
        <h1 className="h1">
          Monthly pay up {s.growth}× since {monLabel(s.firstMonth)}
        </h1>
        <p className="soft small" data-testid="sub">
          Fixed pay {inr(s.fixedFirst * 12)} → {inr(s.fixedLast * 12)} a year · {plural(s.promotions, 'promotion')} ·{' '}
          {plural(s.hikes, 'hike')} · {plural(s.payouts, 'payout')}
        </p>
      </div>

      <section className="card stack-16">
        <div className="section-head">
          <h2 className="h2">Pay each month</h2>
          <div className="segmented" role="group" aria-label="Amount">
            {(['net', 'gross'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === 'net' ? 'Net' : 'Gross'}
              </button>
            ))}
          </div>
        </div>
        <MonthChart bars={b} labels={labels} marks={chartMarks(months)} />
        <div className="legend">
          <span>
            <i className="lg-pay" />
            monthly pay
          </span>
          <span>
            <i className="lg-payout" />
            extra that month
          </span>
          <span>
            <i className="lg-promo" />
            promotion
          </span>
          <span>
            <i className="lg-hike" />
            hike
          </span>
        </div>
        <p className="muted small">Hover or tap the chart to see each month.</p>
      </section>

      <div className="kpis" data-testid="kpis">
        <div className="card kpi">
          <b>{inr(s.latestBase)}</b>
          <span>monthly pay</span>
        </div>
        <div className="card kpi">
          <b className="payout">{inr(s.allPayouts)}</b>
          <span>all payouts</span>
        </div>
        <div className="card kpi">
          <b>{inr(s.fy)}</b>
          <span>{s.fyLabel} so far</span>
        </div>
      </div>

      <section className="card rows" data-testid="recent">
        {recent.map((r) => {
          const body = (
            <>
              <span>{monLabel(r.month)}</span>
              <span className="mono">
                {inr(r.base)}
                {r.extra > 0 && <span className="payout"> + {inr(r.extra)}</span>}
              </span>
            </>
          )
          return pdf.get(r.month) ? (
            <a key={r.month} className="row" href={`/api/months/${r.month}/pdf`} target="_blank" rel="noopener">
              {body}
            </a>
          ) : (
            <div key={r.month} className="row">
              {body}
            </div>
          )
        })}
      </section>
      <p className="muted small">
        {mode === 'net' ? 'Net is what reached the bank.' : 'Gross is before tax and PF.'} Tap a month to open its payslip.
      </p>
    </div>
  )
}
