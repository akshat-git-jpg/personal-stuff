// A beat field added after a video was published is ABSENT from that video's
// stored snapshot. The UI must render anyway.
//
// This is not hypothetical. On 2026-08-27 the `demo` field was added to the
// parser and the components. The Vite frontend hot-reloaded; the long-running
// API process had already imported the old parser, so it kept serving beats with
// no `demo` key, and `beat.demo.length` on undefined blanked the entire page.
//
// Hosted mode has the same shape and a worse blast radius: it serves `beats_json`
// written into D1 at publish time, so every freelancer holding a link published
// before the field existed would have opened a blank page until someone
// republished. Restarting a server fixes the local case and does nothing for
// theirs.
//
// The fix is `normalizeDoc` in src/api.ts, at the one place a document enters the
// app. These tests exist so the next added field cannot repeat it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const OLD_SNAPSHOT_BEAT = {
  num: '1.1',
  title: 'Cold open',
  part: '1 · INTRODUCTION',
  partKind: 'intro',
  section: null,
  mode: 'read',
  say: ['A line that was already published.'],
  angle: null,
  verdict: null,
  // Deliberately NO demo / show / edit / facts / rules — this is what a snapshot
  // taken before those fields existed actually looks like on the wire.
}

describe('a document served from an older snapshot', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          key: 'k',
          title: 'T',
          beats: [OLD_SNAPSHOT_BEAT],
          draft: {},
          edits: {},
          says: {},
          finished: false,
        }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('fills every missing list field instead of handing undefined to the UI', async () => {
    const { getVideo } = await import('../api')
    const doc = await getVideo('k')
    const beat = doc.beats[0]

    for (const field of ['demo', 'show', 'edit', 'facts', 'rules'] as const) {
      expect(
        Array.isArray(beat[field]),
        `OLD_SNAPSHOT_CRASH: "${field}" came through as ${typeof beat[field]} — a .length on it blanks the page`,
      ).toBe(true)
      expect(beat[field]).toEqual([])
    }
  })

  it('leaves the fields the snapshot did carry alone', async () => {
    const { getVideo } = await import('../api')
    const doc = await getVideo('k')
    expect(doc.beats[0].say).toEqual(['A line that was already published.'])
    expect(doc.beats[0].num).toBe('1.1')
  })

  it('survives a document with no beats array at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ key: 'k', title: 'T', draft: {}, edits: {}, says: {}, finished: false }),
      })),
    )
    const { getVideo } = await import('../api')
    const doc = await getVideo('k')
    expect(doc.beats, 'MISSING_BEATS_CRASH: a doc with no beats key threw instead of rendering empty').toEqual(
      [],
    )
  })
})
