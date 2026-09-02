// APPROVAL — the owner's sign-off on a script plan, and the gate publish reads.
//
// Owner, 2026-09-01: *"add a approve button in my local dashboard... when I click on
// approve and when I tell you in the terminal that I have approved the script, you
// should go ahead and publish that using my latest changes."*
//
// Publishing mints a live secret URL and hands the script to a freelancer, so it is
// the one irreversible step in the flow. Until now the only thing standing in front
// of it was the ASK gate. This adds the second half: publish refuses unless the owner
// has approved, AND unless what he approved is still what would be published.
//
// WHY A FINGERPRINT AND NOT A BOOLEAN
//
// A bare "approved: true" flag goes stale the moment he edits another note, and a
// stale approval is worse than none — it publishes a script he signed off six edits
// ago while telling him he approved it. So approval records a fingerprint of exactly
// what he was looking at, and publish recomputes it.
//
// THE FINGERPRINT IS OF THE EFFECTIVE PLAN, NOT THE FILE
//
// This is the part that has to be right. The desk renders `script-plan.md` with the
// staged edits from `desk-draft.json` folded in, and `bin/desk.mjs apply` later writes
// those same edits INTO the file and clears the staging. Both states show the owner
// identical content, so both must fingerprint identically — otherwise running `apply`
// (which is exactly what "publish my latest changes" requires) would invalidate the
// approval it is meant to honour.
//
// So the fingerprint is taken over the EFFECTIVE beats: the plan with staging applied.
// Before apply and after apply, that is the same object, and the hash is the same.
//
// ONE DEFINITION, DELIBERATELY
//
// `effectiveBeats` is imported by server/local.mjs (which renders it) and by
// bin/desk.mjs (which gates on it). It is one function on purpose: the duplication bug
// fixed earlier the same day came from this exact rule being written out three times
// and only two copies being corrected. See src/lib/lanes.ts for the client half.
import { createHash } from 'node:crypto'

/** The five instruction lanes, folded the way the desk renders them. */
export function plannedNotes(beat) {
  if (!beat) return []
  return [
    ...(beat.notes ?? []),
    ...(beat.angle ?? []),
    ...(beat.video ?? []),
    ...(beat.rules ?? []),
    ...(beat.facts ?? []),
  ]
}

/**
 * The plan as the desk shows it: parsed beats with staged edits folded in.
 *
 * A staged note replaces the WHOLE merged instruction block, so every lane it was
 * merged from is emptied — leaving one behind is what made the box grow on every save.
 */
export function effectiveBeats(beats, staged = {}) {
  const says = staged.says ?? {}
  const notes = staged.notes ?? {}
  return (beats ?? []).map((b) => {
    let out = b
    if (says[b.num]) out = { ...out, say: says[b.num] }
    if (notes[b.num]) {
      out = { ...out, notes: notes[b.num], angle: null, video: [], rules: [], facts: [] }
    }
    return out
  })
}

/**
 * THE HASH IS OF THE WORDS, NOT THE WHITESPACE.
 *
 * A staged edit is RAW TEXT out of a browser textarea. The same text written into
 * `script-plan.md` and read back is PARSER-NORMALISED — and the parser drops blank
 * lines, because a blank line is what ends an unquoted lane. So the owner types a
 * 30-line brief with blank lines between his bullets, `apply` writes it, the parse
 * gives back 29 lines, and a fingerprint over the raw arrays moves even though not
 * one word changed.
 *
 * That is what happened on 2026-09-02: the owner approved
 * realistic-ai-avatar-online-courses at 09:43, `apply` ran, and the desk demanded he
 * approve the identical script a second time. He was right to refuse to accept it:
 * *"Last time you had made many mistakes like after approved you asked me to
 * re-approve the things this time I won't tolerate this thing please fix this thing
 * for the long run."*
 *
 * Measured, all four on his real plan — only the first was already safe:
 *
 *   stable  trailing space on a line   staged 29 -> file 29 lines
 *   MOVED   interior blank line        staged 30 -> file 29 lines
 *   MOVED   trailing blank line        staged 30 -> file 29 lines
 *   MOVED   leading blank line         staged 30 -> file 29 lines
 *
 * So both sides are reduced to the same shape before hashing: trailing whitespace
 * off each line, blank lines dropped. Dropping them is CORRECT rather than lenient —
 * a blank line cannot survive into the file, so an approval that still holds after
 * one is typed is approving exactly what will publish.
 *
 * What this does NOT hide: any change to a word, to line order, or to which lines
 * exist. Those all still move the hash, which is the whole job.
 */
