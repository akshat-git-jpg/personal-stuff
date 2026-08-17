import { useState } from 'react'
import type { Look } from './types'

/** A photo-only tile — no name, no count. Tapping opens the full catalogue. */
function LookTile({
  look,
  photoKeys,
  onOpen,
}: {
  look: Look
  photoKeys: string[]
  onOpen: (look: Look) => void
}) {
  const [imgError, setImgError] = useState(false)
  const cover = photoKeys[0]
  const showPhoto = Boolean(cover) && !imgError

  return (
    <button type="button" className="relative block aspect-square overflow-hidden rounded-xl"
      onClick={() => onOpen(look)}
      aria-label={look.name ? `Open ${look.name}` : 'Open look'}
    >
      {showPhoto ? (
        <img
          src={`/api/photos/${cover}`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center text-xs"
          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
        >
          photo missing
        </span>
      )}

      {photoKeys.length > 1 && (
        <span
          className="absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs tabular-nums"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'var(--text)' }}
        >
          {photoKeys.length} photos
        </span>
      )}
    </button>
  )
}

/**
 * LooksTab — a plain tagged gallery. No link to clothes, no "I wore this"
 * button (the owner rejected both on 2026-08-17).
 */
export default function LooksTab({
  looks,
  photosByLook,
  hasAny,
  hasSelection,
  onOpen,
  onClearTags,
  onAddFirst,
}: {
  looks: Look[]
  /** look id → its photo keys, cover first. */
  photosByLook: Map<string, string[]>
  hasAny: boolean
  hasSelection: boolean
  onOpen: (look: Look) => void
  onClearTags: () => void
  onAddFirst: () => void
}) {
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p style={{ color: 'var(--muted)' }}>No looks yet.</p>
        <button type="button" className="btn-primary" onClick={onAddFirst}>
          Add your first look
        </button>
      </div>
    )
  }

  if (looks.length === 0 && hasSelection) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p style={{ color: 'var(--muted)' }}>No looks carry all of those tags.</p>
        <button type="button" className="btn-ghost" onClick={onClearTags}>
          Clear tags
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
      {looks.map((look) => (
        <LookTile
          key={look.id}
          look={look}
          photoKeys={photosByLook.get(look.id) ?? []}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
