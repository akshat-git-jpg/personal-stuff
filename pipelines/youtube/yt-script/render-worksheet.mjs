#!/usr/bin/env node
// Render a script-plan.md into script-worksheet.md — the WRITE artifact the remote
// tutorial maker fills in. SCRIPT ONLY: the spoken copy that is already final,
// plus an empty slot per beat he has to write. No SHOW, no EDIT, no rules boxes,
// no reference drafts and no fact packs — all of that is in outline.pdf, which he
// keeps open beside this file.
//
// The reference/facts blocks were built and then removed on owner instruction
// (2026-08-18): reprinting the outline's draft here made it read as finished copy
// he could paste, which defeats the point of asking him to write from screen time.
//
//   node render-worksheet.mjs <slug>          # videos/<slug>/script-plan.md -> script-worksheet.md
//   node render-worksheet.mjs path/to/script-plan.md
//   node render-worksheet.mjs <slug> --force  # overwrite an existing worksheet
//
// Why a separate parser rather than importing render-outline.mjs's: same reason
// render-script.mjs has its own — that one builds HTML and joins blockquote lines
// with spaces (splitParas), which destroys the byte-identical copy this file
// depends on. Pre-filled spoken copy here is COPIED, never re-flowed: a retyped
// intro can drop a word and that word goes to camera.
//
// Finished-copy rule is POSITIONAL, never matched on heading wording (the three
// real outlines say HONEST VERDICT / HONEST VERDICT & CONCLUSION / CONCLUSION):
// the part containing the word BODY holds the drafts; every part before and after
// it is finished copy. A body SAY lane noted `— final` is finished copy too.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const LANE_RE = /^\*\*(SAY|SHOW|EDIT|FACTS)\*\*(?:\s*[—-]\s*(.*))?$/i

// Strip the blockquote marker, keeping everything after ONE optional space so a
// continuation line's own indentation survives.
const unquote = (l) => l.replace(/^> ?/, '')

// Kept as a named constant on its own line so plan 207's mutation gate has a
// single unambiguous target. Setting it to ' ' collapses the copied lines and
// breaks byte-identity — which is exactly the defect the gate must catch.
// Do not inline it back into requote().
const QUOTE_JOIN = '\n'

// Re-emit raw quote lines. A bare `>` separator must stay a bare `>`.
function requote(raw) {
  return raw.map((l) => (l ? '> ' + l : '>')).join(QUOTE_JOIN)
}

