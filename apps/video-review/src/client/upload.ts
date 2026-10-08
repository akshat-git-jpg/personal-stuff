// Reads a file's facts in the browser and sends it to R2 in parts, skipping parts the server already has.
import { api } from './api'

export type Probe = { size: number; duration: number; width: number; height: number; type: string }

export function probe(file: File): Promise<Probe> {
  const type = file.type || (/\.mp4$/i.test(file.name) ? 'video/mp4' : '')
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    const done = (d: number, w: number, h: number) => {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve({ size: file.size, duration: d, width: w, height: h, type })
    }
    const timer = setTimeout(() => done(NaN, 0, 0), 15000)
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => done(v.duration, v.videoWidth, v.videoHeight)
    v.onerror = () => done(NaN, 0, 0)
    v.src = url
  })
}

export type Progress = { sent: number; total: number }

export async function sendParts(
  token: string,
  vid: string,
  file: File,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<void> {
  const status = await api.uploadStatus(token, vid)
  if (status.size !== file.size) throw new Error('This is not the same file. Pick the file you started with.')
  const size = status.part_size
  const count = Math.ceil(file.size / size)
  const have = new Set(status.parts)
  const partBytes = (n: number) => (n < count ? size : file.size - size * (count - 1))
  let sent = [...have].reduce((s, n) => s + partBytes(n), 0)
  onProgress({ sent, total: file.size })

  const todo = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !have.has(n))
  const worker = async () => {
    for (let n = todo.shift(); n !== undefined; n = todo.shift()) {
      const blob = file.slice((n - 1) * size, (n - 1) * size + partBytes(n))
      for (let attempt = 1; ; attempt++) {
        if (signal.aborted) throw new DOMException('stopped', 'AbortError')
        try {
          await api.putPart(token, vid, n, blob, signal)
          break
        } catch (e) {
          if (signal.aborted || attempt >= 3) throw e
          await new Promise((r) => setTimeout(r, 1500 * attempt))
        }
      }
      sent += blob.size
      onProgress({ sent, total: file.size })
    }
  }
  await Promise.all([worker(), worker()])
  await api.completeUpload(token, vid)
}
