import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWorksheet, parse, bodyPartIndex } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const VIDEOS = join(ROOT, 'videos')
const REAL = ['ai-avatar-generator-comparison', 'ai-avatar-generators', 'character-consistency-ai']

// A minimal outline exercising every construct this generator must handle.
const FIXTURE = `# Test Video Title

## 1 · INTRODUCTION

#### Cold open — the drift

**SAY**
> "Perfect face. Perfect outfit.
>
>  Scene two. Different face."

**SHOW**
One portrait full-screen. Hard cut through three scenes.

**EDIT**
Red box. Glitch sound.

#### First CTA

**SAY**
> "Links are in the description."

## 2 · BODY

### SECTION: Quick Overview

> **RULES — WHOLE SECTION**
> - Orientation only, no scores.

#### 2.1 · Meet the five

**SAY**
> "Quick intros. OpenArt, InVideo, Higgsfield."

**SHOW**
Skim each platform panel.

> **VERDICT:** Five tools, five approaches.

#### 2.2 · Forward hook

**SAY** — final
> "Time to put them through the wringer."

## 3 · HONEST VERDICT & CONCLUSION

#### Final recommendation

**SAY**
> "OpenArt if you need identity to hold."
`

const NO_BODY = `# Broken

## 1 · INTRODUCTION

**SAY**
> "Hello."

## 2 · SOMETHING ELSE

#### 2.1 · Beat

**SAY**
> "Words."
`

test('parse keeps raw quote lines, not space-joined paragraphs', () => {
  const say = parse(FIXTURE).find((b) => b.t === 'lane' && b.kind === 'SAY' && b.spoken)
  assert.deepEqual(say.raw, ['"Perfect face. Perfect outfit.', '', ' Scene two. Different face."'])
})

test('bodyPartIndex finds the BODY part', () => {
  const blocks = parse(FIXTURE)
  assert.equal(blocks[bodyPartIndex(blocks)].text, '2 · BODY')
})

test('bodyPartIndex throws NO_BODY_PART when no part says BODY', () => {
  assert.throws(() => bodyPartIndex(parse(NO_BODY)), /NO_BODY_PART/)
})

