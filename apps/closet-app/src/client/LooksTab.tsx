import { useState } from 'react'
import type { Look } from './types'

/** A photo-only tile — no name, no count. Tapping opens the full viewer. */
function LookTile({ look, onOpen }: { look: Look; onOpen: (look: Look) => void }) {
  const [imgError, setImgError] = useState(false)
  const showPhoto = Boolean(look.photo_key) && !imgError

  return (
    <button
      type="button" className="block aspect-square overflow-hidden rounded-xl"
      onClick={() => onOpen(look)}
      aria-label={look.name ? `Open ${look.name}` : 'Open look'}
    >
      {showPhoto ? (
        <img
          src={`/api/photos/${look.photo_key}`}
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
    </button>
  )
}

/**
 * LooksTab — a plain tagged gallery. No link to clothes, no "I wore this"
 * button (the owner rejected both on 2026-08-17).
 */
export default function LooksTab({
  looks,
  hasAny,
  hasSelection,
  onOpen,
  onClearTags,
  onAddFirst,
}: {
  looks: Look[]
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
        <LookTile key={look.id} look={look} onOpen={onOpen} />
      ))}
    </div>
  )
}
