#!/usr/bin/env node
// One structured beat model for a script-plan.md, shared by the script desk UI.
//
// This does NOT own a parser. It lifts a typed model on top of the block parser
// already inside render-worksheet.mjs, so the worksheet and the desk can never
// disagree about what a beat is.
//
//   import { buildBeats } from './lib/beats.mjs'
//   node lib/beats.mjs <key>            # prints JSON for videos/<key>/script-plan.md
//
// The load-bearing rule (decisions.md 2026-08-18): a BODY beat's SAY lane is a
// short DRAFT PROMPT, not finished copy. It must never reach the maker as
// something he can paste — plan 207 removed exactly that. So a body draft lands
// in `angle` (an instruction, shown in the desk's instruction track) and `say`
// stays null. An intro/outro SAY, or a body SAY explicitly noted `— final`, is
// finished copy and lands in `say`.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, bodyPartIndex } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// Single mutation target. Setting this to false routes body SAY drafts into
// `say`, i.e. straight to the maker as pasteable copy — the exact defect the
// gate must catch. Do not inline it back into the condition.
const BODY_DRAFTS_ARE_INSTRUCTIONS = true

// `#### 2.9 · Remembering the character next week` -> ['2.9', 'Remembering …']
const BEAT_RE = /^([0-9A-Za-z][0-9A-Za-z.]*)\s*·\s*(.*)$/

// A pre-spec outline uses `### 1. Cold Open` for a beat and `**Voiceover**` /
// `**Notes**` for its lanes. SCRIPT-PLAN-INSTRUCTIONS.md settled on `#### 1 · Cold
// Open` with `**SAY**` / `**VIDEO**` / `**DEMO**`, and the block parser only
// knows that spelling. Fed a legacy file it does not fail — it quietly returns
// whichever stray `####` headings happen to exist, so the desk renders a short,
// plausible, WRONG script. Measured 2026-08-23: ai-avatar-online-courses came
// back as 5 beats instead of 13, and ai-video-tools-comparison as 0.
// Refuse instead. A wrong script that looks right is the worst outcome here.
const LEGACY_BEAT_RE = /^###\s+\d+[.)]\s+\S/gm
const LEGACY_LANE_RE = /^\*\*(Voiceover|Notes)\*\*\s*$/gm

export class LegacyOutlineError extends Error {
  constructor(message) {
    super(message)
    this.name = 'LegacyOutlineError'
    this.code = 'LEGACY_OUTLINE_FORMAT'
  }
}

function legacyCounts(md) {
  return {
    beats: (md.match(LEGACY_BEAT_RE) ?? []).length,
    lanes: (md.match(LEGACY_LANE_RE) ?? []).length,
  }
}

function refuse(found, parsed) {
  throw new LegacyOutlineError(
    `LEGACY_OUTLINE_FORMAT: this outline predates SCRIPT-PLAN-INSTRUCTIONS.md — ` +
      `found ${found.beats} legacy "### N. Title" beats and ${found.lanes} ` +
      `"**Voiceover**"/"**Notes**" lanes, but parsed ${parsed} beats. ` +
      `Rewrite it as "#### N · Title" with **SAY** / **VIDEO** lanes, ` +
      `or the desk will show a short, plausible, wrong script.`,
  )
}

// Runs BEFORE bodyPartIndex: a legacy file usually also trips NO_BODY_PART, and
// that message sends you hunting for a missing heading instead of the format.
function assertNotLegacyLanes(md) {
  const found = legacyCounts(md)
  if (found.lanes === 0) return
  refuse(found, 0)
}

// Runs after: catches a file that uses legacy headings but no legacy lane names.
function assertNotLegacyBeats(md, beats) {
  const found = legacyCounts(md)
  if (found.beats <= beats.length) return
  refuse(found, beats.length)
}

