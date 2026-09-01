export type Approval =
  | { state: 'none' }
  | { state: 'stale'; at: string | null; fingerprint: string }
  | { state: 'ok'; at: string | null; fingerprint: string }

// Mirrors pipelines/youtube/yt-script/lib/beats.mjs `buildBeats()` verbatim
// (plan 231). Do not add fields here that beats.mjs does not produce — this
// type is the contract, not a place to grow the model.
export type Beat = {
  num: string // '2.4', 'A1' — from the outline heading, verbatim
  title: string // 'Five scenes, five tools'
  part: string | null // '2 · BODY'
  partKind: 'intro' | 'body' | 'outro'
  section: string | null
  mode: 'read' | 'write' // read = spoken copy already written; write = he writes it
  say: string[] | null // raw quote lines; '' means a paragraph break. Only when mode==='read'
  angle: string[] | null // the body SAY draft, as an INSTRUCTION. Only when mode==='write'
  demo: string[] // a silent stretch: something plays, nobody speaks. Renders LEFT
  ask: string[] // the OWNER's open question for Claude. Never the maker's business;
  // `desk.mjs publish` refuses while any exists, and strips them if forced.
  video: string[] // ONE lane for the picture: what to film or screen-record AND
  // what to do with it in post. Merged from the old `show`+`edit` pair 2026-08-28.
  notes: string[] // a BODY SECTION CARD's flat bullet list — the whole brief for
  // that section, in one place. Added 2026-08-29; see beats.mjs for why.
  facts: string[]
  rules: string[] // section-level rules
  verdict: string | null
}

export type Edit = { original: string[]; at: string }

export type VideoDoc = {
  key: string
  title: string
  beats: Beat[]
  draft: Record<string, string> // beat.num -> the maker's typed text
  edits: Record<string, Edit> // beat.num -> the original spoken lines, kept
  says: Record<string, string[]> // beat.num -> current spoken lines, when edited
  // The owner's sign-off on this plan, recomputed by the server on every read so an
  // edit made outside the desk shows up as stale rather than silently holding.
  // LOCAL ONLY — the hosted Worker never sends it, so it is absent on a maker's link.
  approval?: Approval
  // STAGED instruction edits, local mode only. `notes` is the current text and
  // `noteEdits` holds the FIRST original, so a restore goes back to what the plan
  // says. Nothing here has reached script-plan.md yet — `bin/desk.mjs apply`
  // splices them all in at once when the owner says he is done reviewing.
  notes?: Record<string, string[]>
  noteEdits?: Record<string, Edit>
  finished: boolean
}

// ---------------------------------------------------------------- edit mode
//
// Mirrors buildEditModel() in pipelines/youtube/yt-script/lib/beats.mjs. This is
// the STRUCTURAL view of script-plan.md - every block with the source lines it
// came from - as opposed to Beat above, which is the READING view with the
// lanes already merged into arrays. Edit mode renders from this one, so a
// delete or a move is always a splice of real lines the owner can point at
// rather than a guess at which half of a merged array to remove.
export type EditRange = { line: number; endLine: number }

export type EditBlock = EditRange & {
  t: 'lane' | 'rules' | 'verdict' | 'quote'
  kind: string | null // VIDEO | SAY | FACTS | DEMO | ASK, or null for a rules box
  note: string
  spoken: boolean
  text: string // the raw markdown, exactly as it sits in the file
}

export type EditBeat = EditRange & {
  num: string
  title: string
  part: string | null
  section: string | null
  head: EditRange // the '#### N - Title' line alone, for a rename
  blocks: EditBlock[]
}

export type EditSection = EditRange & {
  name: string
  part: string | null
  head: EditRange
  blocks: EditBlock[] // RULES / FACTS boxes that sit under the section, not a beat
  beatNums: string[]
}

export type EditModel = {
  parts: (EditRange & { text: string })[]
  sections: EditSection[]
  beats: EditBeat[]
}

export type SourceDoc = { text: string; stamp: string | null; edit: EditModel }
