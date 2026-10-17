#!/usr/bin/env node
// Scan the repo for skills, CLIs, MCPs and harness pieces, and write data/graph.json.
// Pure node, no deps, so it runs the same on macOS and Windows.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildGraph } from './graph.mjs'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPO = fs.realpathSync(path.resolve(APP, '../..'))
const HOME = os.homedir()
const OUT = path.join(APP, 'data', 'graph.json')

const read = (p) => { try { return fs.readFileSync(p, 'utf8') } catch { return null } }
const readJson = (p) => { const t = read(p); try { return t ? JSON.parse(t) : null } catch { return null } }
const isDir = (p) => { try { return fs.statSync(p).isDirectory() } catch { return false } }
const ls = (p) => { try { return fs.readdirSync(p) } catch { return [] } }
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/')

function git(args, cwd = REPO) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}

// Last-change date per tracked path, from one git log pass.
function lastChanged() {
  const out = git(['log', '--format=@%cs', '--name-only', '--since=2025-01-01'])
  const seen = new Map()
  let date = ''
  for (const line of out.split('\n')) {
    if (line.startsWith('@')) date = line.slice(1)
    else if (line && !seen.has(line)) seen.set(line, date)
  }
  return (p) => {
    let best = ''
    for (const [f, d] of seen) if ((f === p || f.startsWith(p + '/')) && d > best) best = d
    return best || null
  }
}

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text ?? '')
  if (!m) return {}
  const out = {}
  const lines = m[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i])
    if (!kv) continue
    let val = kv[2]
    if (/^[>|][-+]?$/.test(val)) {
      const block = []
      while (i + 1 < lines.length && /^(\s+|$)/.test(lines[i + 1]) && !/^[A-Za-z_-]+:/.test(lines[i + 1])) block.push(lines[++i].trim())
      val = block.join(' ').trim()
    }
    out[kv[1]] = val.replace(/^["']|["']$/g, '')
  }
  return out
}

function skillFolder(dir, group, all) {
  for (const name of ls(dir)) {
    const p = path.join(dir, name)
    let lst
    try { lst = fs.lstatSync(p) } catch { continue }
    const linked = lst.isSymbolicLink()
    const real = linked ? (() => { try { return fs.realpathSync(p) } catch { return null } })() : p
    if (linked && !real) { all.push({ name, group, broken: rel(p) }); continue }
    if (!isDir(real)) continue
    const md = read(path.join(real, 'SKILL.md'))
    if (md == null) continue
    const docs = [md, ...ls(path.join(real, 'references')).map((f) => read(path.join(real, 'references', f)) ?? '')].join('\n')
    all.push({ name, group, dir: real, md, docs, fm: frontmatter(md) })
  }
}

function scanSkills() {
  const all = []
  skillFolder(path.join(REPO, 'pipelines/.claude/skills'), 'pipelines', all)
  const pipeNames = new Set(all.map((s) => s.name))
  const root = []
  skillFolder(path.join(REPO, '.claude/skills'), 'personal', root)
  for (const s of root) if (!pipeNames.has(s.name)) all.push(s)
  for (const s of all) {
    if (s.group === 'pipelines' && s.dir && !s.dir.startsWith(path.join(REPO, 'pipelines/.claude/skills'))) s.group = 'vendored'
    if (s.broken && s.broken.startsWith('pipelines/')) s.group = 'vendored'
  }
  const workDir = process.env.WORK_SKILLS_DIR || path.join(HOME, 'codebase/work-skills/skills')
  const work = []
  skillFolder(workDir, 'work', work)
  return { skills: all, work, workFound: isDir(workDir) }
}

