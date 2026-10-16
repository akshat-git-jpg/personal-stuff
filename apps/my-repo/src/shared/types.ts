export type Scope = 'personal' | 'work'

export type Area = { name: string; scope: Scope; blurb: string; collapsed: boolean }

export type Kind = 'skill' | 'cli' | 'mcp' | 'harness' | 'service'

export type GraphNode = {
  id: string
  kind: Kind
  name: string
  group: string
  path?: string
  desc?: string
  descLen?: number
  triggers?: string[]
  updated?: string | null
  status?: 'broken' | 'abandoned'
  scope?: Scope
  area?: string | null
}

export type Edge = { from: string; to: string; kind: 'calls' | 'hands-off' | 'routes' | 'reaches' }

export type Finding = { node: string; level: 'error' | 'warn' | 'info'; text: string }

export type Graph = {
  meta: { repo: string; sha: string; scannedAt: string; workSkills: boolean; areas: Area[] }
  nodes: GraphNode[]
  edges: Edge[]
  findings: Finding[]
}
