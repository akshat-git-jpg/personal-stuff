import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom's Storage implementation needs Node's --localstorage-file flag to
// exist at all; without it `localStorage` is simply undefined here even
// though every real browser has one. A tiny in-memory polyfill keeps
// usePrefs' localStorage calls testable without depending on a CLI flag.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()
    get length() {
      return this.store.size
    }
    clear() {
      this.store.clear()
    }
    getItem(key: string) {
      return this.store.has(key) ? this.store.get(key)! : null
    }
    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null
    }
    removeItem(key: string) {
      this.store.delete(key)
    }
    setItem(key: string, value: string) {
      this.store.set(key, String(value))
    }
  }
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
}

afterEach(() => {
  cleanup()
})
