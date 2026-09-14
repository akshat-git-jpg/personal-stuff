import { describe, expect, it } from 'vitest'
import { sanitizeDescription } from '../src/worker/google'

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
