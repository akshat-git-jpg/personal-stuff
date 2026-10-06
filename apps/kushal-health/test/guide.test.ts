import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE } from '../src/shared/guide'

const markersMd = readFileSync(resolve(__dirname, '../../../.claude/skills/kushal-health/markers.md'), 'utf8')
const keys = [...markersMd.matchAll(/^\| ([a-z0-9_]+) \| [A-Z][A-Za-z]* \|/gm)].map((m) => m[1])

describe('guide', () => {
  it('reads the skill marker list', () => {
    expect(keys.length).toBeGreaterThan(80)
  })

  it('explains every marker key the skill can use', () => {
    const missing = keys.filter((k) => !GUIDE[k]?.what)
    expect(missing).toEqual([])
  })

  it('never names a dose', () => {
    const text = JSON.stringify(GUIDE)
    expect(text).not.toMatch(/\b\d+\s?(mg|mcg|IU|units?)\b(?! ?\/)/i)
  })

  it('gives next steps whenever it explains a high or low result', () => {
    const bad = Object.entries(GUIDE)
      .filter(([, g]) => (g.high && !g.doHigh && g.high !== 'Usually follows the platelet count.') || (g.low && !g.doLow))
      .map(([k]) => k)
    expect(bad).toEqual([])
  })
})
