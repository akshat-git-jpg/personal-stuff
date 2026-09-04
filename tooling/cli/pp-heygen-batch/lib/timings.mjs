import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

export function ensureWords(videoKey, sectionId, opts = {}) {
  const wavPath = opts.wavPath ?? `pipelines/youtube/yt-script/videos/${videoKey}/audio/${sectionId}.wav`
  const cachePath = opts.cachePath ?? `pipelines/youtube/yt-script/videos/${videoKey}/audio/${sectionId}.words.json`
  const pythonBin = opts.pythonBin ?? 'python3'

  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf8'))
  }

  const args = ['tooling/cli/pp-heygen-batch/lib/whisper.py', wavPath, cachePath]
  if (opts.engine) {
    args.push('--engine', opts.engine)
  }

  const execFn = opts.execFileSync ?? execFileSync
  execFn(pythonBin, args, { stdio: 'inherit' })
  return JSON.parse(readFileSync(cachePath, 'utf8'))
}

function normalize(s) {
  return s.toLowerCase().replace(/[^\w\s']/g, '').split(/\s+/).filter(Boolean)
}

export function rangeForText(text, words) {
  const target = normalize(text)
  if (target.length === 0) throw new Error('rangeForText: empty text')
  const transcriptWords = words.map((w) => normalize(w.word)[0] ?? '').filter(Boolean)
  
  const indexMap = []
  words.forEach((w, i) => {
    const n = normalize(w.word)[0]
    if (n) indexMap.push(i)
  })
  
  const MAX_SKIP = 2
  let best = { hits: 0, startIdx: -1, endIdx: -1 }
  for (let i = 0; i <= transcriptWords.length - target.length; i++) {
    let hits = 0
    let ti = i
    let skips = 0
    let firstMatch = -1
    for (let ki = 0; ki < target.length && ti < transcriptWords.length; ) {
      if (transcriptWords[ti] === target[ki]) { 
        if (firstMatch === -1) firstMatch = ti;
        hits++; ti++; ki++ 
      }
      else if (skips < MAX_SKIP) { skips++; ti++ }
      else break
    }
    if (hits > best.hits) best = { hits, startIdx: firstMatch !== -1 ? firstMatch : i, endIdx: ti - 1 }
    if (best.hits === target.length) break
  }
  if (best.hits < Math.floor(target.length * 0.8)) {
    throw new Error(`rangeForText: text not found in section (matched ${best.hits}/${target.length} words)`)
  }
  const startWord = words[indexMap[best.startIdx]]
  const endWord = words[indexMap[best.endIdx]]
  return { start_sec: startWord.start, end_sec: endWord.end, matched_words: best.hits }
}