export function buildBeats(md) {
  assertNotLegacyLanes(md)

  const blocks = parse(md)
  const bodyIdx = bodyPartIndex(blocks)
  const title = blocks.find((b) => b.t === 'title')?.text ?? 'Untitled'

  const partIdxs = blocks.map((b, n) => (b.t === 'part' ? n : -1)).filter((n) => n >= 0)
  const partKindFor = (n) => {
    const owning = partIdxs.filter((p) => p <= n).pop()
    if (owning === undefined || owning < bodyIdx) return 'intro'
    if (owning === bodyIdx) return 'body'
    return 'outro'
  }

  const beats = []
  let curPart = null
  let curPartKind = 'intro'
  let curSection = null
  let cardCount = 0
  let curRules = []
  let curSectionFacts = []
  let curSectionAsk = []
  let pending = null

  const flush = () => {
    if (pending) beats.push(pending)
    pending = null
  }

  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n]

    if (b.t === 'part') {
      flush()
      curPart = b.text
      curPartKind = partKindFor(n)
      cardCount = 0
      curSection = null
      curRules = []
      curSectionFacts = []
      curSectionAsk = []
      continue
    }

    if (b.t === 'section') {
      flush()
      curSection = b.text
      curRules = []
      curSectionFacts = []
      curSectionAsk = []
      continue
    }

    if (b.t === 'rules') {
      // raw[0] is the `**RULES — …**` header line; the rest are `- item` lines.
      curRules = (b.raw ?? [])
        .slice(1)
        .map((l) => l.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
      continue
    }

    // A `FACTS` block between a `### SECTION:` heading and that section's first
    // `#### beat` belongs to the SECTION, the way a RULES box does.
    //
    // Until 2026-08-28 it fell through to `if (!pending) continue` below and was
    // dropped in SILENCE. Every one of the eleven sections in vox-style-video-ai
    // had one — the research behind the section, ten to fifteen lines of it — and
    // none of it ever reached the desk. It looked correct in the markdown, so
    // nothing pointed at it until the owner added source links to those blocks
    // and could not find them in the UI.
    //
    // It attaches to the section's FIRST beat only, not to every beat: RULES
    // repeat because breaking one breaks the video, while FACTS are context to
    // read once. `splice(0)` is what makes it once.
    if (b.t === 'lane' && b.kind === 'FACTS' && !pending) {
      curSectionFacts.push(...b.raw)
      continue
    }

    // A BODY SECTION CARD. Added 2026-08-29.
    //
    // A body section used to hold five to seven `#### 2.n` beats, each with its
    // own SAY / VIDEO / FACTS lanes. The owner read the result as clutter that
    // took the job away from the person doing it: *"I want high level section
    // distinction and their information that's it don't break down too much that
    // it's cluttering everything and removes the creative freedom from the
    // freelancer."* So a body section is now ONE card: the section heading, one
    // flat `**NOTES**` bullet list, one thing to write.
    //
    // There is no `####` heading to hang that on, so the card beat is
    // SYNTHESIZED from the section. `title` is the section name, which is also
    // what the desk shows as the heading (`groupOf` reads `beat.section`), so
    // nothing about the rendered card is invented here.
    //
    // Only `NOTES` triggers this. A section FACTS or ASK block still attaches to
    // the section's first real beat, exactly as before, so every plan written in
    // the old shape parses unchanged.
    if (b.t === 'lane' && b.kind === 'NOTES' && !pending && curPartKind === 'body') {
      cardCount += 1
      const partNum = (curPart || '').match(/^\s*(\d+)/)?.[1] ?? '2'
      pending = {
        num: `${partNum}.${cardCount}`,
        title: curSection ?? 'Untitled section',
        part: curPart,
        partKind: curPartKind,
        section: curSection,
        mode: 'write',
        say: null,
        angle: null,
        demo: [],
        ask: curSectionAsk.splice(0),
        video: [],
        notes: b.raw.slice(),
        facts: curSectionFacts.splice(0),
        rules: curRules.slice(),
        verdict: null,
      }
      continue
    }

    // A section-level ASK - "this whole section drags" - has no beat to hang on, so
    // it attaches to the section's FIRST beat, exactly like a section FACTS block.
    // Without this it would hit `if (!pending) continue` below and vanish, which is
    // the bug that ate every section FACTS block until 2026-08-28.
    if (b.t === 'lane' && b.kind === 'ASK' && !pending) {
      curSectionAsk.push(...b.raw)
      continue
    }

    if (b.t === 'beat') {
      flush()
      const m = b.text.match(BEAT_RE)
      pending = {
        num: m ? m[1] : String(beats.length + 1),
        title: (m ? m[2] : b.text).trim(),
        part: curPart,
        partKind: curPartKind,
        section: curSection,
        mode: curPartKind === 'body' ? 'write' : 'read',
        say: null,
        angle: null,
        demo: [],
        ask: curSectionAsk.splice(0),
        video: [],
        notes: [],
        facts: curSectionFacts.splice(0),
        rules: curRules.slice(),
        verdict: null,
      }
      continue
    }

    if (!pending) continue

    if (b.t === 'verdict') {
      pending.verdict = b.text
      continue
    }

    if (b.t === 'lane') {
      if (b.kind === 'SAY') {
        const isFinal = (b.note || '').trim().toLowerCase() === 'final'
        if (curPartKind === 'body' && !isFinal && BODY_DRAFTS_ARE_INSTRUCTIONS) {
          pending.angle = b.raw.slice()
          pending.mode = 'write'
        } else {
          pending.say = b.raw.slice()
          pending.mode = 'read'
        }
      } else if (b.kind === 'VIDEO' || b.kind === 'SHOW' || b.kind === 'EDIT') {
        // ONE lane for the picture. Filming, screen-recording and post used to be
        // two lanes, SHOW and EDIT, and the split bought nothing: the same person
        // does both, one after the other, on the same beat. Owner, 2026-08-28:
        // *"I don't like having screen recording notes and video editing notes,
        // can you just club them both together and make it just video notes."*
        // SHOW and EDIT are kept as ALIASES, not as separate arrays, so a plan
        // written before the merge parses with nothing dropped. Write VIDEO.
        pending.video.push(...b.raw)
      } else if (b.kind === 'NOTES') {
        // The section card's bullet list. Normally the card was synthesized by
        // the branch above and this never fires; it does fire for a SECOND NOTES
        // block in one section, which appends rather than starting a new card.
        pending.notes.push(...b.raw)
      } else if (b.kind === 'FACTS') {
        pending.facts.push(...b.raw)
      } else if (b.kind === 'ASK') {
        // The owner's own question for Claude, parked in the markdown while he
        // reviews. It rides the beat so the desk can show it in place, and it is
        // stripped before anything is published - see `desk.mjs publish`.
        pending.ask.push(...b.raw)
      } else if (b.kind === 'DEMO') {
        // A silent stretch: something plays or is shown and NOBODY SPEAKS. It is
        // timeline content, not an instruction, which is why it renders in the
        // desk's left track next to the spoken copy rather than in the right
        // one. Added 2026-08-27: the owner could not see the cold open in the
        // timeline, because 12 seconds of video playing with no voiceover had
        // nowhere to live. How to shoot it still belongs in the VIDEO lane.
        pending.demo.push(...b.raw)
      }
      continue
    }
  }

  flush()
  assertNotLegacyBeats(md, beats)

  return { title, beats }
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const arg = argv[0]
  if (!arg) {
    console.error('usage: node lib/beats.mjs <key|path/to/script-plan.md>')
    process.exit(1)
  }
  const inPath = arg.endsWith('.md')
    ? resolve(arg)
    : join(HERE, '..', 'videos', arg, 'script-plan.md')
  if (!existsSync(inPath)) {
    console.error(`no outline at ${inPath}`)
    process.exit(1)
  }
  process.stdout.write(JSON.stringify(buildBeats(readFileSync(inPath, 'utf8')), null, 2) + '\n')
}

