#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { channelOf } from '../../../pipelines/video-registry/lib/registry.mjs'
import { profileFor } from '../../../config/profiles.mjs'
import { checkPool, readUsageSnapshot } from './lib/pool.mjs'
import { ensureWords, rangeForText } from './lib/timings.mjs'
import { sliceWav, probeDurationSec } from './lib/slice.mjs'
import { submitOne, waitForCompletion, downloadOne } from './lib/heygen.mjs'
import { ensureFolderChain, uploadFile, folderShareLink } from './lib/drive.mjs'

const REPO_ROOT = join(import.meta.dirname, '../../..')

const options = {
  'dry-run': { type: 'boolean' },
  'engine': { type: 'string' },
  'drive-account': { type: 'string', default: 'kushalbakliwal25@gmail.com' },
  'help': { type: 'boolean' }
}

const { values, positionals } = parseArgs({ args: process.argv.slice(2), options, strict: false })

if (values.help || positionals.length === 0) {
  console.log('Usage: pp-heygen-batch <video-key> [--dry-run] [--engine mlx|faster] [--drive-account <email>]')
  process.exit(0)
}

const videoKey = positionals[0]
const isDryRun = values['dry-run']
const whisperEngine = values['engine']
const driveAccount = values['drive-account']

const queuePath = join(REPO_ROOT, `pipelines/youtube/yt-script/videos/${videoKey}/heygen-selections.json`)
if (!existsSync(queuePath)) {
  console.error(`Error: Queue file not found at ${queuePath}`)
  process.exit(1)
}

const selections = JSON.parse(readFileSync(queuePath, 'utf8'))
const vreg = JSON.parse(readFileSync(join(REPO_ROOT, 'pipelines/video-registry/videos.json'), 'utf8'))
const channels = JSON.parse(readFileSync(join(REPO_ROOT, 'config/channels.json'), 'utf8'))
const heygenRegistry = JSON.parse(readFileSync(join(REPO_ROOT, 'pipelines/video/heygen/registry.json'), 'utf8'))

const channel = channelOf(videoKey, vreg)
const profile = profileFor(channel, channels)
const slug = profile.avatar_slug

const sectionDurations = new Map()
const uniqueSections = [...new Set(selections.map(s => s.section_id))]
for (const sec of uniqueSections) {
  const wav = join(REPO_ROOT, `pipelines/youtube/yt-script/videos/${videoKey}/audio/${sec}.wav`)
  if (!existsSync(wav)) continue
  sectionDurations.set(sec, probeDurationSec(wav))
}

const usage = readUsageSnapshot(execFileSync)
const poolResult = checkPool(selections, sectionDurations, usage)

if (!poolResult.ok) {
  console.error(`Error: ${poolResult.reason}`)
  process.exit(1)
}

if (isDryRun) {
  console.log('--- DRY RUN ---')
  console.log('Planned selections:')
  console.table(selections.map(s => ({
    id: s.id,
    section: s.section_id,
    engine: s.engine,
    duration_upper_bound_sec: sectionDurations.get(s.section_id) ?? 0
  })))
  console.log(`Pool Math: requested ~${poolResult.requestedIvSec}s, remain ${poolResult.poolRemain}s`)
  process.exit(0)
}

async function main() {
  const renderedFiles = []
  
  for (let i = 0; i < selections.length; i++) {
    const sel = selections[i]
    console.log(`\nProcessing ${sel.id} (${i+1}/${selections.length})...`)
    try {
      const words = ensureWords(videoKey, sel.section_id, { engine: whisperEngine })
      const range = rangeForText(sel.text, words.words)
      
      const sourceWav = join(REPO_ROOT, `pipelines/youtube/yt-script/videos/${videoKey}/audio/${sel.section_id}.wav`)
      const slicePath = join(process.env.HOME, `kb-scratch/video/heygen/pp-heygen-batch/${videoKey}/slices/${sel.id}.wav`)
      const renderPath = join(process.env.HOME, `kb-scratch/video/heygen/pp-heygen-batch/${videoKey}/renders/${videoKey}-${sel.id}.mp4`)
      
      console.log(`  Slicing ${range.start_sec.toFixed(3)}s to ${range.end_sec.toFixed(3)}s...`)
      sliceWav(sourceWav, range.start_sec, range.end_sec, slicePath)
      
      console.log(`  Submitting to HeyGen...`)
      const hwBin = join(REPO_ROOT, 'tooling/cli/heygen-web/heygen-web.mjs')
      const videoId = await submitOne({
        selection: sel,
        wavSlice: slicePath,
        slug,
        engineFlag: sel.engine,
        heygenWebBin: hwBin,
        registryJson: heygenRegistry,
        execFn: execFileSync
      })
      
      console.log(`  Waiting for completion (id: ${videoId})...`)
      await waitForCompletion(videoId, { heygenWebBin: hwBin, execFn: execFileSync })
      
      console.log(`  Downloading mp4...`)
      await downloadOne(videoId, renderPath, { heygenWebBin: hwBin, execFn: execFileSync })
      renderedFiles.push(renderPath)
      
      if (i < selections.length - 1) {
        const jitter = Math.floor(Math.random() * 20000) + 10000 // 10-30s
        console.log(`  Sleeping ${jitter/1000}s...`)
        await new Promise(r => setTimeout(r, jitter))
      }
    } catch (err) {
      console.error(`\nFailed on selection ${sel.id}:`, err.message)
      console.error(`Aborting batch. ${renderedFiles.length}/${selections.length} completed.`)
      process.exit(1)
    }
  }

  if (renderedFiles.length > 0) {
    console.log(`\nUploading to Drive...`)
    const timestamp = new Date().toISOString().replace(/T/, '-').replace(/:/g, '-').slice(0, 16)
    const folderChain = ['HeyGen batches', channel, videoKey, timestamp]
    const folderId = ensureFolderChain(folderChain, { account: driveAccount })
    
    for (const f of renderedFiles) {
      console.log(`  Uploading ${f}...`)
      uploadFile(f, folderId, { account: driveAccount })
    }
    
    const link = folderShareLink(folderId)
    console.log(`\nDone.`)
    console.log(link)
  } else {
    console.log('No selections processed.')
  }
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
