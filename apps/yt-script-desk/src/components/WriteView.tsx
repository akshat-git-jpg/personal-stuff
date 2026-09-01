import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import type { Beat, Edit } from '../types'
import type { Prefs } from '../hooks/usePrefs'
import { SayCard } from './SayCard'
import { useAutoGrow } from '../hooks/useAutoGrow'
import { WriteBox } from './WriteBox'
import { mergedLanes } from '../lib/lanes'

type WriteViewProps = {
  beats: Beat[]
  prefs: Prefs
  draft: Record<string, string>
  edits: Record<string, Edit>
  says: Record<string, string[]>
  onDraftSave: (num: string, text: string) => Promise<void> | void
  onSaySave: (num: string, lines: string[]) => Promise<void> | void
  onSayRestore: (num: string) => Promise<void> | void
  // Instruction editing is LOCAL ONLY. On the hosted freelancer link these are
  // undefined, the pencil never renders, and the notes are read-only.
  onNotesSave?: (num: string, lines: string[]) => Promise<void> | void
  onNotesRestore?: (num: string) => Promise<void> | void
  noteEdits?: Record<string, Edit>
  // LOCAL MODE: every box on the page is live. No pencil anywhere. Owner,
  // 2026-08-29: *"i think its better if we can have entire flow editable in
  // place - on local. no need to click pencil."*
  alwaysEditable?: boolean
}

