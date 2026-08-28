import type { Beat } from '../types'

export function makeReadBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    num: '1.1',
    title: 'Cold open',
    part: '1 · INTRO',
    partKind: 'intro',
    section: null,
    mode: 'read',
    say: ['This is the spoken line.'],
    angle: null,
    demo: [],
  ask: [],
    video: ['Show the app icon, then trim the pause here.'],
    notes: [],
    facts: ['The tool launched in 2024.'],
    rules: ['Keep it under 10 seconds.'],
    verdict: null,
    ...overrides,
  }
}

export function makeWriteBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    num: '2.4',
    title: 'Five scenes, five tools',
    part: '2 · BODY',
    partKind: 'body',
    section: null,
    mode: 'write',
    say: null,
    angle: ['Show the five tools side by side and say what each is for.'],
    demo: [],
  ask: [],
    video: ['Screen-record each tool for 3 seconds. Cut hard between them.'],
    notes: [],
    facts: ['All five tools are free tier.'],
    rules: [],
    verdict: null,
    ...overrides,
  }
}

// A beat that opens on a silent stretch: something plays and nobody speaks. Used
// by the DEMO-lane tests. `demo` is a property of a beat, not a beat of its own,
// so this one still carries spoken copy after the silence.
export function makeDemoBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    ...makeReadBeat(),
    demo: ['The finished shot plays. No voiceover.'],
    ...overrides,
  }
}

// A BODY SECTION CARD: one heading, one flat bullet list, one thing to write.
// The shape every body section has since 2026-08-29 — no sub-beats, no separate
// video or general notes. `title` and `section` are the same string because the
// card IS the section.
export function makeCardBeat(overrides: Partial<Beat> = {}): Beat {
  return {
    ...makeWriteBeat(),
    num: '2.1',
    title: 'What makes it look like Vox',
    section: 'What makes it look like Vox',
    angle: null,
    video: [],
    facts: [],
    rules: [],
    notes: [
      '- Show what the style actually is. No tool on screen yet.',
      '- The background never moves. Cutouts move on top of it.',
    ],
    ...overrides,
  }
}
