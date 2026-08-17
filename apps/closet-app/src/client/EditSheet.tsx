import { useState } from 'react'
import { api } from './api'
import PhotoPicker from './PhotoPicker'
import TagInput from './TagInput'
import type { Tag } from './types'

/**
 * EditSheet — one bottom sheet serving four cases: add-cloth, edit-cloth,
 * add-look, edit-look. `itemId` null means "add"; otherwise "edit".
 */
export default function EditSheet({
  mode,
  itemId,
  initialName,
  initialPhotoKey,
  initialTags,
  allTags,
  onClose,
  onSaved,
}: {
  mode: 'cloth' | 'look'
  itemId: string | null
  initialName: string | null
  initialPhotoKey: string | null
  initialTags: string[]
  allTags: Tag[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initialName ?? '')
  const [photoKey, setPhotoKey] = useState<string | null>(initialPhotoKey)
  const [tags, setTags] = useState<string[]>(initialTags)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = !saving && !photoBusy && (mode === 'cloth' ? name.trim().length > 0 : photoKey !== null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (mode === 'cloth') {
        const body = { name: name.trim(), tags, photo_key: photoKey }
        if (itemId) await api.updateCloth(itemId, body)
        else await api.createCloth(body)
      } else {
        if (!photoKey) return
        const body = { name: name.trim() || null, tags, photo_key: photoKey }
        if (itemId) await api.updateLook(itemId, body)
        else await api.createLook(body)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!itemId) return
    if (!window.confirm(`Delete this ${mode}?`)) return
    setSaving(true)
    try {
      if (mode === 'cloth') await api.deleteCloth(itemId)
      else await api.deleteLook(itemId)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom)] transition-transform duration-150"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold">{itemId ? `Edit ${mode}` : `Add ${mode}`}</h2>

        <div className="mb-4">
          <PhotoPicker photoKey={photoKey} onPhotoKey={setPhotoKey} onBusyChange={setPhotoBusy} onError={setError} />
        </div>

        <input type="text" className="field mb-4"
          placeholder={mode === 'cloth' ? 'Name' : 'Name (optional)'}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <TagInput tags={tags} allTags={allTags} onChange={setTags} />

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary flex-1" onClick={handleSave} disabled={!canSave}>
            Save
          </button>
        </div>

        {itemId && (
          <button type="button" className="btn-danger mt-2 w-full" onClick={handleDelete} disabled={saving}>
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
