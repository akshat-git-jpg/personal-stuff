// Pure graph builder: scanned inputs in, { meta, nodes, edges, findings } out. Tested in test/graph.test.ts.

export const DESC_BUDGET = 500
export const DESC_CAP = 700

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Trigger phrases: every "quoted" fragment in a description, else the list after "Triggers on". */
export function triggers(desc) {
  const quoted = [...(desc ?? '').matchAll(/["“]([^"”]{2,60})["”]/g)].map((m) => m[1].trim())
  if (quoted.length) return [...new Set(quoted)].slice(0, 12)
  const after = /Triggers? on (.+?)(?:\.|$)/i.exec(desc ?? '')?.[1]
  return after ? after.split(/,\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 12) : []
}

/** Does a skill's text call a CLI? pp-* names match as words; generic names need a code span or the folder path. */
export function mentionsCli(text, cli) {
  if (text.includes(`${cli.path}/`) || text.includes(`${cli.path}\``) || text.includes(`${cli.path} `)) return true
  const n = esc(cli.name)
  if (/^pp-|-pp-cli$/.test(cli.name)) return new RegExp(`(?<![\\w-])${n}(?![\\w-])`).test(text)
  return new RegExp(`\`${n}(?:[\\s\`])`).test(text)
}

/** Skills named in a line that also says "skill": `travel` skill, the `drive` skill, /secretary. */
export function mentionedSkills(text, names, self) {
  const hits = new Set()
  for (const line of text.split('\n')) {
    if (!/skill/i.test(line)) continue
    for (const m of line.matchAll(/`\/?([a-z0-9:-]+)`|(?:^|\s)\/([a-z][a-z0-9-]+)/g)) {
      const n = (m[1] ?? m[2]).replace(/^superpowers:/, '')
      if (n !== self && names.has(n)) hits.add(n)
    }
  }
  return hits
}

export const OTHER = 'Other'

/**
 * Sets `scope` (personal | work) and `area` on every node; returns the area list for the page.
 * Skills, CLIs and MCPs take the first matching area of their scope. Services take their callers' scope.
 */
export function assignAreas(nodes, edges, curated = {}) {
  const defs = (curated.areas ?? []).map((a) => ({ ...a, re: a.match ? new RegExp(a.match) : null }))
  const workRe = curated.workScope ? new RegExp(curated.workScope) : null
  const fallback = (scope) => defs.filter((a) => a.scope === scope && !a.re && !a.groups).at(-1)?.name ?? OTHER
  for (const n of nodes) {
    if (n.kind === 'service') continue
    n.scope = n.group === 'work' || workRe?.test(n.name) ? 'work' : 'personal'
    if (n.kind === 'harness') { n.area = null; continue }
    const hit = defs.find((a) => a.scope === n.scope && ((a.groups ?? []).includes(n.group) || a.re?.test(n.name)))
    n.area = hit?.name ?? fallback(n.scope)
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const n of nodes) {
    if (n.kind !== 'service') continue
    const callers = edges.filter((e) => e.to === n.id).map((e) => byId.get(e.from)).filter(Boolean)
    n.scope = callers.some((c) => c.scope === 'personal') || !callers.length ? 'personal' : 'work'
    n.area = null
  }
  const used = new Set(nodes.map((n) => `${n.scope}|${n.area}`))
  const list = defs.filter((a) => used.has(`${a.scope}|${a.name}`)).map(({ name, scope, blurb, collapsed }) => ({ name, scope, blurb: blurb ?? '', collapsed: !!collapsed }))
  for (const scope of ['personal', 'work']) {
    if (used.has(`${scope}|${OTHER}`)) list.push({ name: OTHER, scope, blurb: 'Matched no area rule: add one in data/curated.json', collapsed: false })
  }
  return list
}

export function buildGraph(input) {
  const { skills, work, clis, mcps, harness, routing, curated = {}, existingCliDirs = [], changed = () => null, rel = (p) => p } = input
  const nodes = new Map()
  const edges = []
  const findings = []
  const add = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, n); return nodes.get(n.id) }
  const link = (from, to, kind) => { if (from !== to && !edges.some((e) => e.from === from && e.to === to)) edges.push({ from, to, kind }) }
  const note = (node, level, text) => findings.push({ node, level, text })

  for (const s of [...skills, ...work]) {
    const id = `${s.group === 'work' ? 'work' : 'skill'}:${s.name}`
    if (s.broken) {
      add({ id, kind: 'skill', name: s.name, group: s.group, path: s.broken, desc: '', triggers: [], status: 'broken' })
      note(id, 'error', 'Symlink points at a folder that does not exist on this machine')
      continue
    }
    const fm = { ...s.fm }
    const md = s.md ?? ''
    const fmDesc = /^---[\s\S]*?\ndescription:\s*([\s\S]*?)\n(?:[a-z_-]+:|---)/m.exec(md)?.[1] ?? ''
    const desc = (fm.description ?? fmDesc.replace(/^[>|][-+]?\s*/, '').replace(/\s*\n\s*/g, ' ')).trim()
    const path = s.dir && s.group !== 'work' ? rel(s.dir) : `work-skills/skills/${s.name}`
    add({ id, kind: 'skill', name: s.name, group: s.group, path, desc: desc.slice(0, 700), descLen: desc.length, triggers: triggers(desc), updated: s.group === 'work' ? null : changed(path) })
    if (s.group !== 'vendored' && desc.length > DESC_CAP) note(id, 'error', `Description is ${desc.length} chars, over the ${DESC_CAP} hard cap`)
    else if (s.group !== 'vendored' && desc.length > DESC_BUDGET) note(id, 'warn', `Description is ${desc.length} chars, over the ${DESC_BUDGET} budget`)
    if (s.group !== 'work') for (const m of md.matchAll(/tooling\/cli\/([a-z0-9-]+)/g)) {
      if (!existingCliDirs.includes(m[1])) note(id, 'warn', `Points at tooling/cli/${m[1]}, which does not exist`)
    }
  }

  for (const c of clis) {
    const id = `cli:${c.name}`
    add({ id, kind: 'cli', name: c.name, group: c.press ? 'press' : (curated.plumbing ?? []).includes(id) ? 'plumbing' : 'user', path: c.path, desc: c.desc, updated: changed(c.path), status: curated.abandoned?.[id] ? 'abandoned' : undefined })
  }

  for (const m of mcps) {
    const id = `mcp:${m.name}`
    add({ id, kind: 'mcp', name: m.name, group: m.group, path: m.path, desc: { wired: 'Loaded in every repo session (.mcp.json)', parked: 'In the repo, not loaded by default', user: 'User-level server (name only)' }[m.group] })
    if (m.group === 'parked') note(id, 'info', 'Parked: the code is here but .mcp.json does not load it')
  }

  for (const h of harness) {
    add({ id: `harness:${h.name}`, kind: 'harness', name: h.name, group: h.group, path: h.path, desc: h.desc })
    if (h.unregistered) note(`harness:${h.name}`, 'warn', `${h.path} has a CLAUDE.md but no entry in tooling/harnesses.json (no start command recorded)`)
  }

  // Edges: skill -> CLI / MCP / skill.
  const skillList = [...skills, ...work].filter((s) => !s.broken)
  const names = new Set(skillList.filter((s) => s.group !== 'work').map((s) => s.name))
  const workNames = new Set(work.map((s) => s.name))
  for (const s of skillList) {
    const id = `${s.group === 'work' ? 'work' : 'skill'}:${s.name}`
    const text = s.docs ?? s.md ?? ''
    for (const c of clis) if (mentionsCli(text, c)) link(id, `cli:${c.name}`, 'calls')
    for (const m of mcps) if (new RegExp(`mcp__${esc(m.name)}|\`${esc(m.name)}\` MCP|${esc(m.name)} MCP`).test(text)) link(id, `mcp:${m.name}`, 'calls')
    const pool = s.group === 'work' ? workNames : names
    for (const other of mentionedSkills(text, pool, s.name)) link(id, `${s.group === 'work' ? 'work' : 'skill'}:${other}`, 'hands-off')
  }

  for (const [from, tos] of Object.entries(curated.skillCalls ?? {})) {
    if (!nodes.has(from)) continue
    for (const to of tos) {
      if (to.startsWith('connector:')) add({ id: to, kind: 'mcp', name: `claude.ai ${to.slice(10)}`, group: 'connector', desc: 'claude.ai connector' })
      if (nodes.has(to)) link(from, to, 'calls')
    }
  }

  // Routing: CLAUDE.md table rows that name a skill or a CLI folder.
  if (nodes.has('harness:CLAUDE.md')) {
    for (const n of names) if (new RegExp(`\`${esc(n)}\` skill|the \`${esc(n)}\``).test(routing)) link('harness:CLAUDE.md', `skill:${n}`, 'routes')
    for (const c of clis) if (routing.includes(`${c.path}/`)) link('harness:CLAUDE.md', `cli:${c.name}`, 'routes')
  }

  // Services, from curated facts.
  for (const [from, labels] of Object.entries(curated.services ?? {})) {
    if (!nodes.has(from)) continue
    for (const label of labels) {
      add({ id: `service:${label}`, kind: 'service', name: label, group: 'outside' })
      link(from, `service:${label}`, 'reaches')
    }
  }
  for (const n of nodes.values()) if (n.id.startsWith('connector:')) {
    const label = n.name.replace('claude.ai ', '')
    add({ id: `service:${label}`, kind: 'service', name: label, group: 'outside' })
    link(n.id, `service:${label}`, 'reaches')
  }

  // Loose ends.
  const calledBy = (id) => edges.filter((e) => e.to === id && e.from.startsWith('skill:'))
  for (const n of nodes.values()) {
    if (n.kind !== 'cli') continue
    if (n.status === 'abandoned') note(n.id, 'warn', `Abandoned: ${curated.abandoned[n.id]}`)
    else if (n.group === 'user' && !calledBy(n.id).length) note(n.id, 'warn', 'No skill calls this CLI, so plain words never reach it')
  }

  const areas = assignAreas([...nodes.values()], edges, curated)

  const order = { error: 0, warn: 1, info: 2 }
  findings.sort((a, b) => order[a.level] - order[b.level] || a.node.localeCompare(b.node))
  return {
    meta: { repo: input.repo, sha: input.sha, scannedAt: input.scannedAt, workSkills: !!input.workFound, areas },
    nodes: [...nodes.values()],
    edges,
    findings,
  }
}
