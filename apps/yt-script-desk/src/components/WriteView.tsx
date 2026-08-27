import { Fragment, type ReactNode } from 'react'
import type { Beat, Edit } from '../types'
import type { Prefs } from '../hooks/usePrefs'
import { SayCard } from './SayCard'
import { WriteBox } from './WriteBox'

type WriteViewProps = {
  beats: Beat[]
  prefs: Prefs
  draft: Record<string, string>
  edits: Record<string, Edit>
  says: Record<string, string[]>
  onDraftSave: (num: string, text: string) => Promise<void> | void
  onSaySave: (num: string, lines: string[]) => Promise<void> | void
  onSayRestore: (num: string) => Promise<void> | void
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
export function WriteView({ beats, prefs, draft, edits, says, onDraftSave, onSaySave, onSayRestore }: WriteViewProps) {
  return (
    <div className={`tracks${prefs.instructions ? '' : ' no-notes'}`}>
      {prefs.instructions && <div className="rail" />}
      {beats.map((beat, i) => (
        <Fragment key={beat.num}>
          {groupOf(beat) !== groupOf(beats[i - 1]) && (
            <div className="group-head" data-testid="group-head">
              {groupOf(beat)}
            </div>
          )}
          <div className="rowL" data-testid="left-cell">
            <div className="beat-num">{`${groupOf(beat)} ${beat.num}`}</div>
            <span className={`tag ${beat.mode === 'read' ? 'tag-say' : 'tag-write'}`}>
              {beat.mode === 'read' ? 'Read as written' : 'You write this'}
            </span>

            {beat.demo.length > 0 && <DemoCard lines={beat.demo} />}

            {beat.mode === 'read' && (
              <SayCard
                lines={says[beat.num] ?? beat.say ?? []}
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
              {renderRightCell(beat, prefs)}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}

// Every label here MUST equal the toggle label in ToggleRail — the owner's
// rule is that the switch and the block say the same words, so nobody has to
// work out which chip hid which block. `General Notes` deliberately merges the
// section's RULES with the beat's FACTS: both are context to know, as opposed
// to an action to take.
const LANES: Array<{ pref: keyof Prefs; label: string; lines: (b: Beat) => string[] }> = [
  { pref: 'whatToCover', label: 'What to cover', lines: (b) => b.angle ?? [] },
  { pref: 'screenRecording', label: 'Screen Recording notes', lines: (b) => b.show },
  { pref: 'generalNotes', label: 'General Notes', lines: (b) => [...b.rules, ...b.facts] },
  { pref: 'videoEditor', label: 'Video Editor Notes', lines: (b) => b.edit },
]

function renderRightCell(beat: Beat, prefs: Prefs): ReactNode {
  const blocks: ReactNode[] = []

  for (const lane of LANES) {
    if (!prefs[lane.pref]) continue
    const lines = lane.lines(beat)
    if (lines.length === 0) continue
    blocks.push(<InstructionBlock key={lane.pref} label={lane.label} lines={lines} />)
  }

  if (blocks.length === 0) return <p className="right-empty">No instructions for this beat.</p>
  return blocks
}

// Outline authors emphasise with markdown - "**This is the one demo block**" -
// and the instruction track used to print the asterisks literally. Bold is the
// only inline mark that appears in these lanes, so this renders that one and
// leaves every other character alone rather than pulling in a markdown parser.
function renderEmphasis(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((piece, i) =>
    piece.startsWith('**') && piece.endsWith('**') && piece.length > 4 ? (
      <strong key={i}>{piece.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{piece}</Fragment>
    ),
  )
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

function InstructionBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="right-block">
      <div className="right-block-label">{label}</div>
      {lines.map((line, i) => (
        <div className="right-block-line" key={i}>
          {renderEmphasis(line)}
        </div>
      ))}
    </div>
  )
}
