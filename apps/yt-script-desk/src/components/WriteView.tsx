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
    <div className={`tracks${prefs.notesTrack ? '' : ' no-notes'}`}>
      {prefs.notesTrack && <div className="rail" />}
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

          {prefs.notesTrack && (
            <div className="rowR" data-testid="right-cell">
              {renderRightCell(beat, prefs)}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}

// Rules and the body-draft angle are always part of the instruction track
// when it's on; show/facts/edit each sit behind their own per-lane toggle.
function renderRightCell(beat: Beat, prefs: Prefs): ReactNode {
  const blocks: ReactNode[] = []

  if (beat.rules.length > 0) blocks.push(<InstructionBlock key="rules" label="Rules" lines={beat.rules} />)
  if (beat.angle && beat.angle.length > 0) blocks.push(<InstructionBlock key="angle" label="Angle" lines={beat.angle} />)
  if (prefs.showRecording && beat.show.length > 0) blocks.push(<InstructionBlock key="show" label="Recording" lines={beat.show} />)
  if (prefs.showFacts && beat.facts.length > 0) blocks.push(<InstructionBlock key="facts" label="Facts" lines={beat.facts} />)
  if (prefs.showEdit && beat.edit.length > 0) blocks.push(<InstructionBlock key="edit" label="Edit" lines={beat.edit} />)

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
