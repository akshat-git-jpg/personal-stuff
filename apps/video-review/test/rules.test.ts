import { describe, expect, it } from 'vitest'
import { MB, MAX_FILE_BYTES, checkFile, filesToDrop, fmtBytes, fmtTime, maxBytesFor } from '../src/shared/rules'
import { parseRange } from '../src/worker/range'

const ok = { size: 100 * MB, duration: 600, width: 1280, height: 720, type: 'video/mp4' }

describe('checkFile', () => {
  it('accepts a 10-minute 720p MP4 under the limit', () => {
    expect(checkFile(ok)).toEqual([])
  })
  it('accepts a portrait 720x1280 video', () => {
    expect(checkFile({ ...ok, width: 720, height: 1280 })).toEqual([])
  })
  it('refuses 1080p', () => {
    expect(checkFile({ ...ok, width: 1920, height: 1080 })[0]).toMatch(/1920x1080/)
  })
  it('refuses a file over 12 MB a minute', () => {
    expect(checkFile({ ...ok, size: 121 * MB })[0]).toMatch(/limit is 120 MB/)
  })
  it('refuses non-MP4 and unreadable files', () => {
    expect(checkFile({ ...ok, type: 'video/quicktime' })[0]).toMatch(/MP4/)
    expect(checkFile({ ...ok, duration: NaN })).toHaveLength(1)
  })
})

describe('maxBytesFor', () => {
  it('scales with length and caps at 400 MB', () => {
    expect(maxBytesFor(60)).toBe(12 * MB)
    expect(maxBytesFor(30 * 60)).toBe(360 * MB)
    expect(maxBytesFor(60 * 60)).toBe(MAX_FILE_BYTES)
  })
})

describe('filesToDrop', () => {
  const vs = [1, 2, 3, 4].map((i) => ({ id: `v${i}`, created_at: i, has_file: true }))
  it('keeps the two newest files', () => {
    expect(filesToDrop(vs, null).sort()).toEqual(['v1', 'v2'])
  })
  it('ignores versions whose file is already gone', () => {
    expect(filesToDrop([...vs.slice(0, 1), { id: 'v9', created_at: 9, has_file: false }], null)).toEqual([])
  })
  it('keeps only the Final file once a version is Final', () => {
    expect(filesToDrop(vs, 'v2').sort()).toEqual(['v1', 'v3', 'v4'])
  })
})

describe('parseRange', () => {
  it('handles open, closed, suffix and bad ranges', () => {
    expect(parseRange(undefined, 100)).toBeNull()
    expect(parseRange('bytes=0-', 100)).toEqual({ offset: 0, length: 100 })
    expect(parseRange('bytes=10-19', 100)).toEqual({ offset: 10, length: 10 })
    expect(parseRange('bytes=90-500', 100)).toEqual({ offset: 90, length: 10 })
    expect(parseRange('bytes=-30', 100)).toEqual({ offset: 70, length: 30 })
    expect(parseRange('bytes=100-', 100)).toBe('invalid')
    expect(parseRange('bytes=0-1,5-6', 100)).toBe('invalid')
  })
})

describe('fmtTime', () => {
  it('formats minutes and hours', () => {
    expect(fmtTime(83.4)).toBe('1:23')
    expect(fmtTime(83.45, true)).toBe('1:23.5')
    expect(fmtTime(3725)).toBe('1:02:05')
  })
  it('shows KB for tiny files', () => {
    expect(fmtBytes(223_438)).toBe('218 KB')
  })
})
