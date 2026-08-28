// Every edit the owner makes in the desk is a LINE SPLICE on `script-plan.md`.
// There is no second copy of the script, no patch queue and no structured edit
// model to keep in sync — the markdown file stays the one source of truth, and
// each action here turns it into slightly different markdown that is written
// straight back. Added 2026-08-28. Owner: *"I want it to be editable in such a
// way that I can cut and move sections here and there or I can delete sections
// or I can add more notes or delete notes."*
//
// These functions are pure (text in, text out) so the whole editor is testable
// without a browser, a server or a file. That matters more than usual here: a
// wrong splice silently eats part of a script the owner spent hours on.

export type Range = { line: number; endLine: number } // [line, endLine)

const split = (text: string): string[] => text.split(/\r?\n/)

// Markdown does not care how many blank lines separate two blocks, but the
// owner does — a move that leaves three blank lines behind and none in front
// reads as damage even though it parses identically. Every operation ends here:
// runs of blank lines collapse to exactly one, and the file ends with a single
// newline. This is the same normalisation `buildWorksheet` already applies.
export function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n'
}

function clamp(lines: string[], r: Range): Range {
  const line = Math.max(0, Math.min(r.line, lines.length))
  const endLine = Math.max(line, Math.min(r.endLine, lines.length))
  return { line, endLine }
}

/** Remove a range outright. */
export function deleteRange(text: string, r: Range): string {
  const lines = split(text)
  const { line, endLine } = clamp(lines, r)
  lines.splice(line, endLine - line)
  return normalize(lines.join('\n'))
}

/** Swap a range's contents for new text, keeping everything around it. */
export function replaceRange(text: string, r: Range, replacement: string): string {
  const lines = split(text)
  const { line, endLine } = clamp(lines, r)
  lines.splice(line, endLine - line, ...split(replacement.replace(/\s+$/, '')))
  return normalize(lines.join('\n'))
}

/** Insert new text so that it begins at `atLine`. */
export function insertAt(text: string, atLine: number, addition: string): string {
  const lines = split(text)
  const at = Math.max(0, Math.min(atLine, lines.length))
  lines.splice(at, 0, ...split(addition.replace(/\s+$/, '')), '')
  return normalize(lines.join('\n'))
}

/**
 * Move a range so that it begins at `atLine`, where `atLine` is an index into
 * the ORIGINAL text — the caller reads it off the parse it is already holding
 * and does not have to reason about the hole the cut leaves behind.
 *
 * A target INSIDE the range being moved is a no-op rather than an error: that
 * is what dropping a block onto itself means, and it must not corrupt the file.
 */
export function moveRange(text: string, r: Range, atLine: number): string {
  const lines = split(text)
  const { line, endLine } = clamp(lines, r)
  const len = endLine - line
  if (len === 0) return normalize(text)
  if (atLine > line && atLine < endLine) return normalize(text)

  const chunk = lines.slice(line, endLine)
  lines.splice(line, len)
  // Everything at or after the cut shifted up by `len`.
  const dest = atLine <= line ? atLine : atLine - len
  lines.splice(Math.max(0, Math.min(dest, lines.length)), 0, ...chunk, '')
  return normalize(lines.join('\n'))
}

/**
 * Reorder one item among its siblings. The UI works in sibling positions ("this
 * note is 2nd of 4"); this turns that into the line target `moveRange` wants.
 * Returns the text unchanged when the move would not shift anything.
 */
export function moveSibling(text: string, siblings: Range[], from: number, to: number): string {
  if (from === to || from < 0 || from >= siblings.length) return normalize(text)
  const target = Math.max(0, Math.min(to, siblings.length - 1))
  const src = siblings[from]
  // Moving DOWN lands after the target sibling; moving UP lands before it.
  const atLine = target > from ? siblings[target].endLine : siblings[target].line
  return moveRange(text, src, atLine)
}

// The lanes the owner can add from the desk, and the stub each one drops in.
// `SAY` is deliberately absent: spoken copy is written and approved through the
// script flow, never typed into a notes box by accident.
export const ADDABLE_LANES = [
  { kind: 'VIDEO', label: 'Video notes', stub: '**VIDEO**\n' },
  { kind: 'FACTS', label: 'Facts', stub: '**FACTS**\n' },
  { kind: 'ASK', label: 'Ask Claude', stub: '**ASK**\n' },
] as const

export type AddableKind = (typeof ADDABLE_LANES)[number]['kind']
