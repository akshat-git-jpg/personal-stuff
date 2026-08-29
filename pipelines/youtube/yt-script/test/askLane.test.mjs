// `**ASK**` is the owner's own open question to Claude, left in the markdown while
// he reviews. It is not script, not an instruction for the maker, and it must never
// leave this repo.
//
// It exists INSTEAD of a browser markup UI. On 2026-08-28 a full review-and-markup
// layer was designed for the desk — click-to-edit notes, an add-note menu, a
// request composer, an overlay store, four plans. The owner stopped it:
//
//   "I feel that this will be too complex. making comments, edits, all those things
//    one by one on the URL when I have the entire thing as a text in my MD file,
//    which I can easily cut paste everything. I can't do that easily on the UI."
//
// He was right. He edits the markdown in his own editor, where cut and paste work,
// and the ONE thing the editor could not give him was leaving a question in place
// that the desk shows back. That is this lane, and nothing else. Keep it that small.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../lib/beats.mjs'
import { buildWorksheet } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const VIDEOS = join(HERE, '..', 'videos')

const MD = [
  '# T',
  '',
  '## 1 · INTRODUCTION',
  '',
  '#### 1.1 · Open',
  '',
  '**SAY** — final',
  '> A spoken line.',
  '',
  '**ASK**',
  'Cut this to two sentences.',
  'The After Effects line is doing the work.',
  '',
  '## 2 · BODY',
  '',
  '### SECTION: A section',
  '',
  '**ASK**',
  'This whole section drags. Can we lose a beat?',
  '',
  '**FACTS**',
  'A fact.',
  '',
  '#### 2.1 · First',
  '',
  '**SAY**',
  'Cover the thing.',
  '',
  '#### 2.2 · Second',
  '',
  '**SAY**',
  'Cover the other thing.',
  '',
  '**ASK**',
  'Is 200% too close to read the texture?',
  '',
].join('\n')

test('an ASK lane parses onto its own beat', () => {
  const { beats } = buildBeats(MD)
  const b11 = beats.find((b) => b.num === '1.1')
  assert.deepEqual(
    b11.ask,
    ['Cut this to two sentences.', 'The After Effects line is doing the work.'],
    'ASK_DROPPED: the owner wrote a question in the markdown and the parser threw it away',
  )
  const b22 = beats.find((b) => b.num === '2.2')
  assert.deepEqual(b22.ask, ['Is 200% too close to read the texture?'])
})

test('a section-level ASK lands on the section first beat, once', () => {
  const { beats } = buildBeats(MD)
  const first = beats.find((b) => b.num === '2.1')
  const second = beats.find((b) => b.num === '2.2')
  assert.deepEqual(
    first.ask,
    ['This whole section drags. Can we lose a beat?'],
    'SECTION_ASK_DROPPED: an ASK before the first beat of a section vanished — the same ' +
      'silent-drop bug that ate every section FACTS block until 2026-08-28',
  )
  assert.deepEqual(
    second.ask,
    ['Is 200% too close to read the texture?'],
    'SECTION_ASK_REPEATED: the section ASK was copied onto every beat of the section',
  )
})

test('an ASK never reaches the maker worksheet', () => {
  const ws = buildWorksheet(MD)
  for (const needle of [
    'ASK',
    'Cut this to two sentences',
    'This whole section drags',
    'Is 200% too close',
  ]) {
    assert.ok(
      !ws.includes(needle),
      `ASK_LEAKED_TO_WORKSHEET: ${JSON.stringify(needle)} reached the document the maker ` +
        'works from. An ASK is a note to Claude, addressed to nobody else.',
    )
  }
})

test('an ASK never reaches the spoken copy', () => {
  const { beats } = buildBeats(MD)
  for (const b of beats) {
    const spoken = (b.say ?? []).join(' ')
    assert.ok(
      !/Cut this to two sentences|whole section drags|200% too close/.test(spoken),
      `ASK_IN_SPOKEN_COPY: beat ${b.num} would have the question read aloud`,
    )
  }
})

// The real plans in this repo are reviewed and then published. A leftover ASK in a
// committed plan is not an error — it is the owner mid-review — but it must be
// visible, so this reports rather than fails.
test('reports any ASK still open in a committed plan', (t) => {
  const open = []
  for (const d of readdirSync(VIDEOS, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const p = join(VIDEOS, d.name, 'script-plan.md')
    if (!existsSync(p)) continue
    const md = readFileSync(p, 'utf8')
    const n = (md.match(/^\*\*ASK\*\*/gm) ?? []).length
    if (n) open.push(`${d.name}: ${n}`)
  }
  t.diagnostic(open.length ? `open ASKs — ${open.join(', ')}` : 'no open ASKs in any plan')
  assert.ok(true)
})
