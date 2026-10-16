import { describe, expect, it } from 'vitest'
import { buildGraph, mentionedSkills, mentionsCli, triggers } from '../scripts/graph.mjs'

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
    harness: [{ name: 'CLAUDE.md', group: 'routing' }], routing: '', existingCliDirs: ['drive', 'lonely', 'wt'],
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
  it('flags a description over budget and a parked MCP', () => {
    expect(g.findings).toContainEqual(expect.objectContaining({ node: 'skill:long', level: 'warn' }))
    expect(g.findings).toContainEqual(expect.objectContaining({ node: 'mcp:gmail', level: 'info' }))
  })
})
