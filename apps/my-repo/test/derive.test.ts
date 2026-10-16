import { describe, expect, it } from 'vitest'
import { layout, SKILL_GROUPS, trace } from '../src/client/derive'
import type { Graph, Kind } from '../src/shared/types'

const g: Graph = {
  meta: { repo: 'r', sha: 'a', scannedAt: '2026-10-16T00:00:00Z', workSkills: false },
  nodes: [
    { id: 'skill:drive', kind: 'skill', name: 'drive', group: 'personal', triggers: ['upload to drive'] },
    { id: 'skill:travel', kind: 'skill', name: 'travel', group: 'personal', triggers: ['trip'] },
    { id: 'cli:pp-drive', kind: 'cli', name: 'pp-drive', group: 'user' },
    { id: 'cli:pp-trains', kind: 'cli', name: 'pp-trains', group: 'user' },
    { id: 'cli:pp-lonely', kind: 'cli', name: 'pp-lonely', group: 'user' },
    { id: 'service:Google Drive', kind: 'service', name: 'Google Drive', group: 'outside' },
  ],
  edges: [
    { from: 'skill:drive', to: 'cli:pp-drive', kind: 'calls' },
    { from: 'skill:travel', to: 'cli:pp-trains', kind: 'calls' },
    { from: 'skill:travel', to: 'skill:drive', kind: 'hands-off' },
    { from: 'cli:pp-drive', to: 'service:Google Drive', kind: 'reaches' },
  ],
  findings: [],
}
const all = { kinds: new Set<Kind>(['skill', 'cli', 'mcp', 'service']), groups: new Set<string>(SKILL_GROUPS), query: '' }

describe('trace', () => {
  it('lights up everything up and down the path', () => {
    expect([...trace(g, 'cli:pp-drive')!].sort()).toEqual(['cli:pp-drive', 'service:Google Drive', 'skill:drive', 'skill:travel'])
  })
  it('is null with nothing selected', () => expect(trace(g, null)).toBeNull())
})

describe('layout', () => {
  it('puts each kind in its lane and keeps a loose CLI on the map', () => {
    const lay = layout(g, all)
    const lane = (id: string) => lay.boxes.find((b) => b.node.id === id && b.lane > 0)?.lane
    expect(lane('skill:drive')).toBe(1)
    expect(lane('cli:pp-lonely')).toBe(2)
    expect(lane('service:Google Drive')).toBe(3)
    expect(lay.boxes.filter((b) => b.lane === 0).map((b) => b.phrase)).toContain('upload to drive')
  })
  it('search keeps matches and their neighbours only', () => {
    const lay = layout(g, { ...all, query: 'trains' })
    const ids = lay.boxes.filter((b) => b.lane > 0).map((b) => b.node.id)
    expect(ids).toContain('skill:travel')
    expect(ids).not.toContain('cli:pp-lonely')
  })
  it('a kind filter removes that lane', () => {
    const lay = layout(g, { ...all, kinds: new Set<Kind>(['skill', 'cli']) })
    expect(lay.boxes.some((b) => b.lane === 3)).toBe(false)
  })
})
