import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'

type ConfirmDialogProps = {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Owner reduced this to exactly: a lock icon, one heading, No / Yes. No
// explanation paragraph, no preview of the line, no reason field.
export function ConfirmDialog({ open, onConfirm, onCancel }: ConfirmDialogProps) {
  const yesRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    yesRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
        return
      }
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button')
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-heading"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-body">
          <div className="lock-tile">
            <Lock size={16} />
          </div>
          <h2 id="confirm-heading">Are you sure you want to make these changes?</h2>
        </div>
        <div className="confirm-footer">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            No
          </button>
          <button type="button" className="btn-accent" ref={yesRef} onClick={onConfirm}>
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
