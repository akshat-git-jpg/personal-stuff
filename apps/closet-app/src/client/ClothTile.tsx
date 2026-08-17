import { useState } from 'react'
import type { Cloth } from './types'

/**
 * ClothTile — three separate hit targets. A long-press menu would be
 * undiscoverable, so the photo, the name and the wash control are each their
 * own button (see plan 204, Step 6).
 */
export default function ClothTile({
  cloth,
  wornLabel,
  onWear,
  onEditName,
  onWash,
}: {
  cloth: Cloth
  wornLabel: string
  onWear: (cloth: Cloth) => void
  onEditName: (cloth: Cloth) => void
  onWash: (cloth: Cloth) => void
}) {
  const [imgError, setImgError] = useState(false)
  const showPhoto = Boolean(cloth.photo_key) && !imgError

  function washClick() {
    if (window.confirm(`Washed ${cloth.name}? The count goes back to 0.`)) {
      onWash(cloth)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: 'var(--surface)' }}>
      <button
        type="button" className="block aspect-square w-full"
        onClick={() => onWear(cloth)}
        aria-label={`Add a wear to ${cloth.name}`}
      >
        {showPhoto ? (
          <img
            src={`/api/photos/${cloth.photo_key}`}
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
      </button>

      <div className="p-3">
        <button
          type="button" className="block w-full text-left"
          onClick={() => onEditName(cloth)}
          aria-label={`Edit ${cloth.name}`}
        >
          <p className="truncate text-sm font-medium">{cloth.name}</p>
          <p className="text-3xl font-semibold tabular-nums">{cloth.wears}</p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {wornLabel}
          </p>
        </button>

        <button
          type="button" className="btn-ghost mt-2 w-full text-xs"
          onClick={washClick}
          aria-label={`Mark ${cloth.name} as washed`}
        >
          ↺ washed
        </button>
      </div>
    </div>
  )
}
