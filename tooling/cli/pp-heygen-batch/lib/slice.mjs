import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export function sliceWav(sourceWav, startSec, endSec, outPath, opts = {}) {
  const duration = endSec - startSec
  if (duration <= 0) throw new Error(`sliceWav: non-positive duration ${duration}`)
  mkdirSync(dirname(outPath), { recursive: true })
  const args = [
    '-y',
    '-loglevel', 'error',
    '-i', sourceWav,
    '-ss', String(startSec.toFixed(3)),
    '-t', String(duration.toFixed(3)),
    '-c', 'copy',
    outPath,
  ]
  const bin = opts.ffmpegBin ?? 'ffmpeg'
  const execFn = opts.execFileSync ?? execFileSync
  execFn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
}

export function probeDurationSec(wav, opts = {}) {
  const bin = opts.ffprobeBin ?? 'ffprobe'
  const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav]
  const execFn = opts.execFileSync ?? execFileSync
  const out = execFn(bin, args, { encoding: 'utf8' })
  return parseFloat(out.trim())
}
