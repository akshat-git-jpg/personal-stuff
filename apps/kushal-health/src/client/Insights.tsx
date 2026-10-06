import type { BloodData } from '../shared/types'
import { changeText, guideFor, insights, latest } from './derive'
import { markerHref } from './hrefs'
import { Chip } from './parts'

/** "What this means for you": out-of-range tests grouped by body area, in plain words. */
export default function Insights({ data }: { data: BloodData }) {
  const groups = insights(data)
  if (groups.length === 0) return null
  return (
    <section className="section" data-testid="insights">
      <div className="stack">
        <h2 className="h2">What this means for you</h2>
        <span className="muted small">Tests outside the normal range, grouped by body area.</span>
      </div>
      {groups.map((g) => (
        <article key={g.key} className="card insight" data-testid={`insight-${g.key}`}>
          <header className="insight-head">
            <h3 className="h3">{g.name}</h3>
            <span className="muted small">
              {g.items.length} {g.items.length === 1 ? 'test' : 'tests'} out of range
            </span>
          </header>
          {g.intro && <p className="soft small">{g.intro}</p>}
          <ul className="insight-items">
            {g.items.map((it) => {
              const p = latest(it.m)
              const what = guideFor(it.m.key)?.what
              return (
                <li key={it.m.key}>
                  <a className="insight-item" href={markerHref(it.m.key)}>
                    <div className="insight-top">
                      <span className="insight-name">{it.m.name}</span>
                      <Chip status={it.status} />
                    </div>
                    <div className="insight-nums">
                      <span className={`st-${it.status}`}>
                        {p.value_text} {p.unit}
                      </span>
                      <span className="muted"> · normal {p.ref_text || '—'} · {changeText(it.m)}</span>
                    </div>
                    {what && (
                      <p className="insight-line">
                        <span className="insight-label">What it is</span> {what}
                      </p>
                    )}
                    <p className="insight-line">
                      <span className="insight-label">Why it matters</span> {it.meaning}
                    </p>
                  </a>
                </li>
              )
            })}
          </ul>
          {g.actions.length > 0 && (
            <div className="insight-actions">
              <span className="insight-label">What you can do</span>
              <ul>
                {g.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
      <p className="muted small disclaimer">
        General health information, not medical advice. A doctor who knows you should read these results.
      </p>
    </section>
  )
}