if (process.argv[1] && basename(process.argv[1]) === 'beats.mjs') {
  main(process.argv.slice(2))
}

// ---------------------------------------------------------------- edit model

// `buildBeats` above answers "what does the maker read?" — lanes merged into
// arrays, section rules copied onto every beat, section facts folded into the
// first beat. That shape is right for READING and useless for EDITING: once
// two `VIDEO` blocks have been concatenated into one `video` array there is no
// way back to the two places in the file they came from.
//
// `buildEditModel` answers the other question: "what is actually in the file,
// and where?" Every block keeps its own source range, in source order, owned by
// the beat or section it physically sits under. The desk's edit mode renders
// from THIS, so a delete or a move is always a splice of real lines the owner
// can see, never a guess at which half of a merged array to remove.
//
// Added 2026-08-28 for the desk editor. Owner: *"I want it to be editable in
// such a way that I can cut and move sections here and there or I can delete
// sections or I can add more notes or delete notes."*
//
// Deliberately a SEPARATE pass over the same `parse()` output rather than extra
// fields threaded through `buildBeats`. The read path is load-bearing and well
// tested; the editor must not be able to break it.
export function buildEditModel(md) {
  const blocks = parse(md)
  const lines = md.split(/\r?\n/)
  const textOf = (b) => lines.slice(b.line, b.endLine).join('\n')

  const asBlock = (b) => ({
    t: b.t,
    kind: b.kind ?? null,
    note: b.note ?? '',
    spoken: b.spoken ?? false,
    line: b.line,
    endLine: b.endLine,
    text: textOf(b),
  })

  const parts = []
  const sections = []
  const beats = []
  let curPart = null
  let curSection = null
  let curBeat = null

  // A block belongs to the most recent beat; failing that, to the most recent
  // section (that is where a section RULES or FACTS box lives); failing that it
  // is loose, and edit mode leaves it alone rather than inventing an owner.
  const own = (b) => {
    if (curBeat) curBeat.blocks.push(asBlock(b))
    else if (curSection) curSection.blocks.push(asBlock(b))
  }

  for (const b of blocks) {
    if (b.t === 'title') continue

    if (b.t === 'part') {
      curPart = { text: b.text, line: b.line, endLine: b.endLine }
      parts.push(curPart)
      curSection = null
      curBeat = null
      continue
    }

    if (b.t === 'section') {
      curSection = {
        name: b.text,
        part: curPart?.text ?? null,
        line: b.line,
        endLine: b.endLine,
        // `head` is the heading line ALONE. `line..endLine` is widened below to
        // cover everything the section owns, so renaming a section — as opposed
        // to moving all of it — has to splice this narrower range instead.
        head: { line: b.line, endLine: b.endLine },
        blocks: [],
        beatNums: [],
      }
      sections.push(curSection)
      curBeat = null
      continue
    }

    if (b.t === 'beat') {
      const m = b.text.match(BEAT_RE)
      curBeat = {
        num: m ? m[1] : String(beats.length + 1),
        title: (m ? m[2] : b.text).trim(),
        part: curPart?.text ?? null,
        section: curSection?.name ?? null,
        line: b.line,
        endLine: b.endLine,
        head: { line: b.line, endLine: b.endLine },
        blocks: [],
      }
      beats.push(curBeat)
      curSection?.beatNums.push(curBeat.num)
      continue
    }

    own(b)
  }

  // A beat's range runs from its heading to the end of its last block, and a
  // section's from its heading to the end of its last beat. Both are computed
  // from what is actually there rather than from the next heading, so the `---`
  // separators between sections sit outside every range and stay where they are
  // when a section is moved.
  const spanTo = (owner, kids) => {
    const last = kids[kids.length - 1]
    owner.endLine = last ? Math.max(owner.endLine, last.endLine) : owner.endLine
  }
  for (const beat of beats) spanTo(beat, beat.blocks)
  for (const sec of sections) {
    const own = beats.filter((x) => x.section === sec.name && x.part === sec.part)
    spanTo(sec, [...sec.blocks, ...own])
  }

  return { parts, sections, beats }
}
