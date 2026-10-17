import type { Area, Edge, Graph, GraphNode, Kind, Scope } from '../shared/types'

export const ROW = 50
export const BOX_H = 40
export const TOP = 12
export const LANES = [
  { key: 'phrase', title: 'You say', x: 0, w: 200 },
  { key: 'skill', title: 'Skill', x: 240, w: 200 },
  { key: 'tool', title: 'CLI or MCP', x: 500, w: 190 },
  { key: 'service', title: 'Outside world', x: 750, w: 180 },
] as const
export const MAP_W = 930

/** What the map shows: one area of one scope, narrowed by kind and search. */
export type Filters = { kinds: Set<Kind>; query: string; scope: Scope; area: string | null }

export type Placed = { node: GraphNode; lane: number; y: number; phrase?: string; away?: string }
export type Line = { from: Placed; to: Placed; kind: Edge['kind'] }
export type Layout = { boxes: Placed[]; lines: Line[]; height: number }

export const TOOL_KINDS: Kind[] = ['cli', 'mcp']

export function matches(n: GraphNode, q: string): boolean {
  if (!q) return true
  const s = q.toLowerCase()
  return [n.name, n.desc ?? '', n.path ?? '', ...(n.triggers ?? [])].some((v) => v.toLowerCase().includes(s))
}

export function index(g: Graph) {
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  const out = new Map<string, Edge[]>()
  const inn = new Map<string, Edge[]>()
  for (const e of g.edges) {
    if (!out.has(e.from)) out.set(e.from, [])
    if (!inn.has(e.to)) inn.set(e.to, [])
    out.get(e.from)!.push(e)
    inn.get(e.to)!.push(e)
  }
  return { byId, out: (id: string) => out.get(id) ?? [], inn: (id: string) => inn.get(id) ?? [] }
}

/** Everything reachable downstream and upstream of one node: the path a click lights up. */
export function trace(g: Graph, id: string | null): Set<string> | null {
  if (!id) return null
  const { out, inn } = index(g)
  const seen = new Set([id])
  const walk = (start: string, next: (x: string) => string[]) => {
    const stack = [start]
    while (stack.length) {
      const cur = stack.pop()!
      for (const n of next(cur)) if (!seen.has(n)) { seen.add(n); stack.push(n) }
    }
  }
  walk(id, (x) => out(x).filter((e) => e.kind !== 'routes').map((e) => e.to))
  walk(id, (x) => inn(x).filter((e) => e.kind !== 'routes').map((e) => e.from))
  return seen
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Infinity)
const inArea = (n: GraphNode, f: Filters) => n.scope === f.scope && (f.area == null || n.area === f.area)

/** Areas of one scope, in config order with collapsed ones last, plus what each holds. */
export function areaCards(g: Graph, scope: Scope, query: string) {
  const areas = g.meta.areas.filter((a) => a.scope === scope)
  const sorted = [...areas.filter((a) => !a.collapsed), ...areas.filter((a) => a.collapsed)]
  return sorted.map((area: Area) => {
    const items = g.nodes.filter((n) => n.scope === scope && n.area === area.name)
    const ids = new Set(items.map((n) => n.id))
    const count = (k: Kind) => items.filter((n) => n.kind === k).length
    return {
      area,
      skills: count('skill'),
      clis: count('cli'),
      mcps: count('mcp'),
      loose: g.findings.filter((f) => ids.has(f.node)).length,
      top: items.filter((n) => n.kind === 'skill').slice(0, 6),
      hits: query ? items.filter((n) => matches(n, query)) : [],
    }
  })
}

