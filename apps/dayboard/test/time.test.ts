import { describe, expect, it } from 'vitest'
import { DAY_MIN, dayWindow, isAfter, isBefore, toDayMinutes, todayIn, tzOffsetMinutes } from '../src/worker/time'

const IST = 'Asia/Kolkata'

describe('tzOffsetMinutes', () => {
  it('reports India as UTC+5:30 all year (no DST)', () => {
    expect(tzOffsetMinutes(new Date('2026-01-15T00:00:00Z'), IST)).toBe(330)
    expect(tzOffsetMinutes(new Date('2026-07-15T00:00:00Z'), IST)).toBe(330)
  })

  it('tracks a zone that does observe DST', () => {
    expect(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/London')).toBe(0)
    expect(tzOffsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/London')).toBe(60)
  })
})

describe('dayWindow', () => {
  it('puts IST midnight at 18:30 UTC the day before', () => {
    const { startMs, endMs } = dayWindow('2026-09-14', IST)
    expect(new Date(startMs).toISOString()).toBe('2026-09-13T18:30:00.000Z')
    expect(new Date(endMs).toISOString()).toBe('2026-09-14T18:30:00.000Z')
    expect((endMs - startMs) / 60000).toBe(DAY_MIN)
  })

  it('rejects a malformed date rather than silently drawing the wrong day', () => {
    expect(() => dayWindow('14-09-2026', IST)).toThrow()
  })
})

describe('toDayMinutes', () => {
  const { startMs, endMs } = dayWindow('2026-09-14', IST)

  it('places a local wall-clock time on the grid', () => {
    expect(toDayMinutes('2026-09-14T11:00:00+05:30', startMs)).toBe(11 * 60)
    expect(toDayMinutes('2026-09-14T06:30:00+05:30', startMs)).toBe(6 * 60 + 30)
  })

  it('clips an event that started yesterday to the top of the grid', () => {
    // Sleep 22:00 Sunday -> 05:00 Monday renders as 0..300 on Monday.
    expect(toDayMinutes('2026-09-13T22:00:00+05:30', startMs)).toBe(0)
    expect(toDayMinutes('2026-09-14T05:00:00+05:30', startMs)).toBe(300)
    expect(isBefore('2026-09-13T22:00:00+05:30', startMs)).toBe(true)
  })

  it('clips an event that runs past midnight to the bottom of the grid', () => {
    expect(toDayMinutes('2026-09-15T05:00:00+05:30', startMs)).toBe(DAY_MIN)
    expect(isAfter('2026-09-15T05:00:00+05:30', endMs)).toBe(true)
  })

  it('throws on an unparsable timestamp', () => {
    expect(() => toDayMinutes('not-a-time', startMs)).toThrow()
  })
})

describe('todayIn', () => {
  it('uses the grid timezone, not the server timezone', () => {
    // 20:00 UTC on the 13th is already the 14th in India — the board must agree.
    expect(todayIn(IST, new Date('2026-09-13T20:00:00Z'))).toBe('2026-09-14')
    expect(todayIn('America/New_York', new Date('2026-09-13T20:00:00Z'))).toBe('2026-09-13')
  })
})
