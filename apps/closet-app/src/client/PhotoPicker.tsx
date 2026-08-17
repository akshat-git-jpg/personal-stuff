import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { downscale } from './photo'

/**
 * PhotoPicker — the camera path. Tapping the square opens the phone's camera
 * (or file picker) directly via `capture="environment"`; the picked file is
 * downscaled client-side, uploaded, and the resulting key handed to the parent.
 */
export default function PhotoPicker({
  photoKey,
  onPhotoKey,
  onBusyChange,
  onError,
}: {
  photoKey: string | null
  onPhotoKey: (key: string) => void
  onBusyChange: (busy: boolean) => void
  onError: (message: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })

    setBusy(true)
    onBusyChange(true)
    try {
      const blob = await downscale(file)
      const { key } = await api.uploadPhoto(blob)
      onPhotoKey(key)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not upload the photo')
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  const src = preview ?? (photoKey ? `/api/photos/${photoKey}` : null)

  return (
    <div>
      <button type="button" className="btn-ghost relative flex aspect-square w-28 items-center justify-center overflow-hidden rounded-xl p-0"
        onClick={() => inputRef.current?.click()}
        aria-label="Choose a photo"
        disabled={busy}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            Add photo
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center text-xs" style={{ background: 'rgba(0,0,0,0.55)' }}>
            Uploading…
          </span>
        )}
      </button>
      <input type="file" className="hidden"
        accept="image/*"
        capture="environment"
        ref={inputRef}
        onChange={onPick}
      />
    </div>
  )
}