export function parse(md) {
  const lines = md.split(/\r?\n/)
  const blocks = []
  let i = 0

  const flushQuote = () => {
    const quoted = []
    while (i < lines.length && /^>/.test(lines[i])) {
      quoted.push(unquote(lines[i]))
      i++
    }
    return quoted
  }

  while (i < lines.length) {
    const line = lines[i]

    if (/^#\s+/.test(line)) {
      blocks.push({ t: 'title', text: line.replace(/^#\s+/, '').trim() })
      i++
      continue
    }
    if (/^##\s+(?!#)/.test(line)) {
      blocks.push({ t: 'part', text: line.replace(/^##\s+/, '').trim() })
      i++
      continue
    }
    if (/^###\s+(?!#)/.test(line)) {
      blocks.push({
        t: 'section',
        text: line.replace(/^###\s+/, '').replace(/^SECTION:\s*/i, '').trim(),
      })
      i++
      continue
    }
    if (/^####\s+/.test(line)) {
      blocks.push({ t: 'beat', text: line.replace(/^####\s+/, '').trim() })
      i++
      continue
    }

    if (/^>/.test(line)) {
      const raw = flushQuote()
      const head = raw[0] ?? ''
      if (/^\*\*RULES\b/i.test(head)) blocks.push({ t: 'rules', raw })
      else if (/^\*\*VERDICT/i.test(head)) {
        blocks.push({
          t: 'verdict',
          text: raw.join(' ').replace(/^\*\*VERDICT:?\*\*:?\s*/i, '').trim(),
        })
      } else blocks.push({ t: 'quote', raw })
      continue
    }

    const lane = line.trim().match(LANE_RE)
    if (lane) {
      const kind = lane[1].toUpperCase()
      const note = (lane[2] || '').trim()
      i++
      while (i < lines.length && lines[i].trim() === '') i++

      if (i < lines.length && /^>/.test(lines[i])) {
        blocks.push({ t: 'lane', kind, note, raw: flushQuote(), spoken: true })
      } else {
        const body = []
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^#{1,4}\s/.test(lines[i]) &&
          !/^>/.test(lines[i]) &&
          !LANE_RE.test(lines[i].trim()) &&
          !/^---\s*$/.test(lines[i])
        ) {
          body.push(lines[i])
          i++
        }
        blocks.push({ t: 'lane', kind, note, raw: body, spoken: false })
      }
      continue
    }

    i++
  }

  return blocks
}

// Index into blocks of the part heading containing the word BODY. Throws if absent.
export function bodyPartIndex(blocks) {
  const idx = blocks.findIndex((b) => b.t === 'part' && /\bBODY\b/i.test(b.text))
  if (idx === -1) {
    throw new Error(
      'NO_BODY_PART: no `## <n> · ...BODY...` part heading found. ' +
        'Refusing to guess which half of the outline is draft copy.'
    )
  }
  return idx
}

const PREFILLED_TAG = "✎ pre-filled — final unless it's wrong"

export function buildWorksheet(md) {
  const blocks = parse(md)
  const bodyIdx = bodyPartIndex(blocks)
  const title = blocks.find((b) => b.t === 'title')?.text ?? 'Untitled'

  // Part letter per block index.
  const partIdxs = blocks.map((b, n) => (b.t === 'part' ? n : -1)).filter((n) => n >= 0)
  const letterFor = (n) => {
    const owning = partIdxs.filter((p) => p <= n).pop()
    if (owning === undefined) return 'A'
    if (owning < bodyIdx) return 'A'
    if (owning === bodyIdx) return 'B'
    return 'C'
  }

  const out = []
  out.push(`# ${title} — script worksheet`)
  out.push('')
  out.push('Fill the empty **Voiceover** slots. Everything else is already done.')
  out.push('')
  out.push('**Keep `outline.pdf` open beside this file.** Everything you need to write')
  out.push('a beat is in it — what to demo, the angle to hit, and every number and')
  out.push('price. None of it is repeated here, so this file stays pure script: your')
  out.push('words and the words already final. Beat numbers match the PDF in order.')
  out.push('')
  out.push('Beats marked pre-filled are final. Change one only if your screen time')
  out.push("showed it to be wrong; anything you change is flagged for Kushal's review.")
  out.push('')

  const counters = { A: 0, B: 0, C: 0 }
  let pendingBeat = null

  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n]

    if (b.t === 'part') {
      out.push('---')
      out.push('')
      out.push(`## PART ${letterFor(n)} — ${b.text.replace(/^\d+\s*·\s*/, '')}`)
      out.push('')
      continue
    }

    if (b.t === 'section') {
      out.push(`### SECTION: ${b.text}`)
      out.push('')
      continue
    }

    // Record the heading only. The counter increments when a SAY lane actually
    // EMITS a beat — a beat with only SHOW/EDIT produces nothing in a
    // voiceover-only file, and must not consume a number and leave a gap.
    if (b.t === 'beat') {
      pendingBeat = { text: b.text.replace(/^[\d.]+\s*·\s*/, '') }
      continue
    }

    if (b.t === 'verdict') {
      out.push(`> **VERDICT** ${PREFILLED_TAG}`)
      out.push(`> ${b.text}`)
      out.push('')
      continue
    }

    if (b.t === 'lane' && b.kind === 'SAY' && b.spoken) {
      const letter = letterFor(n)
      counters[letter] += 1
      const id = `${letter}${counters[letter]}`
      const text = pendingBeat?.text ?? 'Untitled beat'
      pendingBeat = null
      const isDraft = letter === 'B' && b.note.toLowerCase() !== 'final'

      if (!isDraft) {
        out.push(`#### ${id} · ${text}    ${PREFILLED_TAG}`)
        out.push('')
        out.push(requote(b.raw))
        out.push('')
      } else {
        // Script only. No REFERENCE block and no facts block — the draft's angle
        // and every supporting number are in outline.pdf, which he reads beside
        // this file (owner decision 2026-08-18, reversing the fact-pack design).
        // Duplicating them here made the reference read as finished copy he could
        // paste, which is the exact failure this whole surface exists to remove.
        out.push(`#### ${id} · ${text}    target — words`)
        out.push('')
        out.push('**Voiceover**')
        out.push('>')
        out.push('>')
        out.push('>')
        out.push('')
      }
      continue
    }

    // SHOW, EDIT, rules, plain quotes, prose: dropped on purpose. They belong to
    // outline.pdf. Repeating them here is the mistake this format exists to avoid.
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const args = argv.filter((a) => a !== '--force')
  const force = argv.includes('--force')
  const arg = args[0]
  if (!arg) {
    console.error('usage: node render-worksheet.mjs <slug|path/to/script-plan.md> [--force]')
    process.exit(1)
  }

  const inPath = arg.endsWith('.md') ? resolve(arg) : join(HERE, 'videos', arg, 'script-plan.md')
  if (!existsSync(inPath)) {
    console.error(`no outline at ${inPath}`)
    process.exit(1)
  }

  const outPath = join(dirname(inPath), 'script-worksheet.md')
  if (existsSync(outPath) && !force) {
    console.error(
      `${outPath} already exists. The session's hand-written fact packs are not ` +
        `regenerable — pass --force only if you mean to lose them.`
    )
    process.exit(1)
  }

  writeFileSync(outPath, buildWorksheet(readFileSync(inPath, 'utf8')))
  console.log(outPath)
}

if (process.argv[1] && basename(process.argv[1]) === 'render-worksheet.mjs') {
  main(process.argv.slice(2))
}
