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
  show: string[]
  edit: string[]
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
  finished: boolean
}
