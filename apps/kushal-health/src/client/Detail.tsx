import type { BloodData } from '../shared/types'
import { SEVERITY, statusOf, type Status } from '../shared/status'
import { delta, guideFor, labsById, latest, outBy } from './derive'
import { fmtDate, fmtSpan } from './format'
import LineChart from './LineChart'
import { Chip, RangeBar } from './parts'

/** Plain-language card: what the test is, why the current result matters, what to do. */
function About({ markerKey, status }: { markerKey: string; status: Status }) {
  const g = guideFor(markerKey)
  if (!g) return null
  const low = status === 'low'
  const out = SEVERITY[status] === 0
  const meaning = low ? g.low : g.high
  const actions = (low ? g.doLow : g.doHigh) ?? []
  return (
    <section className="card about" data-testid="about">
      <h2 className="h3">About this test</h2>
      <p className="insight-line">
        <span className="insight-label">What it is</span> {g.what}
      </p>
      {out && meaning && (
        <p className="insight-line">
          <span className="insight-label">Why it matters</span> {meaning}
        </p>
      )}
      {!out && (g.high || g.low) && (
        <>
          {g.high && (
            <p className="insight-line">
              <span className="insight-label">If it goes high</span> {g.high}
            </p>
          )}
          {g.low && (
            <p className="insight-line">
              <span className="insight-label">If it goes low</span> {g.low}
            </p>
          )}
        </>
      )}
      {out && actions.length > 0 && (
        <div className="insight-actions">
          <span className="insight-label">What you can do</span>
          <ul>
            {actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted small">General health information, not medical advice.</p>
    </section>
  )
}

/** One test's full history: big value, range bar, chart with date tooltips, every reading. */
export default function Detail({ data, markerKey }: { data: BloodData; markerKey: string }) {
  const m = data.markers.find((x) => x.key === markerKey)
  if (!m) {
    return (
      <section className="card">
        <p>This test is not in your reports.</p>
        <a className="btn btn-small" href="#/">
          Back to all tests
        </a>
      </section>
    )
  }
  const labs = labsById(data.reports)
  const pdf = new Set(data.reports.filter((r) => r.has_pdf).map((r) => r.id))
  const p = latest(m)
  const s = statusOf(p)
  const nums = m.points.filter((x) => x.value_num !== null)
  const first = nums[0]
  const prev = nums[nums.length - 2]
  const outCount = m.points.filter((x) => SEVERITY[statusOf(x)] === 0).length
  const times = p.ref_high !== null && p.value_num !== null && p.value_num > p.ref_high ? (p.value_num / p.ref_high).toFixed(1) : null

  return (
    <div className="detail" data-testid="detail">
      <div className="detail-nav">
        <a className="icon-btn" href="#/" aria-label="Back to all tests">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </a>
        <span className="muted small">{m.panel}</span>
      </div>

      <h1 className="h1">{m.name}</h1>

      <section className="card stack-16">
        <div className="detail-head">
          <div className="stack">
            <span className="muted small">{fmtDate(p.collected_on)}</span>
            <div className="big-value">
              <span className={`num num-xl st-${s}`}>{p.value_text}</span>
              <span className="muted">{p.unit}</span>
            </div>
          </div>
          <Chip status={s} extra={times && outBy(p) > 0 ? `${times}× the limit` : undefined} />
        </div>
        <RangeBar point={p} big />
        <div className="rb-legend">
          <span>Low</span>
          <span className="st-normal">Normal {p.ref_text || '—'}</span>
          <span>High</span>
        </div>
      </section>

      <About markerKey={m.key} status={s} />

      {nums.length > 1 && (
        <div className="tiles">
          {nums.length > 2 && (
            <div className="card tile">
              <span className="muted small">Since first</span>
              <span className="tile-num">{delta(first.value_num as number, p.value_num as number)}</span>
              <span className="soft small">from {first.value_text}, {fmtDate(first.collected_on)}</span>
            </div>
          )}
          <div className="card tile">
            <span className="muted small">Since last</span>
            <span className="tile-num">{delta(prev.value_num as number, p.value_num as number)}</span>
            <span className="soft small">from {prev.value_text}, {fmtDate(prev.collected_on)}</span>
          </div>
          <div className="card tile">
            <span className="muted small">Out of range</span>
            <span className="tile-num">
              {outCount} of {m.points.length}
            </span>
            <span className="soft small">tests</span>
          </div>
        </div>
      )}

      {nums.length > 0 && (
        <section className="card stack-8">
          <div className="section-head">
            <span className="muted small">Over time · {fmtSpan(nums.map((x) => x.collected_on))}</span>
            <span className="soft small">tap a point</span>
          </div>
          <LineChart series={m} height={210} labs={labs} />
        </section>
      )}

      <section className="card list" data-testid="readings">
        {[...m.points].reverse().map((x, i) => (
          <div key={x.report_id} className={i === 0 ? 'reading' : 'reading row-sep'}>
            <div className="stack">
              <span>{fmtDate(x.collected_on)}</span>
              <span className="muted small">
                {labs[x.report_id] ?? ''} · normal {x.ref_text || '—'}
              </span>
            </div>
            <span className={`reading-val st-${statusOf(x)}`}>{x.value_text}</span>
            {pdf.has(x.report_id) ? (
              <a className="btn btn-small" href={`/api/reports/${x.report_id}/pdf`} target="_blank" rel="noopener">
                PDF
              </a>
            ) : (
              <span />
            )}
          </div>
        ))}
      </section>
    </div>
  )
}
