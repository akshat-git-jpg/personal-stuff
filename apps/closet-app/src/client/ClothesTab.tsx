import { useState } from 'react'
import ClothTile from './ClothTile'
import { lastWornLabel } from './filter'
import type { Cloth } from './types'

/**
 * ClothesTab — renders the grid from the already-filtered list its parent
 * (Closet) passes. Owns no state of its own beyond the empty-state copy.
 */
export default function ClothesTab({
  clothes,
  photosByCloth,
  hasAny,
  hasSelection,
  onOpen,
  onWear,
  onWash,
  onClearTags,
  onAddFirst,
}: {
  clothes: Cloth[]
  /** cloth id → its photo keys, cover first. */
  photosByCloth: Map<string, string[]>
  hasAny: boolean
  hasSelection: boolean
  onOpen: (cloth: Cloth) => void
  onWear: (cloth: Cloth) => void
  onWash: (cloth: Cloth) => void
  onClearTags: () => void
  onAddFirst: () => void
}) {
  // Date.now() is impure during render (react-hooks/purity); a lazy initial
  // state pins it once per mount, which is plenty stable for a "days ago" label.
  const [now] = useState(() => Date.now())

  if (!hasAny) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p style={{ color: 'var(--muted)' }}>No clothes yet.</p>
        <button type="button" className="btn-primary" onClick={onAddFirst}>
          Add your first cloth
        </button>
      </div>
    )
  }

  if (clothes.length === 0 && hasSelection) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p style={{ color: 'var(--muted)' }}>Nothing carries all of those tags.</p>
        <button type="button" className="btn-ghost" onClick={onClearTags}>
          Clear tags
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
      {clothes.map((cloth) => (
        <ClothTile
          key={cloth.id}
          cloth={cloth}
          photoKeys={photosByCloth.get(cloth.id) ?? []}
          wornLabel={lastWornLabel(cloth.last_worn_at, now)}
          onOpen={onOpen}
          onWear={onWear}
          onWash={onWash}
        />
      ))}
    </div>
  )
}
