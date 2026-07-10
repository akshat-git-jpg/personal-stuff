import { SLOTS, LABEL_IDS } from './constants'

export interface Block { id: number; start: number; end: number; labelId: string; title: string }

const MAX_TITLE = 120

/**
 * Storage guard: coerce arbitrary input into a clean, non-overlapping,
 * start-sorted Block[]. Drops anything malformed, out of range, unknown-label,
 * or overlapping a previously accepted block. Reassigns ids 1..n.
 */
export function normalizeDay(input: unknown): Block[] {
  if (!Array.isArray(input)) return []
  const labels = new Set<string>(LABEL_IDS as readonly string[])
  const cleaned: Block[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const start = o.start, end = o.end, labelId = o.labelId
    if (typeof start !== 'number' || typeof end !== 'number' || typeof labelId !== 'string') continue
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue
    if (start < 0 || end < start || end >= SLOTS) continue
    if (!labels.has(labelId)) continue
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, MAX_TITLE) : ''
    cleaned.push({ id: 0, start, end, labelId, title })
  }
  cleaned.sort((a, b) => a.start - b.start)
  const out: Block[] = []
  let lastEnd = -1
  for (const b of cleaned) {
    if (b.start <= lastEnd) continue // overlaps previously accepted block
    out.push(b)
    lastEnd = b.end
  }
  out.forEach((b, i) => { b.id = i + 1 })
  return out
}
