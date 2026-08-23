#!/usr/bin/env node
// One structured beat model for an outline.md, shared by the script desk UI.
//
// This does NOT own a parser. It lifts a typed model on top of the block parser
// already inside render-worksheet.mjs, so the worksheet and the desk can never
// disagree about what a beat is.
//
//   import { buildBeats } from './lib/beats.mjs'
//   node lib/beats.mjs <key>            # prints JSON for videos/<key>/outline.md
//
// The load-bearing rule (decisions.md 2026-08-18): a BODY beat's SAY lane is a
// short DRAFT PROMPT, not finished copy. It must never reach the maker as
// something he can paste — plan 207 removed exactly that. So a body draft lands
// in `angle` (an instruction, shown in the desk's instruction track) and `say`
// stays null. An intro/outro SAY, or a body SAY explicitly noted `— final`, is
// finished copy and lands in `say`.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, bodyPartIndex } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// Single mutation target. Setting this to false routes body SAY drafts into
// `say`, i.e. straight to the maker as pasteable copy — the exact defect the
// gate must catch. Do not inline it back into the condition.
const BODY_DRAFTS_ARE_INSTRUCTIONS = true

// `#### 2.9 · Remembering the character next week` -> ['2.9', 'Remembering …']
// Also supports optional target words at the end: `... target 160-260 words`
const BEAT_RE = /^([0-9A-Za-z][0-9A-Za-z.]*)\s*·\s*(.*?)(?:\s+target\s+(.*))?$/

export function buildBeats(md) {
  const blocks = parse(md)
  const bodyIdx = bodyPartIndex(blocks)
  const title = blocks.find((b) => b.t === 'title')?.text ?? 'Untitled'

  const partIdxs = blocks.map((b, n) => (b.t === 'part' ? n : -1)).filter((n) => n >= 0)
  const partKindFor = (n) => {
    const owning = partIdxs.filter((p) => p <= n).pop()
    if (owning === undefined || owning < bodyIdx) return 'intro'
    if (owning === bodyIdx) return 'body'
    return 'outro'
  }

  const beats = []
  let curPart = null
  let curPartKind = 'intro'
  let curSection = null
  let curRules = []
  let pending = null

  const flush = () => {
    if (pending) beats.push(pending)
    pending = null
  }

  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n]

    if (b.t === 'part') {
      flush()
      curPart = b.text
      curPartKind = partKindFor(n)
      curSection = null
      curRules = []
      continue
    }

    if (b.t === 'section') {
      flush()
      curSection = b.text
      curRules = []
      continue
    }

    if (b.t === 'rules') {
      // raw[0] is the `**RULES — …**` header line; the rest are `- item` lines.
      curRules = (b.raw ?? [])
        .slice(1)
        .map((l) => l.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
      continue
    }

    if (b.t === 'beat') {
      flush()
      const m = b.text.match(BEAT_RE)
      pending = {
        num: m ? m[1] : String(beats.length + 1),
        title: (m && m[2] ? m[2] : b.text).trim(),
        target: m && m[3] ? m[3].trim() : null,
        part: curPart,
        partKind: curPartKind,
        section: curSection,
        mode: curPartKind === 'body' ? 'write' : 'read',
        say: null,
        angle: null,
        show: [],
        edit: [],
        facts: [],
        rules: curRules.slice(),
        verdict: null,
      }
      continue
    }

    if (!pending) continue

    if (b.t === 'verdict') {
      pending.verdict = b.text
      continue
    }

    if (b.t === 'lane') {
      if (b.kind === 'SAY') {
        const isFinal = (b.note || '').trim().toLowerCase() === 'final'
        if (curPartKind === 'body' && !isFinal && BODY_DRAFTS_ARE_INSTRUCTIONS) {
          pending.angle = b.raw.slice()
          pending.mode = 'write'
        } else {
          pending.say = b.raw.slice()
          pending.mode = 'read'
        }
      } else if (b.kind === 'SHOW') {
        pending.show.push(...b.raw)
      } else if (b.kind === 'EDIT') {
        pending.edit.push(...b.raw)
      } else if (b.kind === 'FACTS') {
        pending.facts.push(...b.raw)
      }
      continue
    }
  }

  flush()
  return { title, beats }
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const arg = argv[0]
  if (!arg) {
    console.error('usage: node lib/beats.mjs <key|path/to/outline.md>')
    process.exit(1)
  }
  const inPath = arg.endsWith('.md')
    ? resolve(arg)
    : join(HERE, '..', 'videos', arg, 'outline.md')
  if (!existsSync(inPath)) {
    console.error(`no outline at ${inPath}`)
    process.exit(1)
  }
  process.stdout.write(JSON.stringify(buildBeats(readFileSync(inPath, 'utf8')), null, 2) + '\n')
}

if (process.argv[1] && basename(process.argv[1]) === 'beats.mjs') {
  main(process.argv.slice(2))
}
