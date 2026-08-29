import { useEffect, useRef, useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import { useAutoGrow } from '../hooks/useAutoGrow'
import type { Edit } from '../types'

// Single mutation target: setting this to false lets the pencil unlock the card
// with no confirmation at all, which is the defect the gate must catch.
const LOCKED_LINES_NEED_CONFIRM = true

// How long after the last keystroke an always-open box saves itself.
const DEBOUNCE_MS = 600

type SayCardProps = {
  lines: string[]
  editable?: boolean
  // LOCAL MODE. The card is a live textarea from the moment it renders: no
  // pencil, no confirmation, click the words and type. Owner, 2026-08-29: *"i
  // think its better if we can have entire flow editable in place - on local. no
  // need to click pencil."*
  //
  // It stays FALSE on the hosted freelancer link, and the pencil-plus-confirm
  // path below is what he still gets. That gate is not friction for its own
  // sake: the spoken copy is locked copy somebody else wrote, and it exists so a
  // change is a decision he took rather than a stray keystroke.
  alwaysEditable?: boolean
  editedInfo?: Edit | null
  onSave?: (lines: string[]) => void | Promise<void>
  onRestore?: () => void | Promise<void>
}

// Renders spoken copy exactly as written. An empty string in `lines` ends a
// paragraph. Editing a locked line is gated behind a confirmation — see
// LOCKED_LINES_NEED_CONFIRM above and plans/232-script-desk-write-view.md.
export function SayCard({
  lines,
  editable = true,
  alwaysEditable = false,
  editedInfo = null,
  onSave,
  onRestore,
}: SayCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unlockedByPencil, setUnlockedByPencil] = useState(false)
  const [draftText, setDraftText] = useState(lines.join('\n'))
  const [prevLines, setPrevLines] = useState(lines)
  const editBtnRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlocked = alwaysEditable || unlockedByPencil

  // An always-open box is never re-opened, so it never re-reads `lines` on
  // unlock the way the pencil path does. A fresh document (a restore, a reload)
  // has to land in the box, and this is that — during render, so it cannot
  // cascade.
  if (alwaysEditable && lines !== prevLines) {
    setPrevLines(lines)
    setDraftText(lines.join('\n'))
  }

  useEffect(() => {
    if (unlockedByPencil) textareaRef.current?.focus()
  }, [unlockedByPencil])

  // Blur alone was enough while the box opened and closed on purpose. An
  // always-open box may never be blurred at all — he can type and close the tab
  // — so typing also schedules a save.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  // The box is exactly as tall as the copy, so a five-paragraph conclusion opens
  // fully visible instead of two lines at a time. See useAutoGrow.
  useAutoGrow(textareaRef, draftText, unlocked)

  const unlock = () => {
    setDraftText(lines.join('\n'))
    setUnlockedByPencil(true)
  }

  const handleChange = (next: string) => {
    setDraftText(next)
    if (!alwaysEditable) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onSave?.(next.split('\n')), DEBOUNCE_MS)
  }

  const handleEditClick = () => {
    if (LOCKED_LINES_NEED_CONFIRM) {
      setConfirmOpen(true)
    } else {
      unlock()
    }
  }

  const handleConfirmYes = () => {
    setConfirmOpen(false)
    unlock()
  }

  const handleConfirmNo = () => {
    setConfirmOpen(false)
    editBtnRef.current?.focus()
  }

  const handleBlur = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!alwaysEditable) setUnlockedByPencil(false)
    onSave?.(draftText.split('\n'))
  }

  const handleRestore = () => {
    onRestore?.()
  }

  const paragraphs = splitParagraphs(lines)

  return (
    <div className={`say${editable ? ' editable' : ''}${editedInfo ? ' edited' : ''}`}>
      {unlocked ? (
        <textarea
          ref={textareaRef}
          className="say-textarea"
          value={draftText}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      )}

      {editable && !alwaysEditable && !unlocked && (
        <button type="button" className="say-edit-btn" ref={editBtnRef} onClick={handleEditClick} aria-label="Edit">
          <Pencil size={14} />
        </button>
      )}

      <ConfirmDialog open={confirmOpen} onConfirm={handleConfirmYes} onCancel={handleConfirmNo} />

      {editedInfo && (
        <div className="say-edited-strip">
          <span>You changed this line</span>
          <button type="button" className="restore-btn" onClick={handleRestore}>
            <RotateCcw size={12} /> Restore original
          </button>
        </div>
      )}
    </div>
  )
}

// '' in the lines array ends a paragraph; join runs of non-empty lines.
function splitParagraphs(lines: string[]): string[] {
  const paras: string[] = []
  let cur: string[] = []
  for (const l of lines) {
    if (l === '') {
      paras.push(cur.join(' '))
      cur = []
    } else {
      cur.push(l)
    }
  }
  paras.push(cur.join(' '))
  return paras
}
