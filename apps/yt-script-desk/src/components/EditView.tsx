// Edit mode. The reading view with handles on it.
//
// Owner, 2026-08-28: *"I like the view which we have on UI. Can we give a edit
// button? ... I won't have to come to MD file to edit and then check the view.
// I can do all the things in UI."* And, on scope: *"I want it to be editable in
// such a way that I can cut and move sections here and there or I can delete
// sections or I can add more notes or delete notes."*
//
// THE ONE IDEA HERE: every control is a line splice on script-plan.md, and the
// file is written straight back. There is no draft, no patch queue and no
// second copy of the script to fall out of sync. That is why the whole surface
// is this small — `lib/edits.ts` does the work, this file only decides which
// range each button points at.
//
// Why this renders from `EditModel` and not from `Beat[]` like the reading view:
// by the time `buildBeats` has finished, two `VIDEO` blocks on one beat are one
// `video` array and there is no way back to the two places in the file they came
// from. Deleting "the video note" would be a guess. Here every block is exactly
// one block in the file, in file order, so a delete deletes what he clicked.
//
// MOVING USES BUTTONS AND A JUMP MENU, NOT DRAG. A section move in this document
// is typically across several screens of scroll, which is the case drag handles
// are worst at. Up/down for a nudge, "Move to" for the long throw.

import { useEffect, useRef, useState } from 'react'
import type { EditBeat, EditBlock, EditModel, EditRange, EditSection } from '../types'
import { ADDABLE_LANES, deleteRange, insertAt, moveRange, moveSibling, replaceRange } from '../lib/edits'

type Props = {
  model: EditModel
  text: string
  busy: boolean
  error: string | null
  onApply: (nextText: string) => void
  onDismissError: () => void
}

// A block's heading in the editor uses the SAME words as the reading view's
// toggles and block headers - owner's rule 2026-08-23, "whatever is in toggles,
// same thing in right view". A third vocabulary here would be a third thing to
// learn for no reason.
const BLOCK_LABEL: Record<string, string> = {
  NOTES: 'Notes',
  VIDEO: 'Video notes',
  FACTS: 'Facts',
  ASK: 'Asked Claude',
  DEMO: 'Silent demo',
  SAY: 'Spoken',
}

function labelFor(b: EditBlock): string {
  if (b.t === 'rules') return 'Section rules'
  if (b.t === 'verdict') return 'Verdict'
  if (b.kind && BLOCK_LABEL[b.kind]) return BLOCK_LABEL[b.kind]
  return b.kind ?? 'Note'
}

// Spoken copy is approved script. It can be moved and it can be read, but the
// editor never offers a one-click delete for it - that is the one action here
// with no cheap undo and the highest cost if it goes unnoticed.
const isSpoken = (b: EditBlock) => b.kind === 'SAY'

function Handles({
  onUp,
  onDown,
  onDelete,
  disabled,
  what,
  deleteHint,
}: {
  onUp?: () => void
  onDown?: () => void
  onDelete?: () => void
  disabled: boolean
  what: string
  deleteHint?: string
}) {
  return (
    <span className="ed-handles">
      <button type="button" className="ed-btn" disabled={disabled || !onUp} onClick={onUp} title={`Move ${what} up`} aria-label={`Move ${what} up`}>
        ↑
      </button>
      <button type="button" className="ed-btn" disabled={disabled || !onDown} onClick={onDown} title={`Move ${what} down`} aria-label={`Move ${what} down`}>
        ↓
      </button>
      <button
        type="button"
        className="ed-btn ed-btn-del"
        disabled={disabled || !onDelete}
        onClick={onDelete}
        title={deleteHint ?? `Delete ${what}`}
        aria-label={`Delete ${what}`}
      >
        ×
      </button>
    </span>
  )
}

