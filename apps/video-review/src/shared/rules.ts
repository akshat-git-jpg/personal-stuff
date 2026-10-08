// Upload limits and cleanup rules, shared by the page (pre-check) and the Worker (enforcement).

export const MB = 1024 * 1024
export const GB = 1024 * MB

export const MAX_SHORT_SIDE = 720 // 720p landscape or portrait
export const MB_PER_MINUTE = 12 // 720p at 1.5 Mbps is about 11 MB a minute
export const MAX_FILE_BYTES = 400 * MB
export const STORAGE_STOP_BYTES = 9 * GB // stay under R2's free 10 GB
export const KEEP_NEWEST_FILES = 2
export const FINAL_FILE_DAYS = 30
export const STALE_UPLOAD_HOURS = 48
export const DEFAULT_PART_MB = 20 // under the free Worker's 100 MB request cap

export type FileFacts = { size: number; duration: number; width: number; height: number; type: string }

/** Largest file allowed for a video of this length. */
export function maxBytesFor(durationSeconds: number): number {
  const byLength = Math.ceil((Math.max(durationSeconds, 1) / 60) * MB_PER_MINUTE * MB)
  return Math.min(byLength, MAX_FILE_BYTES)
}

/** Reasons the file is refused, in plain words. Empty means OK. */
export function checkFile(f: FileFacts): string[] {
  const out: string[] = []
  if (f.type !== 'video/mp4') out.push('The file must be an MP4.')
  if (!(f.duration > 0) || !(f.width > 0) || !(f.height > 0)) {
    out.push('The browser cannot read this video. Export it again as MP4 (H.264).')
    return out
  }
  if (Math.min(f.width, f.height) > MAX_SHORT_SIDE) {
    out.push(`The video is ${f.width}x${f.height}. Export it at 720p (1280x720) or smaller.`)
  }
  const max = maxBytesFor(f.duration)
  if (f.size > max) {
    out.push(
      `The file is ${fmtBytes(f.size)}. For a ${fmtTime(f.duration)} video the limit is ${fmtBytes(max)}. Export at 1.5 Mbps.`,
    )
  }
  return out
}

export type VersionFile = { id: string; created_at: number; has_file: boolean }

/** Version ids whose files go once the newest KEEP_NEWEST_FILES are kept. The Final file is never picked. */
export function filesToDrop(versions: VersionFile[], finalId: string | null): string[] {
  if (finalId) return versions.filter((v) => v.has_file && v.id !== finalId).map((v) => v.id)
  return versions
    .filter((v) => v.has_file)
    .sort((a, b) => b.created_at - a.created_at)
    .slice(KEEP_NEWEST_FILES)
    .map((v) => v.id)
}

export function fmtBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`
  if (n < MB) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${Math.round(n / MB)} MB`
}

export function fmtTime(seconds: number, tenths = false): string {
  const s = Math.max(0, seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const secStr = tenths ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${secStr}` : `${m}:${secStr}`
}
