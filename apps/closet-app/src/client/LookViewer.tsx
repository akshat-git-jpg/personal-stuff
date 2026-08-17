import { api } from './api'
import type { Look } from './types'

/**
 * LookViewer — full-screen overlay for one look. No "I wore this look"
 * button and no list of clothes: looks never link back to clothes (owner
 * decision, 2026-08-17).
 */
export default function LookViewer({
  look,
  tagNames,
  onClose,
  onEdit,
  onDeleted,
}: {
  look: Look
  tagNames: string[]
  onClose: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  async function handleDelete() {
    if (!window.confirm('Delete this look?')) return
    await api.deleteLook(look.id)
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 overflow-y-auto">
        {look.photo_key && (
          <img
            src={`/api/photos/${look.photo_key}`}
            alt=""
            className="w-full object-contain"
            style={{ maxHeight: '70vh', background: 'var(--surface)' }}
          />
        )}
        <div className="p-4">
          {look.name && <p className="mb-2 text-lg font-medium">{look.name}</p>}
          {tagNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagNames.map((name) => (
                <span key={name} className="chip">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 p-4 pb-[env(safe-area-inset-bottom)]" style={{ borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn-ghost flex-1" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn-ghost flex-1" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn-danger flex-1" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
