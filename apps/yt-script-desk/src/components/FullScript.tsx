import { Check } from 'lucide-react'
import type { Beat, VideoDoc } from '../types'

// Single mutation target: setting this to false renders the beat label inside
// the prose column, which is the exact clutter this view exists to remove.
const LABELS_LIVE_IN_THE_MARGIN = true

type FullScriptProps = {
  doc: VideoDoc | null
  loadError: 'notfound' | 'network' | null
  beatLabels: boolean
  onRetry: () => void
  onFinish: () => Promise<void> | void
}

// The read-through view: one script, top to bottom, in the order it will be
// spoken. Beat labels sit outside the text column (see LABELS_LIVE_IN_THE_MARGIN
// above); his lines and the pre-written ones render with the same markup and no
// distinguishing class, so once a beat is written it is indistinguishable from
// one that was always spoken copy.
export function FullScript({ doc, loadError, beatLabels, onRetry, onFinish }: FullScriptProps) {
  if (loadError === 'notfound') {
    return <p className="full-script-message">No outline for this video yet.</p>
  }

  if (loadError === 'network') {
    return (
      <div className="full-script-message">
        <p>Could not load the script.</p>
        <button type="button" className="btn-ghost" onClick={onRetry}>
          Try again
        </button>
      </div>
    )
  }

  if (!doc) {
    return <p className="full-script-message">Loading…</p>
  }

  if (doc.beats.length === 0) {
    return (
      <>
        <p className="full-script-message">This outline has no beats.</p>
        <FullScriptFooter finished={false} disabled onFinish={onFinish} />
      </>
    )
  }

  const stats = fullScriptStats(doc)
  const allWritten = stats.writtenCount === stats.totalBeats

  return (
    <div>
      <div className="doc">
        {doc.beats.map((beat) => (
          <BeatRows key={beat.num} beat={beat} doc={doc} beatLabels={beatLabels} />
        ))}
      </div>
      <FullScriptFooter
        finished={doc.finished}
        disabled={!allWritten}
        onFinish={onFinish}
      />
    </div>
  )
}

function BeatRows({ beat, doc, beatLabels }: { beat: Beat; doc: VideoDoc; beatLabels: boolean }) {
  const paragraphs = resolveBeatParagraphs(beat, doc)
  const hasVerdict = Boolean(beat.verdict && beat.verdict.trim().length > 0)
  const hasDemo = beat.demo.length > 0
  // A beat that is only a silent stretch is not unwritten — there is nothing to
  // write. Counting it as unwritten put "Not written yet." on the cold open.
  const isUnwritten = paragraphs.length === 0 && !hasVerdict && !hasDemo
  const label = beatLabels ? beat.num : ''
  // The outline's heading, not a title invented for the beat — same rule as the
  // write view's `groupOf` (owner, 2026-08-27: the invented titles were "too
  // confusing"). Intro and conclusion have no section, so the part name stands in.
  const title = beatLabels ? groupHeading(beat) : ''
  const inProse = [label, title].filter(Boolean).join(' · ')

  return (
    <>
      <div className="mk">
        {LABELS_LIVE_IN_THE_MARGIN && label ? (
          <>
            <span className="mk-num">{label}</span>
            {title ? <span className="mk-title">{title}</span> : null}
          </>
        ) : null}
      </div>
      <div className="bd">
        {!LABELS_LIVE_IN_THE_MARGIN && inProse && <span className="mk-in-prose">{inProse} </span>}
        {hasDemo && (
          <p className="fs-demo" data-testid="fs-demo">
            [{beat.demo.join(' ')}]
          </p>
        )}
        {isUnwritten ? (
          <p className="not-written">Not written yet.</p>
        ) : (
          <>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {hasVerdict && <p>{beat.verdict}</p>}
          </>
        )}
      </div>
    </>
  )
}

function groupHeading(beat: Beat): string {
  if (beat.section) return beat.section
  const part = (beat.part ?? '').replace(/^\s*\d+\s*·\s*/, '').trim()
  if (!part) return beat.partKind === 'intro' ? 'Intro' : 'Conclusion'
  return part.charAt(0) + part.slice(1).toLowerCase()
}

function FullScriptFooter({
  finished,
  disabled,
  onFinish,
}: {
  finished: boolean
  disabled: boolean
  onFinish: () => Promise<void> | void
}) {
  return (
    <div className="full-script-footer">
      {finished ? (
        <span className="chip-finished">
          <Check size={14} /> Script finished
        </span>
      ) : (
        <button
          type="button"
          className="btn-finish"
          disabled={disabled}
          title={disabled ? 'Every beat needs words before you can finish.' : undefined}
          onClick={() => onFinish()}
        >
          <Check size={14} /> Mark script finished
        </button>
      )}
    </div>
  )
}

// Resolution order: says (the maker edited a locked line) -> say (spoken copy,
// mode 'read') -> draft (what he wrote). An empty string inside say[]/says[]
// and a blank line inside a typed draft both become a paragraph break.
export function resolveBeatParagraphs(beat: Beat, doc: VideoDoc): string[] {
  const said = doc.says[beat.num]
  let raw: string | null = null

  if (said !== undefined) {
    raw = said.join('\n')
  } else if (beat.mode === 'read' && beat.say) {
    raw = beat.say.join('\n')
  } else {
    const draft = doc.draft[beat.num]
    if (draft && draft.trim().length > 0) raw = draft
  }

  if (raw === null) return []
  return raw
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
}


// No word total here on purpose — owner 2026-08-23 wants no length number
// anywhere in the desk, so nothing counts words any more.
export function fullScriptStats(doc: VideoDoc): { writtenCount: number; totalBeats: number } {
  let writtenCount = 0
  for (const beat of doc.beats) {
    if (resolveBeatParagraphs(beat, doc).length > 0) writtenCount += 1
  }
  return { writtenCount, totalBeats: doc.beats.length }
}
