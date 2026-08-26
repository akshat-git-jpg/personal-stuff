// The feedback loop is three files that must agree: step 130 owns the routing
// table and the kind vocabulary, TASTE.md holds rules in one fixed shape, and
// FEEDBACK-LOG.md indexes reactions by kind. Prose agreements drift; these do
// not.
//
// The no-drift test is the important one. yt-video-edit-feedback's SKILL.md says
// "never restate 130's surface-routing table here — read it at execute time so
// the two cannot drift". That is an instruction nobody can enforce by reading.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const REPO = join(ROOT, '..', '..', '..')
const read = (p) => readFileSync(join(REPO, p), 'utf8')

const STEP130 = 'pipelines/youtube/yt-script/steps/130-learn-from-feedback-llm/README.md'
const SKILL = 'pipelines/.claude/skills/yt-script-feedback/SKILL.md'
const TASTE = 'pipelines/youtube/yt-script/TASTE.md'
const LOG = 'pipelines/youtube/yt-script/FEEDBACK-LOG.md'

// The closed vocabulary, restated here ON PURPOSE: this array is the assertion,
// so a tag added to step 130 without the owner's sign-off turns this red.
const KINDS = [
  'hook-length',
  'filler-phrase',
  'section-order',
  'claim-density',
  'cta-placement',
  'tone',
  'pacing',
  'jargon',
  'structure',
  'evidence',
  'format',
]

test('all four feedback surfaces exist', () => {
  for (const p of [STEP130, SKILL, TASTE, LOG]) {
    assert.ok(existsSync(join(REPO, p)), `FEEDBACK_SURFACE_MISSING: ${p}`)
  }
})

