import { useState } from 'react'
import type { BloodData, MarkerSeries } from '../shared/types'
import { statusOf } from '../shared/status'
import { labsById, latest, latestCounts, PARTS, sortedMarkers, testDates, worries } from './derive'
import { fmtDate, fmtShort, fmtSpan } from './format'
import BodyMap from './BodyMap'
import LineChart from './LineChart'
import { Chip, RangeBar, Sparkline } from './parts'

export const markerHref = (key: string) => `#/m/${key}`

function WorryCard({ m, labs }: { m: MarkerSeries; labs: Record<string, string> }) {
  const p = latest(m)
  const nums = m.points.filter((x) => x.value_num !== null)
  return (
    <a className="card worry" href={markerHref(m.key)} data-testid={`worry-${m.key}`}>
      <div className="worry-head">
        <div className="stack">
          <span className="worry-name">{m.name}</span>
          <span className="muted small">
            {m.panel} · normal {p.ref_text || 'no range'}
          </span>
        </div>
        <Chip status={statusOf(p)} />
      </div>
      <div className="big-value">
        <span className="num">{p.value_text}</span>
        <span className="muted">{p.unit}</span>
      </div>
      <span className="soft small">
        {nums.map((x) => x.value_text).join(' → ')} · {nums.length} tests, {fmtSpan(nums.map((x) => x.collected_on))}
      </span>
      <LineChart series={m} height={120} labs={labs} />
    </a>
  )
}

function MarkerRow({ m, first }: { m: MarkerSeries; first: boolean }) {
  const p = latest(m)
  const s = statusOf(p)
  const dates = m.points.map((x) => x.collected_on)
  const note = s === 'normal' ? '' : s === 'borderline' ? ' · near edge' : s === 'unknown' ? ' · no range' : ` · ${s}`
  return (
    <a className={first ? 'row' : 'row row-sep'} href={markerHref(m.key)} data-testid={`marker-${m.key}`}>
      <div className="row-main">
        <div className="row-top">
          <span className="row-name">{m.name}</span>
          <span className={`row-val st-${s}`}>
            {p.value_text} <span className="unit">{p.unit}</span>
          </span>
        </div>
        <RangeBar point={p} />
        <span className="row-sub">
          {dates.length === 1 ? `1 test · ${fmtShort(dates[0])}` : `${dates.length} tests · ${fmtSpan(dates)}`}
          {note}
        </span>
      </div>
      <Sparkline series={m} />
    </a>
  )
}

export default function BloodTab({ data }: { data: BloodData }) {
  const [part, setPart] = useState<string | null>(null)

  if (data.reports.length === 0) {
    return (
      <section className="card empty">
        <p className="empty-title">No blood reports yet.</p>
        <p className="muted">Ask Claude: add my blood report &lt;path to PDF&gt;</p>
      </section>
    )
  }

  const newest = data.reports[0].collected_on
  const latestReports = data.reports.filter((r) => r.collected_on === newest)
  const c = latestCounts(data)
  const total = c.bad + c.edge + c.ok || 1
  const labs = labsById(data.reports)
  const top = worries(data)
  const rows = sortedMarkers(data, part)
  const partName = PARTS.find((p) => p.key === part)?.name
  const dates = testDates(data)

  return (
    <div className="home">
      <section className="card summary" data-testid="verdict">
        <div className="summary-head">
          <span className="muted small">Latest report · {fmtDate(newest)}</span>
          <span className="muted small">{[...new Set(latestReports.map((r) => r.lab))].join(' + ')}</span>
        </div>
        <div className="seg" aria-hidden="true">
          <div className="seg-bad" style={{ width: `${(c.bad / total) * 100}%` }} />
          <div className="seg-edge" style={{ width: `${(c.edge / total) * 100}%` }} />
          <div className="seg-ok" style={{ width: `${(c.ok / total) * 100}%` }} />
        </div>
        <div className="counts">
          <div className="count">
            <span className="count-num st-high">{c.bad}</span>
            <span className="count-label">out of range</span>
          </div>
          <div className="count">
            <span className="count-num st-borderline">{c.edge}</span>
            <span className="count-label">near edge</span>
          </div>
          <div className="count">
            <span className="count-num st-normal">{c.ok}</span>
            <span className="count-label">normal</span>
          </div>
        </div>
        {latestReports.map((r) => (
          <p key={r.id} className="verdict-text">
            {r.verdict || 'No written verdict for this report.'}
          </p>
        ))}
        <div className="dates" data-testid="test-dates">
          <span className="muted small">Test dates in this history</span>
          <div className="date-chips">
            {dates.map((d) => (
              <span key={d} className={d === newest ? 'date-chip on' : 'date-chip'}>
                {fmtDate(d)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {top.length > 0 && (
        <section className="section" data-testid="worries">
          <h2 className="h2">Getting worse</h2>
          {top.map((m) => (
            <WorryCard key={m.key} m={m} labs={labs} />
          ))}
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="h2">Your body</h2>
          <span className="muted small">tap a part to filter</span>
        </div>
        <BodyMap data={data} selected={part} onPick={setPart} />
      </section>

      <section className="section" data-testid="tests">
        <div className="section-head">
          <h2 className="h2">{partName ? `${partName} tests` : 'All tests'}</h2>
          {part ? (
            <button type="button" className="btn btn-small" onClick={() => setPart(null)}>
              Show all
            </button>
          ) : (
            <span className="muted small">worst first</span>
          )}
        </div>
        <div className="card list">
          {rows.map((m, i) => (
            <MarkerRow key={m.key} m={m} first={i === 0} />
          ))}
        </div>
      </section>

      <section className="section" data-testid="reports">
        <h2 className="h2">Reports</h2>
        <div className="card list">
          {data.reports.map((r, i) => (
            <div key={r.id} className={i === 0 ? 'report' : 'report row-sep'}>
              <div className="stack">
                <span>{fmtDate(r.collected_on)}</span>
                <span className="muted small">
                  {r.lab} · {r.source_file}
                </span>
              </div>
              {r.has_pdf && (
                <a className="btn btn-small" href={`/api/reports/${r.id}/pdf`} target="_blank" rel="noopener">
                  Open PDF
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
