import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from './api'
import { downscale } from './photo'

const MAX_PHOTOS = 12

/**
 * PhotoGrid — the catalogue editor inside EditSheet.
 *
 * Drag a thumbnail to reorder, the way photo managers work everywhere else
 * (Airbnb listings, Shopify products, iOS albums). The FIRST tile is the cover
 * and is badged as such, so "make this the cover" is just "drag it to the
 * front" — there is no separate cover flag to fall out of sync with the order
 * (mirrors the `photos.position` column).
 *
 * Uploads happen immediately on pick, before Save. An abandoned sheet can
 * therefore leak an unreferenced object; the alternative — holding blobs until
 * Save — loses the photo if the tab dies, which is the worse trade on a phone.
 */
function Thumb({
  id,
  index,
  onRemove,
}: {
  id: string
  index: number
  onRemove: (key: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      {/*
        The image itself is the drag handle: a separate grip would be a second
        tiny target on an already small tile. `touch-none` is required — without
        it the browser claims the gesture for scrolling and the drag never starts.
      */}
      <div
        {...attributes}
        {...listeners}
        className="aspect-square w-full cursor-grab touch-none overflow-hidden rounded-xl active:cursor-grabbing"
        style={{
          background: 'var(--surface-2)',
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : undefined,
        }}
        aria-label={`Photo ${index + 1}. Press and hold, then drag to reorder.`}
      >
        <img src={`/api/photos/${id}`} alt="" className="pointer-events-none h-full w-full object-cover" />
      </div>

      {index === 0 && (
        <span
          className="pointer-events-none absolute bottom-1 left-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: 'var(--accent)', color: '#06122b' }}
        >
          Cover
        </span>
      )}

      <button
        type="button"
        className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full p-0 text-xs leading-none"
        style={{ background: 'var(--danger)', color: '#fff', minHeight: 0 }}
        onClick={() => onRemove(id)}
        aria-label={`Remove photo ${index + 1}`}
      >
        ×
      </button>
    </div>
  )
}

export default function PhotoGrid({
  keys,
  onChange,
  onBusyChange,
  onError,
}: {
  keys: string[]
  onChange: (keys: string[]) => void
  onBusyChange: (busy: boolean) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending)
    }
  }, [pending])

  const sensors = useSensors(
    // A plain tap must still hit the × button, so a drag only begins after the
    // pointer travels 8px (mouse) or the finger rests 180ms (touch) — the same
    // press-and-hold gesture native photo apps use.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const full = keys.length >= MAX_PHOTOS

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = keys.indexOf(String(active.id))
    const to = keys.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    onChange(arrayMove(keys, from, to))
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    const room = MAX_PHOTOS - keys.length
    if (room <= 0) {
      onError(`A single item holds at most ${MAX_PHOTOS} photos`)
      return
    }
    const batch = files.slice(0, room)
    if (files.length > room) onError(`Only ${room} more photo(s) fit — the rest were skipped`)

    const preview = URL.createObjectURL(batch[0])
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return preview
    })

    setBusy(true)
    onBusyChange(true)
    const added: string[] = []
    try {
      // Sequential, not Promise.all: a phone on mobile data uploading six
      // full-size captures at once is how you get timeouts and a dead sheet.
      for (const file of batch) {
        const blob = await downscale(file)
        const { key } = await api.uploadPhoto(blob)
        added.push(key)
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not upload the photo')
    } finally {
      // Keep whatever DID upload — losing three good uploads because the
      // fourth failed would make the user retake all of them.
      if (added.length > 0) onChange([...keys, ...added])
      setPending((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setBusy(false)
      onBusyChange(false)
    }
  }

  function remove(key: string) {
    onChange(keys.filter((k) => k !== key))
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={keys} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2" data-testid="photo-grid">
            {keys.map((key, i) => (
              <Thumb key={key} id={key} index={i} onRemove={remove} />
            ))}

            <button
              type="button"
              className="btn-ghost relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl p-0 text-xs"
              style={{ minHeight: 0 }}
              onClick={() => inputRef.current?.click()}
              disabled={busy || full}
              aria-label="Add a photo"
            >
              {pending ? (
                <img src={pending} alt="" className="h-full w-full object-cover opacity-40" />
              ) : (
                <span className="leading-tight" style={{ color: 'var(--muted)' }}>
                  {full ? `max ${MAX_PHOTOS}` : '+'}
                </span>
              )}
              {busy && (
                <span
                  className="absolute inset-0 grid place-items-center text-[10px]"
                  style={{ background: 'rgba(0,0,0,0.55)' }}
                >
                  Uploading…
                </span>
              )}
            </button>
          </div>
        </SortableContext>
      </DndContext>

      <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
        {keys.length > 1
          ? 'Hold and drag to reorder. The first photo is the cover.'
          : 'The first photo is the cover — it is what the grid shows.'}
      </p>

      <input type="file" className="hidden" accept="image/*" multiple ref={inputRef} onChange={onPick} />
    </div>
  )
}
