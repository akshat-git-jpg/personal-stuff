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

// The governing rule: only two things are content — spoken copy read as
// written, and lines the maker writes himself. Everything else (show, edit,
// facts, angle) is an instruction and belongs in the right cell only.
export function WriteView({ beats, prefs, draft, edits, says, onDraftSave, onSaySave, onSayRestore }: WriteViewProps) {
  return (
    <div className={`tracks${prefs.instructions ? '' : ' no-notes'}`}>
      {prefs.instructions && <div className="rail" />}
      {beats.map((beat) => (
        <Fragment key={beat.num}>
          <div className="rowL" data-testid="left-cell">
            <div className="beat-num">{beat.num}</div>
            <div className="beat-title">{beat.title}</div>
            <span className={`tag ${beat.mode === 'read' ? 'tag-say' : 'tag-write'}`}>
              {beat.mode === 'read' ? 'Read as written' : 'You write this'}
            </span>

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

function InstructionBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="right-block">
      <div className="right-block-label">{label}</div>
      {lines.map((line, i) => (
        <div className="right-block-line" key={i}>
          {line}
        </div>
      ))}
    </div>
  )
}
