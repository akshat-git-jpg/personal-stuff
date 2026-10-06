import { useState } from 'react'
import { PANELS, type BloodData, type MarkerSeries } from '../shared/types'
import { SEVERITY, needsAttention, statusOf, trendOf, type Status } from '../shared/status'
import { STATUS_CLASS, STATUS_LABEL, fmtDate } from './format'
import MarkerChart from './MarkerChart'

const latest = (m: MarkerSeries) => m.points[m.points.length - 1]

function Chip({ status }: { status: Status }) {
  return <span className={`chip ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
}

function Trend({ m }: { m: MarkerSeries }) {
  const last = latest(m)
  const prev = m.points[m.points.length - 2]
  const t = trendOf(prev, last)
  if (t === null) return m.points.length === 1 ? <span className="trend trend-flat">first reading</span> : null
  if (t === 'steady') return <span className="trend trend-flat">steady</span>
  const arrow = (last.value_num as number) > (prev.value_num as number) ? '▲' : '▼'
  return <span className={`trend ${t === 'better' ? 'trend-good' : 'trend-bad'}`}>{`${arrow} ${t}`}</span>
}

function Value({ m }: { m: MarkerSeries }) {
  const p = latest(m)
  return (
    <span className="value">
      {p.value_text}
      {p.unit && <span className="unit"> {p.unit}</span>}
    </span>
  )
}

function MarkerRow({ m }: { m: MarkerSeries }) {
  const [open, setOpen] = useState(false)
  const status = statusOf(latest(m))
  return (
    <div className="marker">
      <button
        type="button"
        className="marker-row"
        data-testid={`marker-${m.key}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="marker-name">{m.name}</span>
        <Value m={m} />
        <Chip status={status} />
        <Trend m={m} />
        <span className="spark">
          <MarkerChart series={m} size="small" />
        </span>
      </button>
      {open && (
        <div className="marker-detail">
          <MarkerChart series={m} size="large" />
          <table className="readings">
            <thead>
              <tr>
                <th>Date</th>
                <th>Value</th>
                <th>Range</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...m.points].reverse().map((p) => (
                <tr key={p.report_id}>
                  <td>{fmtDate(p.collected_on)}</td>
                  <td>
                    {p.value_text} {p.unit}
                  </td>
                  <td>{p.ref_text || '—'}</td>
                  <td>
                    <Chip status={statusOf(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function BloodTab({ data }: { data: BloodData }) {
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
  const onLatest = data.markers.filter((m) => latest(m).collected_on === newest).map((m) => statusOf(latest(m)))
  const out = onLatest.filter((s) => SEVERITY[s] === 0).length
  const edge = onLatest.filter((s) => s === 'borderline').length
  const ok = onLatest.filter((s) => s === 'normal').length

  const attention = data.markers
    .map((m) => ({ m, s: statusOf(latest(m)) }))
    .filter((x) => needsAttention(x.s))
    .sort((a, b) => SEVERITY[a.s] - SEVERITY[b.s] || a.m.name.localeCompare(b.m.name))

  return (
    <div className="blood">
      <section className="card verdict" data-testid="verdict">
        <h2>Latest report · {fmtDate(newest)}</h2>
        <p className="counts">
          <span className="count-bad">{out} out of range</span> · <span className="count-warn">{edge} near edge</span> ·{' '}
          <span className="count-ok">{ok} normal</span>
        </p>
        {latestReports.map((r) => (
          <div key={r.id} className="verdict-item">
            <div className="muted small">{r.lab}</div>
            <p className="verdict-text">{r.verdict || 'No written verdict for this report.'}</p>
          </div>
        ))}
      </section>

      {attention.length > 0 && (
        <section className="card" data-testid="attention">
          <h2>Needs attention</h2>
          <ul className="attention">
            {attention.map(({ m, s }) => (
              <li key={m.key}>
                <span className="marker-name">{m.name}</span>
                <Value m={m} />
                <Chip status={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {PANELS.map((panel) => {
        const ms = data.markers.filter((m) => m.panel === panel)
        if (ms.length === 0) return null
        return (
          <section className="card panel" key={panel}>
            <h2 className="panel-title">{panel}</h2>
            {ms.map((m) => (
              <MarkerRow key={m.key} m={m} />
            ))}
          </section>
        )
      })}

      <section className="card" data-testid="reports">
        <h2>Reports</h2>
        <ul className="reports">
          {data.reports.map((r) => (
            <li key={r.id}>
              <span>{fmtDate(r.collected_on)}</span>
              <span>{r.lab}</span>
              <span className="muted small">{r.source_file}</span>
              {r.has_pdf && (
                <a href={`/api/reports/${r.id}/pdf`} target="_blank" rel="noopener">
                  Open PDF
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
