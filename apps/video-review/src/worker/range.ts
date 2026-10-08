// Parse a single-range `Range: bytes=...` header against a known size. Null = serve the whole file.
export type ByteRange = { offset: number; length: number }

export function parseRange(header: string | undefined, size: number): ByteRange | null | 'invalid' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid'
  if (m[1] === '') {
    const suffix = Math.min(Number(m[2]), size)
    if (suffix === 0) return 'invalid'
    return { offset: size - suffix, length: suffix }
  }
  const start = Number(m[1])
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (start >= size || end < start) return 'invalid'
  return { offset: start, length: end - start + 1 }
}
