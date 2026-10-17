import { describe, expect, it } from 'vitest'
import { assignAreas, buildGraph, mentionedSkills, mentionsCli, triggers } from '../scripts/graph.mjs'

describe('assignAreas', () => {
  const curated = {
    workScope: '^mongo-app',
    areas: [
      { scope: 'personal', name: 'Libs', groups: ['vendored'] },
      { scope: 'personal', name: 'Google', match: '(drive|gmail)' },
      { scope: 'work', name: 'Systems', match: '^(zluri-|mongo-app)' },
      { scope: 'work', name: 'Shared' },
    ],
  }
  const nodes = [
    { id: 'skill:drive', kind: 'skill', name: 'drive', group: 'personal' },
    { id: 'skill:gsap-drive', kind: 'skill', name: 'gsap-drive', group: 'vendored' },
    { id: 'skill:odd', kind: 'skill', name: 'odd', group: 'personal' },
    { id: 'work:zluri-db', kind: 'skill', name: 'zluri-db', group: 'work' },
    { id: 'work:humanizer', kind: 'skill', name: 'humanizer', group: 'work' },
    { id: 'mcp:mongo-app-prod', kind: 'mcp', name: 'mongo-app-prod', group: 'user' },
    { id: 'service:Mongo', kind: 'service', name: 'Mongo', group: 'outside' },
  ] as { id: string; kind: string; name: string; group: string; scope?: string; area?: string | null }[]
  const list = assignAreas(nodes, [{ from: 'mcp:mongo-app-prod', to: 'service:Mongo', kind: 'reaches' }], curated)
  const area = (id: string) => nodes.find((n) => n.id === id)?.area
  it('first matching area wins, a group beats a later name match', () => {
    expect(area('skill:gsap-drive')).toBe('Libs')
    expect(area('skill:drive')).toBe('Google')
  })
  it('work scope by group or by workScope name; its catch-all takes the rest', () => {
    expect(area('mcp:mongo-app-prod')).toBe('Systems')
    expect(area('work:humanizer')).toBe('Shared')
    expect(nodes.find((n) => n.id === 'service:Mongo')?.scope).toBe('work')
  })
  it('an unmatched personal item goes to Other, and Other is listed', () => {
    expect(area('skill:odd')).toBe('Other')
    expect(list.map((a: { name: string; scope: string }) => `${a.scope}:${a.name}`)).toContain('personal:Other')
  })
})

const skill = (name: string, desc: string, body = '', group = 'personal') => ({
  name, group, dir: `/r/.claude/skills/${name}`, md: `---\nname: ${name}\ndescription: ${desc}\n---\n${body}`, docs: body, fm: { description: desc },
})
const cli = (name: string, dir = name.replace(/^pp-/, '')) => ({ name, dir, path: `tooling/cli/${dir}`, desc: '' })

describe('triggers', () => {
  it('takes every quoted phrase', () => {
    expect(triggers('Drive. Triggers on "upload to drive", "share this file".')).toEqual(['upload to drive', 'share this file'])
  })
  it('falls back to the list after "Triggers on"', () => {
    expect(triggers('Travel. Triggers on travel, trip, flight.')).toEqual(['travel', 'trip', 'flight'])
  })
})

describe('mentionsCli', () => {
  it('matches pp- names as whole words only', () => {
    expect(mentionsCli('run pp-drive search', cli('pp-drive'))).toBe(true)
    expect(mentionsCli('run pp-drive-extra', cli('pp-drive'))).toBe(false)
  })
  it('needs a code span or the folder path for a generic name', () => {
    expect(mentionsCli('check your email inbox', cli('inbox'))).toBe(false)
    expect(mentionsCli('run `inbox pull`', cli('inbox'))).toBe(true)
    expect(mentionsCli('CLI: tooling/cli/inbox/inbox', cli('inbox'))).toBe(true)
  })
})

describe('mentionedSkills', () => {
  it('finds a backticked skill on a line that says skill', () => {
    expect([...mentionedSkills('then the `drive` skill uploads', new Set(['drive', 'travel']), 'travel')]).toEqual(['drive'])
    expect([...mentionedSkills('the `drive` folder', new Set(['drive']), 'travel')]).toEqual([])
  })
})

describe('buildGraph', () => {
  const g = buildGraph({
    repo: 'r', sha: 'abc', scannedAt: '2026-10-16T00:00:00Z', workFound: false,
    skills: [skill('drive', 'Drive. "upload to drive"', 'CLI: tooling/cli/drive/pp-drive'), skill('long', 'x'.repeat(520))],
    work: [], clis: [cli('pp-drive'), cli('pp-lonely'), cli('wt', 'wt')], mcps: [{ name: 'gmail', group: 'parked', path: 'tooling/mcp/gmail-mcp-server' }],
    harness: [{ name: 'CLAUDE.md', group: 'routing' }, { name: 'butler', group: 'agent', path: 'tooling/butler' }, { name: 'stray', group: 'agent', path: 'tooling/stray', unregistered: true }], routing: '', existingCliDirs: ['drive', 'lonely', 'wt'],
    curated: { services: { 'cli:pp-drive': ['Google Drive'] }, plumbing: ['cli:wt'] },
  })
  it('links skill -> CLI -> service', () => {
    expect(g.edges).toContainEqual({ from: 'skill:drive', to: 'cli:pp-drive', kind: 'calls' })
    expect(g.edges).toContainEqual({ from: 'cli:pp-drive', to: 'service:Google Drive', kind: 'reaches' })
  })
  it('flags a user CLI no skill calls, but not plumbing', () => {
    const nodes = g.findings.map((f: { node: string }) => f.node)
    expect(nodes).toContain('cli:pp-lonely')
    expect(nodes).not.toContain('cli:wt')
  })
  it('flags a folder agent with no start command, not a registered one', () => {
    expect(g.findings).toContainEqual(expect.objectContaining({ node: 'harness:stray', level: 'warn' }))
    expect(g.findings.map((f: { node: string }) => f.node)).not.toContain('harness:butler')
  })
  it('flags a description over budget and a parked MCP', () => {
    expect(g.findings).toContainEqual(expect.objectContaining({ node: 'skill:long', level: 'warn' }))
    expect(g.findings).toContainEqual(expect.objectContaining({ node: 'mcp:gmail', level: 'info' }))
  })
})