test('step 130 carries the routing table', () => {
  const s = read(STEP130)
  assert.match(s, /## The surface-routing table/, 'ROUTING_TABLE_MISSING: step 130 no longer owns the routing table')
  for (const f of ['SCRIPT-PLAN-INSTRUCTIONS.md', 'OUTLINE-INSTRUCTIONS.md', 'SCRIPT-INSTRUCTIONS.md', 'TASTE.md']) {
    assert.ok(s.includes(f), `ROUTING_TABLE_INCOMPLETE: no row routes to ${f}`)
  }
})

test('the skill does NOT restate the routing table', () => {
  const s = read(SKILL)
  assert.doesNotMatch(
    s,
    /## The surface-routing table/,
    'ROUTING_TABLE_DUPLICATED: the skill restates step 130s table, so the two will drift. ' +
      'The skill owns the conversation; 130 owns where a lesson lands.',
  )
  assert.match(
    s,
    /130-learn-from-feedback-llm/,
    'ROUTING_TABLE_UNREACHABLE: the skill never points at the step that owns routing',
  )
})

test('the kind vocabulary is closed and both files agree on it', () => {
  const step = read(STEP130)
  const log = read(LOG)
  for (const k of KINDS) {
    assert.ok(step.includes(`\`${k}\``), `KIND_VOCAB_DRIFT: step 130 does not define \`${k}\``)
  }
  assert.match(step, /closed/, 'KIND_VOCAB_OPEN: step 130 no longer says the vocabulary is closed')
  assert.match(
    log,
    /130-learn-from-feedback-llm/,
    'KIND_VOCAB_DRIFT: FEEDBACK-LOG.md does not defer to step 130 for the vocabulary',
  )
  // The log must NOT carry its own copy of the list — one authority only.
  const listed = KINDS.filter((k) => log.includes(`\`${k}\``))
  assert.deepEqual(
    listed,
    [],
    `KIND_VOCAB_DUPLICATED: FEEDBACK-LOG.md restates ${listed.join(', ')}; step 130 is the only authority`,
  )
})

test('every TASTE rule has all four required parts', () => {
  const t = read(TASTE)
  const blocks = t.split(/^## (?=T\d+ )/m).slice(1)
  assert.ok(blocks.length >= 1, 'TASTE_RULE_MALFORMED: TASTE.md contains no T rules, so this check is vacuous')
  for (const b of blocks) {
    const id = (b.match(/^T\d+/) || ['?'])[0]
    assert.match(b, /^T\d+ — .+/, `TASTE_RULE_MALFORMED: ${id} has no one-line rule after the dash`)
    assert.match(b, /\*\*From:\*\*/, `TASTE_RULE_MALFORMED: ${id} has no **From:** line`)
    // A folded rule quotes the owner's own reaction verbatim (Owner: "..."). A
    // seeded rule (plan 254) has no reaction to quote — it cites the format
    // file it was migrated from plus the original text, verbatim, instead.
    // Either counts as real provenance; neither is optional.
    assert.match(
      b,
      /Owner: \*".+"\*|seeded from[\s\S]*\*".+"\*/s,
      `TASTE_RULE_MALFORMED: ${id}'s **From:** documents neither an owner quote nor a seeded original text`,
    )
    assert.match(b, /\*\*Applies to:\*\*/, `TASTE_RULE_MALFORMED: ${id} has no **Applies to:** line`)
    assert.match(b, /\*\*Enforced by:\*\*/, `TASTE_RULE_MALFORMED: ${id} has no **Enforced by:** line`)
  }
})

test('TASTE rule numbers are unique and ascending', () => {
  const nums = [...read(TASTE).matchAll(/^## T(\d+) /gm)].map((m) => Number(m[1]))
  assert.deepEqual(nums, [...new Set(nums)], 'TASTE_RULE_MALFORMED: two rules share a number')
  assert.deepEqual(nums, [...nums].sort((a, b) => a - b), 'TASTE_RULE_MALFORMED: rules are not in ascending order')
})

test('TASTE.md states that it holds taste and not format', () => {
  const t = read(TASTE)
  assert.match(
    t,
    /holds taste, never format|taste, never format/,
    'TASTE_FORMAT_MIXED: TASTE.md no longer states the taste/format split, which is the reason it is a separate file',
  )
  for (const f of ['SCRIPT-PLAN-INSTRUCTIONS.md', 'OUTLINE-INSTRUCTIONS.md', 'SCRIPT-INSTRUCTIONS.md']) {
    assert.ok(t.includes(f), `TASTE_FORMAT_MIXED: TASTE.md does not name ${f} as the format home`)
  }
})

// The migrated rules (plan 254) must stay migrated. Reintroducing one into a
// format file is the exact drift TASTE.md exists to prevent, and it is a
// copy-paste away — the text lived there for months.
test('no migrated taste rule has leaked back into a format file', () => {
  const FORMAT_FILES = [
    'pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md',
    'pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md',
    'pipelines/youtube/yt-script/SCRIPT-PLAN-INSTRUCTIONS.md',
  ]
  // Distinctive fragments of T2-T5, chosen so a paraphrase is allowed but the
  // original sentence is not.
  const MIGRATED = [
    ['T2', 'Casual-professional'],
    ['T3', 'earned, not sponsored'],
    ['T4', 'Give every option credit before naming its limit'],
    ['T4', 'earn the criticism after'],
    ['T4', 'never the reverse order'],
    ['T5', 'not "it depends"'],
    ['T5', "they're just built for different priorities"],
  ]
  for (const f of FORMAT_FILES) {
    const body = read(f)
    for (const [rule, fragment] of MIGRATED) {
      assert.ok(
        !body.includes(fragment),
        `TASTE_IN_FORMAT_FILE: ${f} contains ${rule}'s text ("${fragment}"). ` +
          'Taste lives in TASTE.md; steps/130-learn-from-feedback-llm/README.md has the routing table.',
      )
    }
  }

  // ...and each one really is in TASTE.md, so this check cannot pass by the
  // rules having been deleted rather than moved.
  const taste = read(TASTE)
  for (const rule of ['T2', 'T3', 'T4', 'T5']) {
    assert.match(taste, new RegExp(`^## ${rule} — `, 'm'), `TASTE_RULE_MISSING: ${rule} is not in TASTE.md`)
  }
})
