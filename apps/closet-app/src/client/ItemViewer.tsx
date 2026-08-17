import { useRef, useState } from 'react'
import type { ViewingItem } from './types'

/**
 * ItemViewer — the full-screen catalogue view, IDENTICAL for a cloth and a
 * look (owner decision, 2026-08-17: "make behaviour same as looks").
 *
 * Swipe horizontally through the item's photos. Swiping uses CSS scroll-snap
 * rather than a gesture library: the browser already does momentum, rubber-band
 * and snapping natively, and a library would be ~30 KB for worse behaviour.
 *
 * There is deliberately NO wear button here. Logging a wear is a tile action
 * (ClothTile's "+ wear"), so opening the catalogue can never change a count.
 */
export default function ItemViewer({
  item,
  title,
  photoKeys,
  tagNames,
  onClose,
  onEdit,
  onDelete,
}: {
  item: ViewingItem
  /** Shown above the tags. A look may legitimately have no name. */
  title: string | null
  photoKeys: string[]
  tagNames: string[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [active, setActive] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  /**
   * Derive the active page from scroll offset. Reading it off the DOM on scroll
   * keeps the dots honest no matter how the user moved (flick, drag, or a dot
   * tap that animates) — tracking it in state from tap handlers alone would
   * drift the moment they swipe instead.
   */
  function onScroll() {
    const el = stripRef.current
    if (!el || el.clientWidth === 0) return
    const page = Math.round(el.scrollLeft / el.clientWidth)
    setActive(Math.max(0, Math.min(photoKeys.length - 1, page)))
  }

  function goTo(i: number) {
    const el = stripRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  function handleDelete() {
    const what = item.type === 'cloth' ? title || 'this cloth' : 'this look'
    if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return
    onDelete()
  }

  // z-30 keeps this BELOW EditSheet (z-40): tapping Edit leaves the catalogue
  // open underneath, so saving returns you straight to it showing the new
  // photos, instead of dumping you back on the grid.
  return (
    <div className="fixed inset-0 z-30 flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 overflow-y-auto">
        {photoKeys.length > 0 ? (
          <div
            ref={stripRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory overflow-x-auto"
            style={{ background: 'var(--surface)', scrollbarWidth: 'none' }}
            data-testid="photo-strip"
          >
            {photoKeys.map((key) => (
              <img
                key={key}
                src={`/api/photos/${key}`}
                alt=""
                className="w-full shrink-0 snap-center object-contain"
                style={{ height: '70vh' }}
              />
            ))}
          </div>
        ) : (
          <div
            className="grid w-full place-items-center text-sm"
            style={{ height: '70vh', background: 'var(--surface-2)', color: 'var(--muted)' }}
          >
            no photos yet
          </div>
        )}

        {/* Dots: only meaningful once there is more than one photo. */}
        {photoKeys.length > 1 && (
          <div className="flex justify-center gap-2 py-3">
            {photoKeys.map((key, i) => (
              <button
                key={key}
                type="button"
                className="h-2 w-2 rounded-full p-0"
                style={{ background: i === active ? 'var(--accent)' : 'var(--border)' }}
                onClick={() => goTo(i)}
                aria-label={`Photo ${i + 1} of ${photoKeys.length}`}
                aria-current={i === active}
              />
            ))}
          </div>
        )}

        <div className="p-4">
          {title && <p className="mb-2 text-lg font-medium">{title}</p>}
          {photoKeys.length > 1 && (
            <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
              {active + 1} of {photoKeys.length} photos
            </p>
          )}
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

      <div
        className="flex gap-2 p-4 pb-[env(safe-area-inset-bottom)]"
        style={{ borderTop: '1px solid var(--border)' }}
      >
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
