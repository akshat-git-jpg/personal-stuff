import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { downscale } from './photo'

const MAX_PHOTOS = 12

/**
 * PhotoStrip — the catalogue editor inside EditSheet.
 *
 * Owns the item's ORDERED list of r2 keys. The first key is the cover, so
 * "make cover" is just "move to index 0" — there is no separate cover flag to
 * fall out of sync with the ordering (mirrors the `photos.position` column).
 *
 * Uploads happen immediately on pick, before Save. That means an abandoned
 * sheet can leave an unreferenced object in the bucket; the alternative
 * (holding blobs in memory until Save) loses the photo if the tab dies, which
 * is the worse trade for a phone. Orphans cost fractions of a cent.
 */
export default function PhotoStrip({
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

  const full = keys.length >= MAX_PHOTOS

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

  function makeCover(key: string) {
    onChange([key, ...keys.filter((k) => k !== key)])
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {keys.map((key, i) => (
          <div key={key} className="relative w-24 shrink-0">
            <img
              src={`/api/photos/${key}`}
              alt=""
              className="aspect-square w-full rounded-xl object-cover"
              style={{ background: 'var(--surface-2)' }}
            />

            <button
              type="button"
              className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full p-0 text-xs"
              style={{ background: 'var(--danger)', color: '#fff' }}
              onClick={() => remove(key)}
              aria-label={`Remove photo ${i + 1}`}
            >
              ×
            </button>

            {i === 0 ? (
              <span
                className="mt-1 block rounded-md py-0.5 text-center text-[10px]"
                style={{ background: 'var(--accent)', color: '#06122b' }}
              >
                cover
              </span>
            ) : (
              <button
                type="button"
                // px-1 + nowrap: btn-ghost's default px-4 squeezed the label onto
                // two lines, which made non-cover thumbs taller than the cover.
                className="btn-ghost mt-1 w-full rounded-md px-1 py-0.5 text-[10px] whitespace-nowrap"
                style={{ minHeight: 0 }}
                onClick={() => makeCover(key)}
                aria-label={`Make photo ${i + 1} the cover`}
              >
                make cover
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          className="btn-ghost relative grid aspect-square w-24 shrink-0 place-items-center overflow-hidden rounded-xl p-0 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={busy || full}
          aria-label="Add a photo"
        >
          {pending ? (
            <img src={pending} alt="" className="h-full w-full object-cover opacity-40" />
          ) : (
            <span style={{ color: 'var(--muted)' }}>{full ? `max ${MAX_PHOTOS}` : '+ photo'}</span>
          )}
          {busy && (
            <span
              className="absolute inset-0 grid place-items-center text-xs"
              style={{ background: 'rgba(0,0,0,0.55)' }}
            >
              Uploading…
            </span>
          )}
        </button>
      </div>

      {keys.length > 1 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          The cover photo is what the grid shows.
        </p>
      )}

      <input
        type="file"
        className="hidden"
        accept="image/*"
        multiple
        ref={inputRef}
        onChange={onPick}
      />
    </div>
  )
}
