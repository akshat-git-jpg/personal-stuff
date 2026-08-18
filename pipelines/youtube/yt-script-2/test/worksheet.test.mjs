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
