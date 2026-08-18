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

test('every body slot carries a facts block and a bare word target', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.match(ws, /<details><summary>Facts for this beat<\/summary>/)
  assert.ok(ws.includes('target — words'), 'generator emits the target unstamped for the session')
})
