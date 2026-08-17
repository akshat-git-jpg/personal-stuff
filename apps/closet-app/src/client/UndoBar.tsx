/**
 * UndoBar.tsx — the 10-second reversal strip after a wear/wash.
 * Parent owns the timer; this component only renders and forwards the tap.
 */
export default function UndoBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 px-4 py-3 pb-[env(safe-area-inset-bottom)] transition-opacity duration-150"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
    >
      <span className="text-sm">{label}</span>
      <button type="button" className="btn-ghost" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}
