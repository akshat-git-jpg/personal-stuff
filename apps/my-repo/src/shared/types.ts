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
}

export type Edge = { from: string; to: string; kind: 'calls' | 'hands-off' | 'routes' | 'reaches' }

export type Finding = { node: string; level: 'error' | 'warn' | 'info'; text: string }

export type Graph = {
  meta: { repo: string; sha: string; scannedAt: string; workSkills: boolean }
  nodes: GraphNode[]
  edges: Edge[]
  findings: Finding[]
}