function scanClis() {
  const out = []
  const base = path.join(REPO, 'tooling/cli')
  for (const dir of ls(base)) {
    const d = path.join(base, dir)
    if (!isDir(d)) continue
    const readme = read(path.join(d, 'README.md')) ?? ''
    const blurb = readme.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('>')).slice(0, 1).join(' ')
    let bins = ls(d).filter((f) => {
      if (f.includes('.') || f.startsWith('test')) return false
      try { const st = fs.statSync(path.join(d, f)); return st.isFile() && (st.mode & 0o111) } catch { return false }
    })
    if (!bins.length) bins = [dir]
    for (const bin of bins) out.push({ name: bin, dir, path: `tooling/cli/${dir}`, desc: blurb.replace(/[`*]/g, '').slice(0, 220) })
  }
  const press = path.join(REPO, 'tooling/press-clis')
  for (const dir of ls(press)) if (isDir(path.join(press, dir))) out.push({ name: `${dir}-pp-cli`, dir, path: `tooling/press-clis/${dir}`, desc: 'Printing Press Go CLI', press: true })
  return out
}

function scanMcps() {
  const out = []
  const regen = read(path.join(REPO, 'scripts/regen-mcp-json.sh')) ?? ''
  const wired = new Set([...regen.matchAll(/^\s{4}"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]))
  const folderName = { 'cloudflare-mcp-server': 'cloudflare', 'gmail-mcp-server': 'gmail', 'google-task-mcp-server': 'google-tasks', 'davinci-resolve-mcp': 'davinci-resolve' }
  const base = path.join(REPO, 'tooling/mcp')
  for (const dir of ls(base)) {
    if (!isDir(path.join(base, dir)) || dir === 'google-shared' || dir === 'hostinger') continue
    const name = folderName[dir] ?? dir
    out.push({ name, group: wired.has(name) ? 'wired' : 'parked', path: `tooling/mcp/${dir}` })
  }
  for (const w of wired) if (!out.some((m) => m.name === w)) out.push({ name: w, group: 'wired', path: `tooling/mcp/${Object.keys(folderName).find((k) => folderName[k] === w.replace('-advanced', '')) ?? ''}` })
  // User-level servers: names only, never their config (it holds connection strings).
  for (const cfg of ['.claude-work', '.claude-personal']) {
    const j = readJson(path.join(HOME, cfg, '.claude.json'))
    for (const name of Object.keys(j?.mcpServers ?? {})) if (!out.some((m) => m.name === name)) out.push({ name, group: 'user', path: `~/${cfg}/.claude.json` })
  }
  return out
}

// Plugins of both accounts. A mod is a plugin whose hooks.json loads a JS module.
function scanPlugins() {
  const accounts = { work: '.claude-work', personal: '.claude-personal' }
  const found = new Map()
  for (const [acct, cfg] of Object.entries(accounts)) {
    const installed = readJson(path.join(HOME, cfg, 'plugins/installed_plugins.json'))?.plugins ?? {}
    const enabled = readJson(path.join(HOME, cfg, 'settings.json'))?.enabledPlugins ?? {}
    for (const [key, recs] of Object.entries(installed)) {
      const name = key.split('@')[0]
      const rec = (Array.isArray(recs) ? recs : [recs]).find((r) => r.scope === 'user') ?? (Array.isArray(recs) ? recs[0] : recs)
      const p = found.get(name) ?? { name, key, dir: rec?.installPath, accounts: {} }
      p.accounts[acct] = rec?.scope === 'local' ? 'local' : enabled[key] === false ? 'off' : 'on'
      found.set(name, p)
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
    const inRepo = isDir(path.join(REPO, 'tooling/mods', p.name)) ? path.join(REPO, 'tooling/mods', p.name) : null
    const dir = inRepo ?? p.dir
    const manifest = readJson(path.join(dir ?? '', '.claude-plugin/plugin.json')) ?? {}
    const modules = readJson(path.join(dir ?? '', 'hooks/hooks.json'))?.modules ?? []
    const src = modules.map((m) => read(path.join(dir, 'hooks', m)) ?? '').join('\n')
    const names = (re) => [...new Set([...src.matchAll(re)].map((m) => m[1]))]
    const commands = names(/command\s*\.register\(\{\s*name:\s*['"`]([^'"`]+)/g)
    const tools = names(/tool\s*\.register\(\{\s*name:\s*['"`]([^'"`]+)/g)
    const where = ['work', 'personal'].map((a) => `${a}: ${p.accounts[a] ?? 'not installed'}`).join(', ')
    const parts = [
      (manifest.description ?? 'Claude Code plugin').replace(/\s+/g, ' ').slice(0, 220).replace(/[.\s]+$/, ''),
      commands.length ? `Commands: ${commands.map((c) => `/${c}`).join(' ')}` : '',
      tools.length ? `Tools: ${tools.join(', ')}` : '',
      `Source: ${inRepo ? 'this repo' : p.key.split('@')[1]}. ${where}`,
    ]
    return { name: p.name, group: modules.length ? 'mod' : 'plugin', path: inRepo ? rel(inRepo) : undefined, desc: parts.filter(Boolean).join('. ') }
  })
}

function scanHarness() {
  const out = []
  const hookNames = (file, scope) => {
    const j = readJson(file)
    for (const [ev, arr] of Object.entries(j?.hooks ?? {})) for (const m of arr) for (const h of m.hooks ?? []) {
      const script = (h.command ?? '').match(/([A-Za-z0-9_.-]+\.(?:sh|py|mjs|js))/)?.[1]
      if (script && !out.some((o) => o.name === script)) out.push({ name: script, group: 'hook', desc: `${scope} ${ev}${m.matcher ? ` on ${m.matcher}` : ''}` })
    }
  }
  hookNames(path.join(REPO, '.claude/settings.json'), 'repo')
  hookNames(path.join(HOME, '.claude-work/settings.json'), 'user (work)')
  out.push(...scanPlugins())
  const claudeMds = git(['ls-files', '*CLAUDE.md', 'CLAUDE.md']).split('\n').filter(Boolean)
  out.push({ name: 'CLAUDE.md', group: 'routing', path: 'CLAUDE.md', desc: `Routing table, always loaded. ${claudeMds.length} CLAUDE.md files in the repo` })
  for (const f of git(['ls-files', '*.plist']).split('\n').filter((f) => /com\.kbtg\./.test(f))) {
    out.push({ name: path.basename(f, '.plist').replace('com.kbtg.', ''), group: 'launchd', path: f, desc: 'Mac launchd job' })
  }
  const crons = read(path.join(REPO, 'VPS-CRONS.md')) ?? ''
  for (const m of crons.matchAll(/^### ([a-z0-9-]+)\s*\n[\s\S]*?\*\*Wrapper:\*\*/gm)) out.push({ name: m[1], group: 'cron', path: 'VPS-CRONS.md', desc: 'VPS cron' })
  return out
}

const curated = readJson(path.join(APP, 'data/curated.json')) ?? {}
const changed = lastChanged()
const graph = buildGraph({
  repo: 'personal-stuff',
  sha: git(['rev-parse', '--short=8', 'HEAD']),
  scannedAt: new Date().toISOString(),
  ...scanSkills(),
  clis: scanClis(),
  mcps: scanMcps(),
  harness: scanHarness(),
  routing: read(path.join(REPO, 'CLAUDE.md')) ?? '',
  existingCliDirs: ls(path.join(REPO, 'tooling/cli')),
  curated,
  changed,
  rel,
})

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(graph, null, 1) + '\n')

const count = (k) => graph.nodes.filter((n) => n.kind === k).length
console.log(`my-repo scan @ ${graph.meta.sha}: ${count('skill')} skills, ${count('cli')} CLIs, ${count('mcp')} MCPs, ${count('harness')} harness, ${count('service')} services, ${graph.edges.length} links`)
console.log(`loose ends: ${graph.findings.length}`)
for (const f of graph.findings) console.log(`  [${f.level}] ${f.node}: ${f.text}`)
console.log(`wrote ${rel(OUT)}`)
