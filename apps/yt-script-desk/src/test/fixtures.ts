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
    show: ['Show the app icon.'],
    edit: ['Trim the pause here.'],
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
    show: ['Screen-record each tool for 3 seconds.'],
    edit: ['Cut hard between each tool.'],
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