test('intro beats are pre-filled, body beats get an empty slot', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.match(ws, /#### A1 · Cold open — the drift\s+✎ pre-filled/)
  assert.match(ws, /#### B1 · Meet the five\s+target — words/)
  assert.match(ws, /\*\*Voiceover\*\*/)
})

test('a body SAY noted `final` is pre-filled, not a slot', () => {
  const ws = buildWorksheet(FIXTURE)
  const hook = ws.slice(ws.indexOf('B2 · Forward hook'))
  assert.match(hook.split('####')[0], /✎ pre-filled/)
  assert.doesNotMatch(hook.split('####')[0], /target — words/)
})

test('the tail part becomes PART C whatever it is called', () => {
  assert.match(buildWorksheet(FIXTURE), /## PART C — HONEST VERDICT & CONCLUSION/)
  assert.match(buildWorksheet(FIXTURE.replace('HONEST VERDICT & CONCLUSION', 'WRAP UP')), /## PART C — WRAP UP/)
})

test('verdicts are pre-filled wherever they appear', () => {
  assert.match(buildWorksheet(FIXTURE), /> \*\*VERDICT\*\* ✎ pre-filled[^\n]*\n> Five tools, five approaches\./)
})

test('SHOW, EDIT and RULES never reach the worksheet', () => {
  const ws = buildWorksheet(FIXTURE)
  for (const banned of ['**SHOW**', '**EDIT**', 'RULES', 'One portrait full-screen', 'Red box. Glitch sound.', 'Skim each platform panel', 'Orientation only']) {
    assert.ok(!ws.includes(banned), `worksheet must not contain ${banned}`)
  }
})

test('every body slot is a bare word target and nothing else', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.ok(ws.includes('target — words'), 'generator emits the target unstamped for the session')
})

// Owner decision 2026-08-18: the worksheet is SCRIPT ONLY. Reference drafts and
// fact packs were built, shipped, and then removed — reprinting the outline's
// draft made it read as finished copy he could paste, which defeats asking him to
// write from screen time. He reads outline.pdf for the angle and the numbers.
test('no reference draft and no facts block reach the worksheet', () => {
  const ws = buildWorksheet(FIXTURE)
  for (const banned of ['REFERENCE', 'Facts for this beat', '<details>', '</details>', 'Do not ship these words']) {
    assert.ok(!ws.includes(banned), `worksheet must not contain ${banned}`)
  }
})

test('a body beat is exactly heading + empty Voiceover slot', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.match(ws, /#### B1 · Meet the five {4}target — words\n\n\*\*Voiceover\*\*\n>\n>\n>\n/)
})

// The body draft must NOT be duplicated into the worksheet — that text lives only
// in outline.md / outline.pdf now.
test('a body SAY draft never appears in the worksheet', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.ok(
    !ws.includes('Quick intros. OpenArt, InVideo, Higgsfield.'),
    'the body draft leaked into the worksheet; it belongs only in outline.pdf'
  )
})

// Every pre-filled block in the worksheet must be BYTE-IDENTICAL to the outline's.
// A retyped intro can drop a word and that word goes to camera.
function prefilledQuoteBlocks(worksheet) {
  const out = []
  const lines = worksheet.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('✎ pre-filled')) continue
    if (lines[i].startsWith('> **VERDICT**')) continue // verdict text is re-flowed by design
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    const blk = []
    while (j < lines.length && /^>/.test(lines[j])) blk.push(lines[j]), j++
    if (blk.length) out.push(blk.join('\n'))
  }
  return out
}

function outlineQuoteBlocks(md) {
  return parse(md)
    .filter((b) => b.t === 'lane' && b.kind === 'SAY' && b.spoken)
    .map((b) => b.raw.map((l) => (l ? '> ' + l : '>')).join('\n'))
}

for (const key of REAL) {
  test(`byte identity — ${key}`, () => {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const got = prefilledQuoteBlocks(buildWorksheet(md))
    const want = outlineQuoteBlocks(md)
    assert.ok(got.length > 0, `${key}: no pre-filled blocks found at all`)
    for (const block of got) {
      assert.ok(
        want.includes(block),
        `PREFILLED_DRIFT in ${key}: a pre-filled block is not byte-identical to outline.md.\n--- worksheet ---\n${block}\n`
      )
    }
  })
}

test('byte identity covers a real intro end to end', () => {
  const md = readFileSync(join(VIDEOS, 'character-consistency-ai', 'outline.md'), 'utf8')
  const ws = buildWorksheet(md)
  assert.ok(
    ws.includes('> "Perfect face. Perfect outfit. Exactly the character you wanted.'),
    'PREFILLED_DRIFT: the real cold-open line did not survive verbatim'
  )
})

const DOC_CHECKS = [
  ['../../../.claude/skills/yt-script/SKILL.md', ['render-worksheet.mjs', 'script-worksheet.md', 'diff script-worksheet.md script-draft.md', 'target — words']],
  ['../CLAUDE.md', ['render-worksheet.mjs', 'voiceover only', 'PREFILLED_DRIFT']],
  ['../SCRIPT-INSTRUCTIONS.md', ['script-worksheet.md', 'Word targets']],
  ['../.gitignore', ['script-worksheet.md']],
]

for (const [rel, needles] of DOC_CHECKS) {
  test(`docs updated — ${rel.split('/').pop()}`, () => {
    const p = join(HERE, rel)
    assert.ok(existsSync(p), `missing ${p}`)
    const txt = readFileSync(p, 'utf8')
    for (const n of needles) assert.ok(txt.includes(n), `${rel} must mention "${n}"`)
  })
}
