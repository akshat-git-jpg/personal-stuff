export type Need = { id: string; text: string; login?: string }
export type Step = { title: string; status: 'pending' | 'active' | 'done' | 'failed'; note?: string }
export type Plan = { title: string; steps: Step[] }
export type Draft = { id: string; title: string; markdown: string; at: number }
export type Link = { url: string; label: string; at: number }
// seen/changes: the pending line under an answer shows while changes > seen.
export type Brief = { needs: Need[]; plan: Plan | null; drafts: Draft[]; links: Link[]; seen: number; changes: number; nudged?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'session-brief': { brief: Brief }
  }
}
