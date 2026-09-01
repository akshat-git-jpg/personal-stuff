// THE REGRESSION: an edited instruction box that grows by one copy on every save.
//
// Seen live on 2026-09-01, on A1 of ai-avatar-generators. That beat carries its
// brief in a `**VIDEO**` lane, not `**NOTES**` — so the box the owner edits is
// built entirely from a lane the save does not write to. Save the box, keep the
// lane, render again, and the box contains its own text twice. He got to ten
// lines from two, and a line he deleted reappeared.
import { describe, it, expect } from 'vitest'
import { mergedLanes, stageNotes } from '../lanes'
import type { Beat } from '../../types'

const beat = (over: Partial<Beat> = {}): Beat =>
  ({
    num: 'A1',
    title: 'Cold open',
    part: '1 · INTRODUCTION',
    partKind: 'intro',
    section: null,
    mode: 'read',
    say: [],
    notes: [],
    angle: null,
    video: [],
    rules: [],
    facts: [],
    demo: [],
    ask: [],
    ...over,
  }) as Beat

const VIDEO_LANE = [
  "HeyGen Avatar IV with the owner's custom voice. Owner supplies both.",
  'No logos and no UI on screen, so the reveal lands.',
]

describe('the instruction box is a merge', () => {
  it('folds all five lanes in render order', () => {
    const b = beat({ notes: ['n'], angle: ['a'], video: ['v'], rules: ['r'], facts: ['f'] })
    expect(mergedLanes(b)).toEqual(['n', 'a', 'v', 'r', 'f'])
  })

  it('treats a null angle as no lines rather than a crash', () => {
    expect(mergedLanes(beat({ notes: ['n'], angle: null }))).toEqual(['n'])
  })

  it('is empty for a missing beat', () => {
    expect(mergedLanes(undefined)).toEqual([])
  })
})

describe('staging an edited note', () => {
  it('empties the lanes the box was merged from', () => {
    // The owner typed into a box built from **VIDEO**. What he saves is the whole
    // merge, so the VIDEO lane must not survive to be merged in a second time.
    const b = beat({ video: VIDEO_LANE })
    const edited = ["HeyGen khushi Avatar IV with the owner's custom voice. Owner supplies both.", VIDEO_LANE[1]]

    const staged = stageNotes(b, edited)

    expect(staged.video, 'LANE_SURVIVED_SAVE: the box will duplicate on next render').toEqual([])
    expect(mergedLanes(staged)).toEqual(edited)
  })

  it('does not grow when the same edit is saved five times over', () => {
    // The exact shape of the live bug: each save re-reads the box and writes it
    // back. Without the lane clear this reached ten lines from two.
    let b = beat({ video: VIDEO_LANE })
    for (let i = 0; i < 5; i++) b = stageNotes(b, mergedLanes(b))
    expect(mergedLanes(b)).toEqual(VIDEO_LANE)
  })

  it('lets a deleted line stay deleted', () => {
    // The other half of the same failure: the owner removes a line, the untouched
    // lane merges it straight back on the next render.
    const b = beat({ video: VIDEO_LANE })
    const staged = stageNotes(b, [VIDEO_LANE[0]])
    expect(mergedLanes(staged)).toEqual([VIDEO_LANE[0]])
  })

  it('clears every lane, not just the one this beat happened to use', () => {
    const b = beat({ notes: ['n'], angle: ['a'], video: ['v'], rules: ['r'], facts: ['f'] })
    const staged = stageNotes(b, ['just this'])
    expect(mergedLanes(staged)).toEqual(['just this'])
  })
})
