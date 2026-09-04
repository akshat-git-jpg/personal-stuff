import { setTimeout as sleep } from 'node:timers/promises'
import { execFileSync } from 'node:child_process'

export function resolveSlugToVerb(slug, registryJson) {
  const entry = registryJson[slug]
  if (!entry) throw new Error(`heygen: unknown slug ${slug}`)
  if (entry.template_id) return { verb: 'generate-from-template', flag: '--template', value: slug }
  if (entry.avatar_id) return { verb: 'generate-from-audio', flag: '--avatar', value: slug }
  throw new Error(`heygen: registry entry for ${slug} has neither template_id nor avatar_id`)
}

export async function submitOne({ selection, wavSlice, slug, engineFlag, heygenWebBin, execFn, registryJson }) {
  const { verb, flag, value } = resolveSlugToVerb(slug, registryJson)
  const args = [heygenWebBin, verb, flag, value, '--audio', wavSlice, '--engine', engineFlag, '--title', selection.id]
  const execute = execFn ?? execFileSync
  const stdout = execute('node', args)
  const parsed = JSON.parse(stdout)
  if (!parsed.video_id) throw new Error(`heygen: no video_id in response`)
  return parsed.video_id
}

export async function waitForCompletion(videoId, { heygenWebBin, execFn, pollSec = 15, maxSec = 1800 }) {
  const t0 = Date.now()
  const execute = execFn ?? execFileSync
  while (true) {
    const stdout = execute('node', [heygenWebBin, 'status', videoId])
    const status = JSON.parse(stdout)
    if (status.progress >= 100 || status.status === 'COMPLETED' || status.status === 'ready') return status
    if (status.status === 'FAILED' || status.status === 'error') throw new Error(`heygen: submit ${videoId} FAILED`)
    if ((Date.now() - t0) / 1000 > maxSec) throw new Error(`heygen: timeout waiting on ${videoId}`)
    await sleep(pollSec * 1000)
  }
}

export async function downloadOne(videoId, outPath, { heygenWebBin, execFn }) {
  const execute = execFn ?? execFileSync
  execute('node', [heygenWebBin, 'download', videoId, '--res', '1080p', '--out', outPath])
}
