import { useEffect, useRef, useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import type { Edit } from '../types'

// Single mutation target: setting this to false lets the pencil unlock the card
// with no confirmation at all, which is the defect the gate must catch.
const LOCKED_LINES_NEED_CONFIRM = true

type SayCardProps = {
  lines: string[]
  editable?: boolean
  editedInfo?: Edit | null
  onSave?: (lines: string[]) => void | Promise<void>
  onRestore?: () => void | Promise<void>
}

// Renders spoken copy exactly as written. An empty string in `lines` ends a
// paragraph. Editing a locked line is gated behind a confirmation — see
// LOCKED_LINES_NEED_CONFIRM above and plans/232-script-desk-write-view.md.
export function SayCard({ lines, editable = true, editedInfo = null, onSave, onRestore }: SayCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [draftText, setDraftText] = useState(lines.join('\n'))
  const editBtnRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraftText(lines.join('\n'))
  }, [lines])

  useEffect(() => {
    if (unlocked) textareaRef.current?.focus()
  }, [unlocked])

  const handleEditClick = () => {
    if (LOCKED_LINES_NEED_CONFIRM) {
      setConfirmOpen(true)
    } else {
      setUnlocked(true)
    }
  }

  const handleConfirmYes = () => {
    setConfirmOpen(false)
    setUnlocked(true)
  }

  const handleConfirmNo = () => {
    setConfirmOpen(false)
    editBtnRef.current?.focus()
  }

  const handleBlur = () => {
    setUnlocked(false)
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
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={handleBlur}
        />
      ) : (
        paragraphs.map((p, i) => <p key={i}>{p}</p>)
      )}

      {editable && !unlocked && (
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
