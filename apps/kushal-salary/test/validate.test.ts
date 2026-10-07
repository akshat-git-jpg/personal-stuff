import { describe, expect, it } from 'vitest'
import { validateMonth, validateNote } from '../src/worker/validate'

const good = {
  month: '2025-05', designation: 'Engineer', gross: 100, net: 80, deductions: 20, source_file: 'a.pdf',
  items: [{ label: 'Basic', category: 'fixed', monthly: 100, arrears: 0, total: 100 }],
}
const note = { id: '2025-05-02-letter', date: '2025-05-02', title: 'Letter' }

describe('validateMonth', () => {
  it('accepts a good month', () => expect(validateMonth(good).items).toHaveLength(1))
  it('rejects a bad month string', () => expect(() => validateMonth({ ...good, month: '2025-13' })).toThrow('bad month'))
  it('rejects a negative gross', () => expect(() => validateMonth({ ...good, gross: -1 })).toThrow('bad gross'))
  it('names a bad item category', () =>
    expect(() => validateMonth({ ...good, items: [{ ...good.items[0], category: 'bonus' }] })).toThrow('bad items[0].category'))
  it('rejects empty items', () => expect(() => validateMonth({ ...good, items: [] })).toThrow('bad items'))
  it('rejects a fraction', () => expect(() => validateMonth({ ...good, net: 1.5 })).toThrow('bad net'))
})

describe('validateNote', () => {
  it('accepts a good note', () => expect(validateNote(note).body).toBe(''))
  it('rejects a bad id', () => expect(() => validateNote({ ...note, id: 'Bad Id' })).toThrow('bad id'))
  it('rejects a non-https link', () => expect(() => validateNote({ ...note, source_url: 'http://x' })).toThrow('bad source_url'))
  it('rejects a bad date', () => expect(() => validateNote({ ...note, date: '2025-5-2' })).toThrow('bad date'))
})
