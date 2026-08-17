import { describe, it, expect } from 'vitest'
import { fitBox } from '../src/client/photo'

describe('fitBox', () => {
  it('clamps the longest edge to 640 and keeps the aspect ratio', () => {
    expect(fitBox(4032, 3024)).toEqual({ w: 640, h: 480 })
    expect(fitBox(3024, 4032)).toEqual({ w: 480, h: 640 })
  })

  it('never upscales a photo that is already small', () => {
    expect(fitBox(200, 150)).toEqual({ w: 200, h: 150 })
  })

  it('never returns a zero dimension for an extreme ratio', () => {
    const { w, h } = fitBox(5000, 1)
    expect(w).toBe(640)
    expect(h).toBeGreaterThanOrEqual(1)
  })
})
