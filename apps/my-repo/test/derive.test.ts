import { describe, expect, it } from 'vitest'
import { areaCards, layout, trace, type Filters } from '../src/client/derive'
import type { Graph, Kind } from '../src/shared/types'

const g: Graph = {
  meta: {
    repo: 'r', sha: 'a', scannedAt: '2026-10-16T00:00:00Z', workSkills: true,
    areas: [
      { name: 'Google', scope: 'personal', blurb: '', collapsed: false },
      { name: 'Life', scope: 'personal', blurb: '', collapsed: false },
      { name: 'Libs', scope: 'personal', blurb: '', collapsed: true },
      { name: 'Systems', scope: 'work', blurb: '', collapsed: false },
    ],
  },
  nodes: [
    { id: 'skill:drive', kind: 'skill', name: 'drive', group: 'personal', triggers: ['upload to drive'], scope: 'personal', area: 'Google' },
    { id: 'skill:travel', kind: 'skill', name: 'travel', group: 'personal', triggers: ['trip'], scope: 'personal', area: 'Life' },
    { id: 'skill:gsap', kind: 'skill', name: 'gsap', group: 'vendored', scope: 'personal', area: 'Libs' },
    { id: 'work:zluri-db', kind: 'skill', name: 'zluri-db', group: 'work', scope: 'work', area: 'Systems' },
    { id: 'cli:pp-drive', kind: 'cli', name: 'pp-drive', group: 'user', scope: 'personal', area: 'Google' },
    { id: 'cli:pp-trains', kind: 'cli', name: 'pp-trains', group: 'user', scope: 'personal', area: 'Life' },
    { id: 'service:Google Drive', kind: 'service', name: 'Google Drive', group: 'outside', scope: 'personal', area: null },
  ],
  edges: [
    { from: 'skill:drive', to: 'cli:pp-drive', kind: 'calls' },
    { from: 'skill:travel', to: 'cli:pp-trains', kind: 'calls' },
    { from: 'skill:travel', to: 'cli:pp-drive', kind: 'calls' },
    { from: 'cli:pp-drive', to: 'service:Google Drive', kind: 'reaches' },
  ],
  findings: [{ node: 'cli:pp-trains', level: 'warn', text: 'x' }],
}
const f = (area: string | null, extra: Partial<Filters> = {}): Filters => ({
  kinds: new Set<Kind>(['skill', 'cli', 'mcp', 'service']), query: '', scope: 'personal', area, ...extra,
})
const ids = (lay: ReturnType<typeof layout>) => lay.boxes.filter((b) => b.lane > 0).map((b) => b.node.id)

describe('areaCards', () => {
  it('lists one scope only, collapsed areas last, with loose-end counts', () => {
    const cards = areaCards(g, 'personal', '')
    expect(cards.map((c) => c.area.name)).toEqual(['Google', 'Life', 'Libs'])
    expect(cards.find((c) => c.area.name === 'Life')?.loose).toBe(1)
    expect(areaCards(g, 'work', '').map((c) => c.area.name)).toEqual(['Systems'])
  })
  it('search fills hits per area', () => {
    expect(areaCards(g, 'personal', 'train').find((c) => c.area.name === 'Life')?.hits.map((n) => n.name)).toEqual(['pp-trains'])
  })
})

describe('layout of one area', () => {
  it('shows only that area, plus tools its skills call from elsewhere, tagged away', () => {
    const lay = layout(g, f('Life'))
    expect(ids(lay).sort()).toEqual(['cli:pp-drive', 'cli:pp-trains', 'service:Google Drive', 'skill:travel'])
    expect(lay.boxes.find((b) => b.node.id === 'cli:pp-drive')?.away).toBe('Google')
    expect(lay.boxes.find((b) => b.node.id === 'cli:pp-trains')?.away).toBeUndefined()
  })
  it('never mixes work into a personal area', () => {
    expect(ids(layout(g, f('Google')))).not.toContain('work:zluri-db')
  })
  it('a kind filter removes that lane', () => {
    expect(layout(g, f('Google', { kinds: new Set<Kind>(['skill', 'cli']) })).boxes.some((b) => b.lane === 3)).toBe(false)
  })
})

describe('trace', () => {
  it('lights up everything up and down the path', () => {
    expect([...trace(g, 'cli:pp-drive')!].sort()).toEqual(['cli:pp-drive', 'service:Google Drive', 'skill:drive', 'skill:travel'])
  })
})
