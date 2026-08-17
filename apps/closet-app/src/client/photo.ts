/**
 * photo.ts — shrink a camera photo on the phone before upload.
 *
 * The grid never shows more than a small tile, and the Worker caps uploads at
 * 400 KB, so a full-resolution capture is pure waste on mobile data. Longest
 * edge is clamped, then JPEG quality steps down until the blob fits — a busy
 * photo degrades instead of being rejected.
 */

const MAX_EDGE = 640
const MAX_BYTES = 380 * 1024 // under the Worker's 400 KB cap, with headroom
const QUALITIES = [0.82, 0.7, 0.6, 0.5, 0.4]

/** Target pixel box for an image, never upscaling. */
export function fitBox(width: number, height: number, maxEdge: number = MAX_EDGE): { w: number; h: number } {
  const longest = Math.max(width, height)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}

/** Re-encode `file` as a small JPEG blob. Throws with a user-showable message. */
export async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { w, h } = fitBox(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('This browser could not resize the photo')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let last: Blob | null = null
  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) continue
    last = blob
    if (blob.size <= MAX_BYTES) return blob
  }
  // Lowest quality still over the cap: send it and let the Worker's 413 surface
  // in the sheet, rather than failing silently on the client.
  if (last) return last
  throw new Error('Could not save the photo')
}