function meaningful(lines) {
  return (lines ?? []).map((l) => String(l).replace(/\s+$/, '')).filter((l) => l !== '')
}

/**
 * A stable hash of what would be published. Only the fields the freelancer actually
 * reads go in: chrome, ordering metadata and the owner's private `**ASK**` lane are
 * deliberately excluded, so answering an ASK note does not silently void an approval.
 */
export function fingerprint(title, beats) {
  const material = JSON.stringify({
    title: String(title ?? '').trim(),
    beats: (beats ?? []).map((b) => ({
      num: b.num,
      title: String(b.title ?? '').trim(),
      section: b.section ?? null,
      say: meaningful(b.say),
      notes: meaningful(plannedNotes(b)),
    })),
  })
  return createHash('sha256').update(material).digest('hex')
}

/**
 * Is the recorded approval still good for this plan?
 *
 * Returns one of:
 *   { state: 'none' }              never approved
 *   { state: 'stale', … }          approved, but the plan has changed since
 *   { state: 'ok', at, fingerprint }
 */
export function approvalState(approved, currentFingerprint) {
  if (!approved || !approved.fingerprint) return { state: 'none' }
  if (approved.fingerprint !== currentFingerprint) {
    return { state: 'stale', at: approved.at ?? null, fingerprint: approved.fingerprint }
  }
  return { state: 'ok', at: approved.at ?? null, fingerprint: approved.fingerprint }
}

/** The refusal `publish` prints. Exported so the gate is testable without the network. */
export function formatApprovalRefusal(key, state) {
  const lines = []
  if (state.state === 'none') {
    lines.push(`REFUSED: ${key} has not been approved`)
    lines.push('')
    lines.push('Publishing mints a live secret URL and sends the script to the maker.')
    lines.push('Open the local desk and hit Approve first:')
    lines.push(`  http://localhost:5175/?key=${key}`)
  } else {
    lines.push(`REFUSED: the approval for ${key} is stale`)
    lines.push('')
    lines.push(`Approved at ${state.at ?? 'unknown time'}, but the plan has changed since.`)
    lines.push('Re-read it on the local desk and hit Approve again:')
    lines.push(`  http://localhost:5175/?key=${key}`)
  }
  lines.push('')
  lines.push('Pass --force to publish anyway.')
  return lines.join('\n') + '\n'
}

/**
 * `publish` snapshots `script-plan.md` — and ONLY that file. Staged desk edits live in
 * `desk-draft.json` until `apply` splices them in, so publishing with staging present
 * ships the pre-edit text while the owner believes he shipped his edits.
 *
 * Owner walked straight up to this on 2026-09-01: *"will my changes ... be reflected in
 * the shared link or will that keep on having the original script"*. It would have kept
 * the original, silently. So publish refuses instead, and names the command that fixes it.
 */
export function stagedCount(staged) {
  return Object.keys(staged?.notes ?? {}).length + Object.keys(staged?.says ?? {}).length
}

export function formatStagedRefusal(key, n) {
  return (
    [
      `REFUSED: ${n} desk edit${n === 1 ? '' : 's'} in ${key} ${n === 1 ? 'is' : 'are'} not in script-plan.md yet`,
      '',
      'Publish snapshots script-plan.md. Your staged edits are not in it, so the maker',
      'would get the text as it was BEFORE you edited it. Write them in first:',
      '',
      `  node bin/desk.mjs apply ${key}`,
      '',
      `Review them first with: node bin/desk.mjs edits ${key}`,
      'Pass --force to publish the un-edited plan anyway.',
    ].join('\n') + '\n'
  )
}
