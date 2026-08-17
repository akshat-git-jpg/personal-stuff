import { describe, it, expect } from 'vitest'
import { normaliseTag } from '../src/worker/db'

describe('normaliseTag', () => {
  it('folds case, trims and collapses inner whitespace', () => {
    expect(normaliseTag('  Office ')).toBe('office')
    expect(normaliseTag('OFFICE')).toBe('office')
    expect(normaliseTag('smart   casual')).toBe('smart casual')
  })

  it('maps every spelling of one tag to a single key', () => {
    const spellings = ['Office', 'office', ' OFFICE ', 'oFFice']
    expect(new Set(spellings.map(normaliseTag)).size).toBe(1)
  })

  it('yields an empty string for whitespace-only input, so callers can drop it', () => {
    expect(normaliseTag('   ')).toBe('')
  })
})
