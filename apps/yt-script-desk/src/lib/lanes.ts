// THE INSTRUCTION BOX IS A MERGE, AND THAT MERGE HAS ONE DEFINITION.
//
// The desk renders ONE instruction block per beat, built by folding five lanes
// together — `**NOTES**`, the body SAY draft, `**VIDEO**`, `**RULES**`,
// `**FACTS**`. So the text the owner edits in that box is the merge, and when he
// saves it he sends the whole merge back as `notes`. Which means the lanes it was
// merged FROM have to be emptied at the same moment, or the next render folds
// them in on top of text that already contains them.
//
// That rule was written out three times: `laneLines` here, `plannedNotes` in
// server/local.mjs, and an inline object spread in App.tsx. On 2026-09-01 the
// server copy was fixed and the App.tsx copy was not, so the desk looked correct
// on a fresh page load and grew by one copy of the untouched lanes on every save
// inside the session. A1 of ai-avatar-generators keeps its brief in a `**VIDEO**`
// lane rather than `**NOTES**`, so two lines became ten in five saves, and a line
// the owner deleted came straight back.
//
// Two copies remain and cannot become one: server/local.mjs is plain `.mjs` on
// the node side and cannot import this module. It carries a pointer back here.
import type { Beat } from '../types'

/** The five lanes, folded in render order. The instruction box shows exactly this. */
export function mergedLanes(beat?: Beat | null): string[] {
  if (!beat) return []
  return [
    ...beat.notes,
    ...(beat.angle ?? []),
    ...beat.video,
    ...beat.rules,
    ...beat.facts,
  ]
}

/**
 * Apply a staged instruction edit to a beat. `lines` is the WHOLE merged block as
 * the owner just edited it, so every lane it was merged from is emptied — leaving
 * one behind is the duplication bug this module exists to prevent.
 *
 * Mirrors `buildVideoDoc` in server/local.mjs. Change one, change the other.
 */
export function stageNotes(beat: Beat, lines: string[]): Beat {
  return { ...beat, notes: lines, angle: null, video: [], rules: [], facts: [] }
}
