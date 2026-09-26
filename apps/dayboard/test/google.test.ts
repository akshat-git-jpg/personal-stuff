import { describe, expect, it } from 'vitest'
import { isBoardCalendar, sanitizeDescription, type GoogleCalendar } from '../src/worker/google'

const cal = (over: Partial<GoogleCalendar>): GoogleCalendar => ({
  id: 'x@group.calendar.google.com',
  summary: 'Something',
  backgroundColor: '#7b8394',
  selected: false,
  primary: false,
  ...over,
})

describe('isBoardCalendar', () => {
  it('keeps the primary calendar', () => {
    expect(isBoardCalendar(cal({ primary: true, id: 'kushalbakliwal25@gmail.com', summary: 'Kushal' }))).toBe(true)
  })

  it('keeps the holidays calendar', () => {
    expect(isBoardCalendar(cal({ id: 'en.indian#holiday@group.v.calendar.google.com', summary: 'Holidays in India' }))).toBe(true)
  })

  it('drops every duplicate plan calendar', () => {
    // These 11 hold a second copy of the same day at different times: two Gyms, two
    // Lunches, two Dinners. Reading them is what made the board unreadable.
    for (const name of ['Work', 'Business', 'Daily chores', 'Health', 'Buffer',
      'Personal Goal', 'Career Goals', 'Diet', 'Personal Goals', 'Family', 'Reminder']) {
      expect(isBoardCalendar(cal({ summary: name }))).toBe(false)
    }
  })

  it('ignores the selected flag, which Google omits when false', () => {
    // A partial (fields=) response drops `selected: false` entirely, so it can never
    // be trusted as the filter — that bug read all 13 calendars as ticked.
    expect(isBoardCalendar(cal({ summary: 'Health', selected: true }))).toBe(false)
    expect(isBoardCalendar(cal({ primary: true, selected: false }))).toBe(true)
  })
})

describe('sanitizeDescription', () => {
  it('returns empty string for a missing description', () => {
    expect(sanitizeDescription(undefined)).toBe('')
    expect(sanitizeDescription('')).toBe('')
  })

  it('turns Google’s rich-text HTML into readable plain lines', () => {
    const raw = '<p>Push day</p><ul><li>Bench 4&times;6</li><li>Incline DB</li></ul>'
    expect(sanitizeDescription(raw)).toBe('Push day\n• Bench 4 6\n• Incline DB')
  })

  it('keeps line breaks from <br>', () => {
    expect(sanitizeDescription('Standup 11:15<br>Ship the PR')).toBe('Standup 11:15\nShip the PR')
  })

  it('decodes the entities Google actually emits', () => {
    expect(sanitizeDescription('Ship&nbsp;the &quot;SOD&quot; PR &amp; review')).toBe('Ship the "SOD" PR & review')
    expect(sanitizeDescription('caf&#233;')).toBe('café')
  })

  it('strips markup so nothing in a calendar invite can reach the page as HTML', () => {
    const hostile = '<img src=x onerror="alert(1)">Lunch<script>alert(2)</script>'
    const out = sanitizeDescription(hostile)
    expect(out).not.toContain('<')
    expect(out).not.toContain('onerror')
    expect(out).toContain('Lunch')
  })

  it('collapses the blank-line soup Google Docs paste leaves behind', () => {
    expect(sanitizeDescription('<p>One</p><p></p><p></p><p>Two</p>')).toBe('One\n\nTwo')
  })
})
