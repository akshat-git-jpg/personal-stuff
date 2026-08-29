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
      result.current.setPrefs({ instructions: false })
    })

    expect(result.current.prefs.instructions).toBe(false)
    const stored = JSON.parse(localStorage.getItem('script-desk:prefs') ?? '{}')
    expect(stored.instructions).toBe(false)
  })

  it('merges new pref keys over an old stored shape without losing what was saved', () => {
    localStorage.setItem('script-desk:prefs', JSON.stringify({ instructions: false }))

    const { result } = renderHook(() => usePrefs())

    expect(result.current.prefs.beatLabels).toBe(true)
    expect(result.current.prefs.instructions).toBe(false)
  })

  // The three lane chips went on 2026-08-29 with the lanes they named. A browser
  // that toggled one of them still has it in localStorage, and it must be read as
  // an unknown key rather than crashing or reappearing in the prefs object.
  it('ignores a pref key that no longer exists', () => {
    localStorage.setItem(
      'script-desk:prefs',
      JSON.stringify({ videoNotes: false, generalNotes: false, beatLabels: false }),
    )

    const { result } = renderHook(() => usePrefs())

    expect(result.current.prefs.instructions).toBe(true)
    expect(result.current.prefs.beatLabels).toBe(false)
  })
})
