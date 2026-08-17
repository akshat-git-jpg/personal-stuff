import { useState } from 'react'
import type { Cloth } from './types'

/**
 * ClothTile.
 *
 * Changed 2026-08-17: tapping the photo used to log a wear. Now it opens the
 * garment's catalogue, exactly like a look, and logging a wear has its own
 * labelled "+ wear" button (owner decision). Two reasons this is better:
 * a stray tap on the picture no longer changes a count, and the daily action
 * is now named on screen instead of being an invisible affordance.
 */
export default function ClothTile({
  cloth,
  photoKeys,
  wornLabel,
  onOpen,
  onWear,
  onWash,
}: {
  cloth: Cloth
  /** Cover first. Empty means no photos yet. */
  photoKeys: string[]
  wornLabel: string
  onOpen: (cloth: Cloth) => void
  onWear: (cloth: Cloth) => void
  onWash: (cloth: Cloth) => void
}) {
  const [imgError, setImgError] = useState(false)
  const cover = photoKeys[0]
  const showPhoto = Boolean(cover) && !imgError

  function washClick() {
    if (window.confirm(`Washed ${cloth.name}? The count goes back to 0.`)) {
      onWash(cloth)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: 'var(--surface)' }}>
      <button
        type="button"
        className="relative block aspect-square w-full"
        onClick={() => onOpen(cloth)}
        aria-label={`Open ${cloth.name}`}
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
            className="grid h-full w-full place-items-center text-4xl"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
          >
            {cloth.name.charAt(0).toUpperCase()}
          </span>
        )}

        {/* Only worth the pixels once there is more than one photo to find. */}
        {photoKeys.length > 1 && (
          <span
            className="absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-xs tabular-nums"
            style={{ background: 'rgba(0,0,0,0.65)', color: 'var(--text)' }}
          >
            {photoKeys.length} photos
          </span>
        )}
      </button>

      <div className="p-3">
        <p className="truncate text-sm font-medium">{cloth.name}</p>
        <p className="text-3xl font-semibold tabular-nums">{cloth.wears}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {wornLabel}
        </p>

        <button
          type="button"
          className="btn-primary mt-3 w-full text-sm"
          onClick={() => onWear(cloth)}
          aria-label={`Add a wear to ${cloth.name}`}
        >
          + wear
        </button>

        <button
          type="button"
          className="btn-ghost mt-2 w-full text-xs"
          onClick={washClick}
          aria-label={`Mark ${cloth.name} as washed`}
        >
          ↺ washed
        </button>
      </div>
    </div>
  )
}