/** Four lanes for one area: phrase · skill · CLI/MCP · service. Tools from other areas carry `away`. */
export function layout(g: Graph, f: Filters): Layout {
  const { out, inn, byId } = index(g)
  const isTool = (n: GraphNode) => TOOL_KINDS.includes(n.kind)
  const toolsOf = (id: string) => out(id).map((e) => byId.get(e.to)!).filter((n) => n && isTool(n) && f.kinds.has(n.kind))

  let skills = f.kinds.has('skill') ? g.nodes.filter((n) => n.kind === 'skill' && inArea(n, f)) : []
  let tools: GraphNode[] = []
  const toolSet = new Set<string>()
  const pushTool = (t: GraphNode) => { if (!toolSet.has(t.id)) { toolSet.add(t.id); tools.push(t) } }
  for (const s of skills) toolsOf(s.id).forEach(pushTool)
  for (const n of g.nodes) if (isTool(n) && f.kinds.has(n.kind) && inArea(n, f)) pushTool(n)

  if (f.query) {
    const hit = new Set(g.nodes.filter((n) => matches(n, f.query)).map((n) => n.id))
    const near = (n: GraphNode) => hit.has(n.id) || out(n.id).some((e) => hit.has(e.to)) || inn(n.id).some((e) => hit.has(e.from))
    skills = skills.filter(near)
    tools = tools.filter((t) => near(t) || skills.some((s) => toolsOf(s.id).includes(t)))
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))
  for (let pass = 0; pass < 2; pass++) {
    const sIdx = new Map(skills.map((s, i) => [s.id, i]))
    tools.sort((a, b) => avg(inn(a.id).map((e) => sIdx.get(e.from)!).filter((x) => x != null)) - avg(inn(b.id).map((e) => sIdx.get(e.from)!).filter((x) => x != null)))
    const tIdx = new Map(tools.map((t, i) => [t.id, i]))
    skills.sort((a, b) => avg(toolsOf(a.id).map((t) => tIdx.get(t.id)!)) - avg(toolsOf(b.id).map((t) => tIdx.get(t.id)!)))
  }

  const services: GraphNode[] = []
  if (f.kinds.has('service')) {
    const seen = new Set<string>()
    for (const t of tools) for (const e of out(t.id)) {
      const s = byId.get(e.to)
      if (s?.kind === 'service' && !seen.has(s.id)) { seen.add(s.id); services.push(s) }
    }
  }

  const boxes: Placed[] = []
  const at = new Map<string, Placed>()
  const put = (node: GraphNode, lane: number, y: number) => {
    const away = f.area && node.area && node.area !== f.area ? node.area : undefined
    const p: Placed = { node, lane, y, away }
    boxes.push(p)
    at.set(node.id, p)
    return y
  }
  skills.forEach((s, i) => put(s, 1, TOP + i * ROW))
  // Later lanes sit level with their callers, pushed down only to avoid overlap.
  const settle = (list: GraphNode[], lane: number) => {
    const want = (n: GraphNode) => avg(inn(n.id).map((e) => at.get(e.from)?.y).filter((y): y is number => y != null))
    let last = TOP - ROW
    for (const n of [...list].sort((a, b) => want(a) - want(b))) {
      const w = want(n)
      last = put(n, lane, Math.max(Number.isFinite(w) ? w : last + ROW, last + ROW))
    }
    return last
  }
  const bottom = Math.max(TOP + (skills.length - 1) * ROW, settle(tools, 2), settle(services, 3))
  for (const s of skills) {
    const p = at.get(s.id)!
    if (s.triggers?.length) boxes.push({ node: s, lane: 0, y: p.y, phrase: s.triggers[0] })
  }

  const lines: Line[] = []
  for (const e of g.edges) {
    const a = at.get(e.from)
    const b = at.get(e.to)
    if (a && b && e.kind !== 'routes') lines.push({ from: a, to: b, kind: e.kind })
  }
  for (const b of boxes) if (b.lane === 0) lines.push({ from: b, to: at.get(b.node.id)!, kind: 'calls' })

  return { boxes, lines, height: Math.max(bottom, TOP) + ROW + 20 }
}

/** SVG path for one line: right edge of the left box to the left edge of the right box. */
export function pathFor(l: Line): string {
  const A = LANES[l.from.lane]
  const B = LANES[l.to.lane]
  const y1 = l.from.y + BOX_H / 2
  const y2 = l.to.y + BOX_H / 2
  if (l.from.lane === l.to.lane) {
    const x = A.x
    const bend = x - 24 - Math.min(60, Math.abs(y2 - y1) / 8)
    return `M${x} ${y1} C${bend} ${y1} ${bend} ${y2} ${x} ${y2}`
  }
  const x1 = A.x + A.w
  const x2 = B.x
  const mid = (x1 + x2) / 2
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`
}

export const KIND_LABEL: Record<Kind, string> = { skill: 'Skills', cli: 'CLIs', mcp: 'MCPs', harness: 'Harness', service: 'Outside services' }

export const HARNESS_GROUPS: { key: string; title: string }[] = [
  { key: 'routing', title: 'Routing' },
  { key: 'hook', title: 'Hooks' },
  { key: 'mod', title: 'Mods' },
  { key: 'plugin', title: 'Plugins' },
  { key: 'launchd', title: 'Mac launchd' },
  { key: 'cron', title: 'VPS cron' },
]