// "Move to" is the long throw: pick a destination by name instead of clicking
// the up arrow eleven times. It resets to its placeholder after every use so it
// never looks like it is reporting where the thing currently is.
function JumpMenu({
  options,
  onPick,
  disabled,
  label,
}: {
  options: { value: number; label: string }[]
  onPick: (index: number) => void
  disabled: boolean
  label: string
}) {
  return (
    <select
      className="ed-jump"
      value=""
      disabled={disabled || options.length === 0}
      aria-label={label}
      title={label}
      onChange={(e) => {
        const v = e.target.value
        e.currentTarget.value = ''
        if (v !== '') onPick(Number(v))
      }}
    >
      <option value="">Move to…</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// Click the text, get the raw markdown for THAT block and nothing else. The
// page around it stays rendered, which is the whole complaint this mode exists
// to answer: the markdown file is easy to edit and impossible to follow.
function BlockBody({
  block,
  busy,
  onSave,
}: {
  block: EditBlock
  busy: boolean
  onSave: (raw: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(block.text)
  const ref = useRef<HTMLTextAreaElement>(null)

  // No effect syncs `draft` back to `block.text` when a save lands. The caller
  // keys this component on the saved text instead, so a change remounts it with
  // a fresh draft. Syncing in an effect would also fire mid-typing on any other
  // re-render and silently throw away what he was in the middle of writing.
  useEffect(() => {
    if (!editing || !ref.current) return
    const el = ref.current
    el.focus()
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [editing])

  if (!editing) {
    return (
      <button type="button" className="ed-body" onClick={() => setEditing(true)} title="Click to edit">
        {block.text.split('\n').slice(1).filter((l) => l.trim()).map((l, i) => (
          <span key={i} className="ed-line">
            {l}
          </span>
        ))}
        {block.text.split('\n').slice(1).every((l) => !l.trim()) && <span className="ed-line ed-empty">(empty)</span>}
      </button>
    )
  }

  return (
    <div className="ed-editing">
      <textarea
        ref={ref}
        className="ed-textarea"
        value={draft}
        disabled={busy}
        spellCheck={false}
        onChange={(e) => {
          setDraft(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight}px`
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(block.text)
            setEditing(false)
          }
        }}
      />
      <div className="ed-editing-actions">
        <button
          type="button"
          className="ed-save"
          disabled={busy}
          onClick={() => {
            setEditing(false)
            if (draft !== block.text) onSave(draft)
          }}
        >
          Save
        </button>
        <button
          type="button"
          className="ed-cancel"
          disabled={busy}
          onClick={() => {
            setDraft(block.text)
            setEditing(false)
          }}
        >
          Cancel
        </button>
        <span className="ed-hint">Raw markdown. Esc cancels.</span>
      </div>
    </div>
  )
}

function AddNote({ onAdd, busy }: { onAdd: (stub: string) => void; busy: boolean }) {
  return (
    <div className="ed-add">
      {ADDABLE_LANES.map((l) => (
        <button key={l.kind} type="button" className="ed-add-btn" disabled={busy} onClick={() => onAdd(l.stub)}>
          + {l.label}
        </button>
      ))}
    </div>
  )
}

export function EditView({ model, text, busy, error, onApply, onDismissError }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null)

  const ranges = (xs: EditRange[]) => xs.map((x) => ({ line: x.line, endLine: x.endLine }))

  // --- block-level ------------------------------------------------------
  const blockOps = (owner: { blocks: EditBlock[] }, i: number) => {
    const sibs = ranges(owner.blocks)
    return {
      up: i > 0 ? () => onApply(moveSibling(text, sibs, i, i - 1)) : undefined,
      down: i < owner.blocks.length - 1 ? () => onApply(moveSibling(text, sibs, i, i + 1)) : undefined,
      del: () => onApply(deleteRange(text, owner.blocks[i])),
      save: (raw: string) => onApply(replaceRange(text, owner.blocks[i], raw)),
    }
  }

  const renderBlocks = (owner: { blocks: EditBlock[] }, scope: string) =>
    owner.blocks.map((b, i) => {
      const op = blockOps(owner, i)
      const id = `${scope}:${b.line}`
      return (
        <div key={id} className={`ed-block ed-block-${(b.kind ?? b.t).toLowerCase()}`} data-testid="ed-block">
          <div className="ed-block-head">
            <span className="ed-block-label">{labelFor(b)}</span>
            {b.note && <span className="ed-block-note">{b.note}</span>}
            <Handles
              what="this note"
              disabled={busy}
              onUp={op.up}
              onDown={op.down}
              onDelete={isSpoken(b) ? undefined : op.del}
              deleteHint={isSpoken(b) ? 'Spoken copy is not deleted from here' : undefined}
            />
          </div>
          <BlockBody key={b.text} block={b} busy={busy} onSave={op.save} />
        </div>
      )
    })

  // --- beats -------------------------------------------------------------
  const beatsOf = (sec: EditSection) =>
    model.beats.filter((b) => b.section === sec.name && b.part === sec.part)

  const looseBeats = model.beats.filter((b) => b.section === null)

  const renderBeat = (beat: EditBeat, sibs: EditBeat[], i: number) => {
    const sibRanges = ranges(sibs)
    const jump = model.sections
      .filter((s) => s.name !== beat.section)
      .map((s, n) => ({ value: n, label: s.name }))
    const jumpTargets = model.sections.filter((s) => s.name !== beat.section)

    return (
      <div key={`beat:${beat.line}`} className="ed-beat" data-testid="ed-beat">
        <div className="ed-beat-head">
          <span className="ed-beat-num">{beat.num}</span>
          <span className="ed-beat-title">{beat.title}</span>
          <Handles
            what={`beat ${beat.num}`}
            disabled={busy}
            onUp={i > 0 ? () => onApply(moveSibling(text, sibRanges, i, i - 1)) : undefined}
            onDown={i < sibs.length - 1 ? () => onApply(moveSibling(text, sibRanges, i, i + 1)) : undefined}
            onDelete={() => setConfirming(`beat:${beat.num}`)}
          />
          <JumpMenu
            label={`Move beat ${beat.num} to another section`}
            disabled={busy}
            options={jump}
            onPick={(n) => onApply(moveRange(text, beat, jumpTargets[n].endLine))}
          />
        </div>
        {confirming === `beat:${beat.num}` && (
          <div className="ed-confirm" role="alert">
            Delete beat {beat.num} and everything in it?
            <button
              type="button"
              className="ed-confirm-yes"
              onClick={() => {
                setConfirming(null)
                onApply(deleteRange(text, beat))
              }}
            >
              Delete
            </button>
            <button type="button" className="ed-confirm-no" onClick={() => setConfirming(null)}>
              Keep it
            </button>
          </div>
        )}
        {renderBlocks(beat, `beat${beat.num}`)}
        <AddNote busy={busy} onAdd={(stub) => onApply(insertAt(text, beat.endLine, stub))} />
      </div>
    )
  }

  return (
    <div className="ed-root">
      <p className="ed-banner">
        Editing <code>script-plan.md</code> directly. Every change is saved to the file as you make it.
      </p>
      {error && (
        <div className="ed-error" role="alert">
          <strong>Not saved.</strong> {error}
          <button type="button" className="ed-error-x" onClick={onDismissError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {looseBeats.length > 0 && (
        <div className="ed-part">{looseBeats.map((b, i) => renderBeat(b, looseBeats, i))}</div>
      )}

      {model.sections.map((sec, si) => {
        const secRanges = ranges(model.sections)
        const kids = beatsOf(sec)
        return (
          <div key={`sec:${sec.line}`} className="ed-section" data-testid="ed-section">
            <div className="ed-section-head">
              <span className="ed-section-kicker">Section {si + 1}</span>
              <span className="ed-section-name">{sec.name}</span>
              <Handles
                what={`section ${sec.name}`}
                disabled={busy}
                onUp={si > 0 ? () => onApply(moveSibling(text, secRanges, si, si - 1)) : undefined}
                onDown={si < model.sections.length - 1 ? () => onApply(moveSibling(text, secRanges, si, si + 1)) : undefined}
                onDelete={() => setConfirming(`sec:${sec.name}`)}
              />
              <JumpMenu
                label={`Move section ${sec.name}`}
                disabled={busy}
                options={model.sections.map((s, n) => ({ value: n, label: `${n + 1}. ${s.name}` })).filter((o) => o.value !== si)}
                onPick={(n) => onApply(moveSibling(text, secRanges, si, n))}
              />
            </div>
            {confirming === `sec:${sec.name}` && (
              <div className="ed-confirm" role="alert">
                Delete the whole section &ldquo;{sec.name}&rdquo; and all {kids.length} beats in it?
                <button
                  type="button"
                  className="ed-confirm-yes"
                  onClick={() => {
                    setConfirming(null)
                    onApply(deleteRange(text, sec))
                  }}
                >
                  Delete section
                </button>
                <button type="button" className="ed-confirm-no" onClick={() => setConfirming(null)}>
                  Keep it
                </button>
              </div>
            )}
            {renderBlocks(sec, `sec${si}`)}
            {kids.map((b, i) => renderBeat(b, kids, i))}
          </div>
        )
      })}
    </div>
  )
}