// The governing rule: the left track is the AUDIO TIMELINE. Three things live
// there — spoken copy read as written, lines the maker writes himself, and a
// DEMO block marking a stretch where nothing is spoken at all. Everything else
// (show, edit, facts, angle) is an instruction and belongs in the right cell
// only.
//
// DEMO is the one exception to "instructions never enter the left track", and it
// is not really an exception: a silent stretch is timeline content, not an
// instruction. Added 2026-08-27, because a cold open of 12 seconds of video with
// no voiceover had nowhere to appear, so the timeline read as if the video
// started on the first spoken line.
export function WriteView({
  beats,
  prefs,
  draft,
  edits,
  says,
  onDraftSave,
  onSaySave,
  onSayRestore,
  onNotesSave,
  onNotesRestore,
  noteEdits = {},
  alwaysEditable = false,
}: WriteViewProps) {
  return (
    <div className={`tracks${prefs.instructions ? '' : ' no-notes'}`}>
      {prefs.instructions && <div className="rail" />}
      <Contents beats={beats} />
      {beats.map((beat, i) => (
        <Fragment key={beat.num}>
          {groupOf(beat) !== groupOf(beats[i - 1]) && (
            <div className="group-head" data-testid="group-head">
              <span className="group-head-tick" aria-hidden="true" />
              {groupOf(beat)}
            </div>
          )}
          <div className="rowL" data-testid="left-cell">
            {/* The number AND its section. Owner asked for "intro 1.1, intro 1.2"
                on 2026-08-27 and again on 2026-08-28: *"make these changes such
                that the heading also the subheadings also contains the heading
                main heading"*. It was briefly the number alone, during the
                header polish, because the section name had been rendering in
                uppercase mono directly under a header saying the same words.
                The duplication was never the problem — the SHOUTING was. So the
                name is back, in sentence case, sized and coloured to sit under
                the number rather than compete with the header. */}
            <div className="beat-num">
              <span className="beat-num-n">{beat.num}</span>
              <span className="beat-num-sec">{labelOf(beat)}</span>
            </div>
            <span className={`tag ${beat.mode === 'read' ? 'tag-say' : 'tag-write'}`}>
              {beat.mode === 'read' ? 'Read as written' : 'You write this'}
            </span>

            {beat.demo.length > 0 && <DemoCard lines={beat.demo} />}
            {beat.ask.length > 0 && <AskCard lines={beat.ask} />}

            {beat.mode === 'read' && (
              <SayCard
                lines={says[beat.num] ?? beat.say ?? []}
                alwaysEditable={alwaysEditable}
                editedInfo={edits[beat.num] ?? null}
                onSave={(lines) => onSaySave(beat.num, lines)}
                onRestore={() => onSayRestore(beat.num)}
              />
            )}

            {beat.mode === 'write' && (
              <WriteBox value={draft[beat.num] ?? ''} onSave={(text) => onDraftSave(beat.num, text)} />
            )}

            {beat.verdict && <SayCard lines={[beat.verdict]} editable={false} />}
          </div>

          {prefs.instructions && (
            <div className="rowR" data-testid="right-cell">
              {renderRightCell(beat, {
                edited: Boolean(noteEdits[beat.num]),
                alwaysOpen: alwaysEditable,
                onSave: onNotesSave ? (lines) => onNotesSave(beat.num, lines) : undefined,
                onRestore: onNotesRestore ? () => onNotesRestore(beat.num) : undefined,
              })}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}

// ONE block. It was three — `What to cover`, `Video notes`, `General notes` —
// one per lane in the markdown, each with its own switch on the rail.
//
// The owner read the result as clutter, on 2026-08-29: *"remove those sections
// about video notes separately, general notes separately, everything else. Just
// need a simple bullet points on what to do inside that video, and let the
// freelancer who will be working on this script and video take care of the
// things."* The person reading this column does one job on one section. Sorting
// his brief into three boxes by which lane it was typed into is the writer's
// filing system leaking into the reader's screen.
//
// Order is deliberate and is the order the markdown is read in: the section
// card's own bullets, then anything an older plan put in its other lanes. A plan
// written in the new shape has only `notes` and the rest are empty.
// How long after the last keystroke an always-open notes box saves itself.
const NOTES_DEBOUNCE_MS = 600



type NoteEditing = {
  edited: boolean
  alwaysOpen?: boolean
  onSave?: (lines: string[]) => void | Promise<void>
  onRestore?: () => void | Promise<void>
}

function renderRightCell(beat: Beat, editing: NoteEditing): ReactNode {
  const lines = mergedLanes(beat)
  if (lines.length === 0 && !editing.onSave) {
    return <p className="right-empty">No notes for this section.</p>
  }
  return <InstructionBlock label="Notes" lines={lines} editing={editing} />
}

// Two inline marks, and only two. Outline authors emphasise with markdown -
// "**This is the one demo block**" - and the instruction track used to print the
// asterisks literally. And the lanes cite sources by URL.
//
// URLs are CLICKABLE because a reference the freelancer cannot open is not a
// reference. The lanes name people he has never heard of - "Joseph's checklist",
// "Skai's angle" - and owner, 2026-08-28: *"can we please add reference link
// wherever possible for my freelancer... you said Joseph's list, but I don't
// think my freelancer is aware of Joseph."*
//
// BARE urls, not markdown links. There is no markdown parser on this track and
// `[Joseph](https://...)` printed its brackets literally. The trailing character
// class stops a sentence-ending period being swallowed into the href.
const INLINE_RE = /(\*\*[^*]+\*\*|https?:\/\/[^\s<>()]*[^\s<>().,;:!?])/g

function renderEmphasis(line: string): ReactNode[] {
  return line.split(INLINE_RE).map((piece, i) => {
    if (piece.startsWith('**') && piece.endsWith('**') && piece.length > 4) {
      return <strong key={i}>{piece.slice(2, -2)}</strong>
    }
    if (/^https?:\/\//.test(piece)) {
      return (
        <a key={i} className="lane-link" href={piece} target="_blank" rel="noopener noreferrer">
          {piece.replace(/^https?:\/\//, '')}
        </a>
      )
    }
    return <Fragment key={i}>{piece}</Fragment>
  })
}

// The heading a beat sits under is the OUTLINE'S heading, never a title invented
// for the beat. Owner, 2026-08-27, looking at beats called "Cold open — a
// finished Vox shot, no logos, no UI" and "Reveal, who this is for, and
// credibility": *"I don't like it. These are too confusing. I prefer that this
// heading should be the actual outline headings... if you're doing this for the
// intro you can keep that as intro as a heading and then you can just make it
// intro 1.1 intro 1.2"*.
//
// Before this the desk showed `beat.title` and never showed `beat.section` at
// all, so the eleven section names he approved at gate 040 were invisible here
// and what he read instead was prose the script plan had made up. `beat.title`
// is still parsed and still in the data; it is simply not what labels a beat.
// The heading for the card itself. For a SUBSECTION that is its own name
// (`Picking a Topic That Holds Up`); for a section with no subsections the card
// IS the section, so the two read the same. Both come from the outline.
//
// It showed `groupOf` — the parent — until 2026-08-29, which was right while a
// body section was one flat card and wrong the moment sections got subsections:
// eight cards under one chapter all carried the chapter's name and nothing said
// which step you were on.
function labelOf(beat: Beat): string {
  return beat.title || groupOf(beat)
}

// The table of contents, at the top of the page. Owner, 2026-08-29: *"at the top
// of the script can we show the outline? All sections, subsection, etc. Just the
// title."*
//
// DERIVED from the beats rather than sent by the API, so it cannot disagree with
// the document under it and no snapshot needs republishing to gain one. A body
// beat's number carries the shape: `3` is a section, `3.1` is a subsection of
// section 3.
function Contents({ beats }: { beats: Beat[] }) {
  const rows: { num: string; title: string; level: number }[] = []
  let lastSection: string | null = null

  for (const b of beats) {
    if (b.partKind !== 'body') continue
    const sectionNum = b.num.split('.')[0]
    if (sectionNum !== lastSection) {
      rows.push({ num: sectionNum, title: b.section ?? b.title, level: 1 })
      lastSection = sectionNum
    }
    if (b.num.includes('.')) rows.push({ num: b.num, title: b.title, level: 2 })
  }

  if (rows.length === 0) return null

  return (
    <div className="contents" data-testid="contents">
      <div className="contents-label">What this video covers</div>
      <ol className="contents-list">
        {rows.map((r) => (
          <li key={r.num} className={r.level === 2 ? 'contents-row contents-sub' : 'contents-row'}>
            <span className="contents-num">{r.num}</span>
            <span className="contents-title">{r.title}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function groupOf(beat: Beat | undefined): string {
  if (!beat) return ''
  if (beat.section) return beat.section
  // Intro and conclusion have no section, so the part name is the outline
  // heading for them. `2 · BODY` style prefixes are stripped, and the result is
  // sentence case because Title Case reads as a label (TASTE.md T8).
  const part = (beat.part ?? '').replace(/^\s*\d+\s*·\s*/, '').trim()
  if (!part) return beat.partKind === 'intro' ? 'Intro' : 'Conclusion'
  return part.charAt(0) + part.slice(1).toLowerCase()
}

// A silent stretch. Deliberately NOT a SayCard: nothing here is spoken, so it
// must never look like a line to read, and it carries no pencil and no write
// box because there is nothing for the maker to write.
// The owner's own open question to Claude, written as an `**ASK**` lane in the
// markdown while he reviews. It renders in the LEFT track, below the beat, and it
// is deliberately the loudest thing on the page: an unanswered question is work
// outstanding, and `desk.mjs publish` refuses while one exists.
//
// It can never be mistaken for script. Nothing purple is ever on paper - the
// spoken card is warm cream with a serif face, this is a purple-bordered box in
// the sans face, addressed to Claude by name.
//
// Added 2026-08-28 INSTEAD of a browser markup UI. The owner already had the whole
// script as text in his editor, where cut and paste work; the one thing the editor
// could not give him was leaving a question in place that the desk could show him.
// This lane is that, and nothing else.
function AskCard({ lines }: { lines: string[] }) {
  return (
    <div className="ask-card" data-testid="ask-card">
      <span className="ask-card-dot" aria-hidden="true" />
      <div className="ask-card-body">
        <div className="ask-card-label">Asked Claude</div>
        {lines.map((l, i) => (
          <div key={i} className="ask-card-line">
            {l}
          </div>
        ))}
      </div>
    </div>
  )
}

function DemoCard({ lines }: { lines: string[] }) {
  return (
    <div className="demo-card" data-testid="demo-card">
      <div className="demo-card-label">No voiceover</div>
      {lines.map((line, i) => (
        <div className="demo-card-line" key={i}>
          {renderEmphasis(line)}
        </div>
      ))}
    </div>
  )
}

// The notes block, editable IN PLACE. Owner, 2026-08-29: *"make the edit in
// place for script and instructions."*
//
// The edit is STAGED, not written to script-plan.md — *"i will edit wherever
// required and tell you once all are reviewed and done. then you can update/edit
// in 1 go."* So this saves to the desk's scratch store and `bin/desk.mjs apply`
// splices every staged edit into the markdown in one pass afterwards.
//
// Deliberately simpler than SayCard: no confirmation dialog. A spoken line is
// locked copy someone else has to read aloud, so unlocking it is a decision. A
// note is the owner's own instruction and he is the only one who ever edits it.
function InstructionBlock({
  label,
  lines,
  editing,
}: {
  label: string
  lines: string[]
  editing: NoteEditing
}) {
  const alwaysOpen = Boolean(editing.alwaysOpen && editing.onSave)
  const [openedByPencil, setOpenedByPencil] = useState(false)
  const [text, setText] = useState(lines.join('\n'))
  const [prevLines, setPrevLines] = useState(lines)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = alwaysOpen || openedByPencil

  // An always-open box never re-reads `lines` on open, so a restore or a reload
  // has to land in it here. During render, so it cannot cascade.
  if (alwaysOpen && lines !== prevLines) {
    setPrevLines(lines)
    setText(lines.join('\n'))
  }

  useEffect(() => {
    if (openedByPencil) areaRef.current?.focus()
  }, [openedByPencil])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  useAutoGrow(areaRef, text, open)

  const start = () => {
    setText(lines.join('\n'))
    setOpenedByPencil(true)
  }

  // Blank lines are how a bullet list gets accidentally broken in a textarea, and
  // an empty trailing line would land in the markdown as one.
  const clean = (t: string) => t.split('\n').filter((l, i, all) => l.trim() || i < all.length - 1)

  // An always-open box may never be blurred, so typing saves it too.
  const handleChange = (next: string) => {
    setText(next)
    if (!alwaysOpen) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => editing.onSave?.(clean(next)), NOTES_DEBOUNCE_MS)
  }

  const finish = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!alwaysOpen) setOpenedByPencil(false)
    editing.onSave?.(clean(text))
  }

  return (
    <div className={`right-block${editing.edited ? ' right-block-edited' : ''}`}>
      <div className="right-block-head">
        <div className="right-block-label">{label}</div>
        {editing.edited && <span className="right-block-flag">edited, not yet applied</span>}
        {editing.onSave && !alwaysOpen && !open && (
          <button type="button" className="right-block-btn" onClick={start} aria-label="Edit notes">
            <Pencil size={13} strokeWidth={2} />
          </button>
        )}
        {/* `!openedByPencil`, NOT `!open`: in local mode the box is open for the
            whole session, and gating undo on "not open" made it unreachable
            there. It is only hidden while a pencil-opened box is mid-edit, when
            the change has not been committed to anything yet. */}
        {editing.edited && editing.onRestore && !openedByPencil && (
          <button
            type="button"
            className="right-block-btn"
            onClick={() => editing.onRestore?.()}
            aria-label="Undo note edit"
          >
            <RotateCcw size={13} strokeWidth={2} />
          </button>
        )}
      </div>
      {open ? (
        <textarea
          ref={areaRef}
          className="right-block-area"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={finish}
        />
      ) : lines.length === 0 ? (
        <p className="right-empty">No notes for this section.</p>
      ) : (
        lines.map((line, i) => (
          <div className="right-block-line" key={i}>
            {renderEmphasis(line)}
          </div>
        ))
      )}
    </div>
  )
}
