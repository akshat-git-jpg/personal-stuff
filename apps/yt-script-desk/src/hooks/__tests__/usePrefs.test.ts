import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePrefs, DEFAULTS } from '../usePrefs'

describe('usePrefs', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('falls back to DEFAULTS when localStorage throws, without throwing', () => {
    const original = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
      },
    })

    let hook: ReturnType<typeof renderHook<ReturnType<typeof usePrefs>, unknown>> | undefined
    expect(() => {
      hook = renderHook(() => usePrefs())
    }).not.toThrow()
    expect(hook!.result.current.prefs).toEqual(DEFAULTS)

    Object.defineProperty(window, 'localStorage', { configurable: true, value: original })
  })

  it('round-trips a toggle through localStorage', () => {
    const { result } = renderHook(() => usePrefs())

    act(() => {
      result.current.setPrefs({ videoNotes: false })
    })

    expect(result.current.prefs.videoNotes).toBe(false)
    const stored = JSON.parse(localStorage.getItem('script-desk:prefs') ?? '{}')
    expect(stored.videoNotes).toBe(false)
  })

  it('merges new pref keys over an old stored shape without losing what was saved', () => {
    localStorage.setItem('script-desk:prefs', JSON.stringify({ generalNotes: false }))

    const { result } = renderHook(() => usePrefs())

    expect(result.current.prefs.beatLabels).toBe(true)
    expect(result.current.prefs.generalNotes).toBe(false)
  })
})
