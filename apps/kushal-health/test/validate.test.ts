import { describe, expect, it } from 'vitest'
import { validateIngest } from '../src/worker/validate'
import { fixtureIngest, fixtureIngestOlder } from './fixtures/blood'
import report from './fixtures/report.json'
import reportOlder from './fixtures/report-older.json'

const clone = () => JSON.parse(JSON.stringify(fixtureIngest))

describe('validateIngest', () => {
  it('accepts the fixture', () => {
    expect(validateIngest(clone()).results).toHaveLength(6)
  })

  it('keeps the smoke JSON fixtures in sync with the TS fixture', () => {
    expect(report).toEqual(fixtureIngest)
    expect(reportOlder).toEqual(fixtureIngestOlder)
    expect(validateIngest(reportOlder).results).toHaveLength(2)
  })

  const CASES: [string, (b: any) => void, string][] = [
    ['bad id', (b) => (b.report.id = 'Has Spaces'), 'bad report.id'],
    ['bad date', (b) => (b.report.collected_on = '15-01-2025'), 'bad report.collected_on'],
    ['empty lab', (b) => (b.report.lab = ' '), 'bad report.lab'],
    ['missing source_file', (b) => delete b.report.source_file, 'bad report.source_file'],
    ['verdict not a string', (b) => (b.report.verdict = null), 'bad report.verdict'],
    ['empty results', (b) => (b.results = []), 'results must be a non-empty array'],
    ['bad marker_key', (b) => (b.results[0].marker_key = 'HbA1c'), 'bad results[0].marker_key'],
    ['unknown panel', (b) => (b.results[1].panel = 'Heart'), 'bad results[1].panel'],
    ['empty value_text', (b) => (b.results[0].value_text = ''), 'bad results[0].value_text'],
    ['value_num not finite', (b) => (b.results[0].value_num = 'NaN'), 'bad results[0].value_num'],
    ['bad qualifier', (b) => (b.results[0].qualifier = '~'), 'bad results[0].qualifier'],
    ['bad ref_low', (b) => (b.results[0].ref_low = '4'), 'bad results[0].ref_low'],
    ['duplicate marker', (b) => (b.results[1].marker_key = b.results[0].marker_key), `duplicate marker_key hba1c`],
  ]
  for (const [name, mutate, msg] of CASES) {
    it(`rejects ${name}`, () => {
      const b = clone()
      mutate(b)
      expect(() => validateIngest(b)).toThrow(msg)
    })
  }
})
