import type { HeygenSelection, HeygenEngine } from '../types'

// A rendered paragraph in the AvatarMode view.
export type RenderedParagraph = {
  section_id: string      // e.g. 's01' — must match script.json section ids
  beat_num: string        // beat.num like '2.4' or 'A1'
  text: string            // one paragraph of spoken text
}

// Map a beat.num to a script.json section id.
// script.json ids look like 's01', 's02'; beat.section names look like
// '2 · BODY' or 'Cold Open'. The mapping rule is POSITIONAL: beats.mjs
// emits sections in the same order as script.json, so we group beats into
// script.json sections by walking both in order.
//
// The AvatarMode component owns this mapping (it has both arrays) and passes
// (beat, sectionIndex) into this helper. section_id comes from script.json.
export function selectionsFromRanges(
  ranges: DraftRange[],
  paragraphs: RenderedParagraph[],
  defaultEngine: HeygenEngine,
  overrides: Record<string, HeygenEngine>,
): HeygenSelection[] {
  // ranges are in DOM-selection order (top of document to bottom of document).
  // Each range names a start paragraph index + start char offset and an end
  // paragraph index + end char offset. We reject any range that spans more
  // than one paragraph — a selection that crosses a paragraph boundary is
  // ambiguous (the paragraph break is often a section break too).
  const results: HeygenSelection[] = []
  ranges.forEach((r, i) => {
    if (r.startParaIdx !== r.endParaIdx) return  // caller should have blocked this in the UI
    const p = paragraphs[r.startParaIdx]
    const text = p.text.slice(r.startOffset, r.endOffset).trim()
    if (text.length === 0) return
    const id = `sel-${String(i + 1).padStart(2, '0')}`
    const engine = overrides[id] ?? defaultEngine
    results.push({
      id,
      section_id: p.section_id,
      engine,
      text,
      text_word_count: text.split(/\s+/).length,
    })
  })
  return results
}

export type DraftRange = {
  startParaIdx: number
  startOffset: number
  endParaIdx: number
  endOffset: number
}

// Total spoken word count across all selections. The header meter uses this
// as a proxy for total seconds (real seconds come from the runner's whisper
// pass, but the desk cannot see that — see the runner's plan 267).
export function totalWords(selections: HeygenSelection[]): number {
  return selections.reduce((n, s) => n + s.text_word_count, 0)
}

// Group selections by engine. Header meter uses this to say "N will use pool".
export function countByEngine(selections: HeygenSelection[]): { heygen3: number; heygen4: number } {
  const out = { heygen3: 0, heygen4: 0 }
  for (const s of selections) out[s.engine]++
  return out
}
