import { bars, fixedOf, type Month } from '../shared/salary'
import type { Note } from '../shared/types'
import { timeline, type TimelineItem } from './derive'
import { dayLabel, inr, monLabel } from './format'
import { Empty } from './MonthsTab'

function Row({ item }: { item: TimelineItem }) {
  if (item.kind === 'note') {
    const n = item.note
    return (
      <li className="tl-item" data-kind="note">
        <span className="tl-dot dot-note" />
        <div className="tl-body">
          <span className="tl-when">{dayLabel(n.date)}</span>
          <span className="tl-title">{n.title}</span>
          {n.body && <span className="tl-line">{n.body}</span>}
          {(n.has_pdf || n.source_url) && (
            <span className="tl-links">
              {n.has_pdf && (
                <a href={`/api/notes/${n.id}/pdf`} target="_blank" rel="noopener">
                  Letter
                </a>
              )}
              {n.source_url && (
                <a href={n.source_url} target="_blank" rel="noopener noreferrer">
                  Mail
                </a>
              )}
            </span>
          )}
        </div>
      </li>
    )
  }
  const e = item.event
  const when = <span className="tl-when">{monLabel(e.month)}</span>
  switch (e.type) {
    case 'promotion':
      return (
        <li className="tl-item" data-kind="promotion">
          <span className="tl-dot dot-promo big" />
          <div className="tl-body">
            {when}
            <span className="tl-title big">
              {e.to} <span className="chip chip-promo">+{e.pct}%</span>
            </span>
            <span className="tl-line">
              Promotion from {e.from} · fixed {inr(e.fixedMonthly * 12)} a year
            </span>
          </div>
        </li>
      )
    case 'hike':
      return (
        <li className="tl-item" data-kind="hike">
          <span className="tl-dot dot-hike" />
          <div className="tl-body">
            {when}
            <span className="tl-title">
              Hike{' '}
              <span className="chip chip-hike">
                {e.pct > 0 ? '+' : ''}
                {e.pct}%
              </span>
            </span>
            <span className="tl-line">Fixed {inr(e.fixedMonthly * 12)} a year</span>
          </div>
        </li>
      )
    case 'payout':
      return (
        <li className="tl-item" data-kind="payout">
          <span className="tl-dot dot-payout small" />
          <div className="tl-body">
            {when}
            <span className="tl-title">
              {e.labels.join(' + ')} <span className="chip chip-payout">+{inr(e.net)} net</span>
            </span>
            <span className="tl-line">{inr(e.gross)} before tax</span>
          </div>
        </li>
      )
    case 'start':
      return (
        <li className="tl-item" data-kind="start">
          <span className="tl-dot dot-start small" />
          <div className="tl-body">
            {when}
            <span className="tl-title">
              Start of records <span className="chip chip-start">{e.designation}</span>
            </span>
            <span className="tl-line">Fixed {inr(e.fixedMonthly * 12)} a year</span>
          </div>
        </li>
      )
  }
}

export default function TimelineTab({ months, notes }: { months: Month[]; notes: Note[] }) {
  if (!months.length) {
    return (
      <div className="page" data-testid="timeline-tab">
        <Empty />
      </div>
    )
  }
  const last = months[months.length - 1]
  const base = bars(months, 'net')[months.length - 1].base
  return (
    <div className="page" data-testid="timeline-tab">
      <div className="stack">
        <h1 className="h1">{last.designation}</h1>
        <p className="soft small">
          {inr(fixedOf(last) * 12)} fixed a year · {inr(base)} a month
        </p>
      </div>
      <ol className="card timeline" data-testid="timeline">
        {timeline(months, notes).map((it) => (
          <Row key={it.key} item={it} />
        ))}
      </ol>
    </div>
  )
}
