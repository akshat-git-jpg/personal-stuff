// The desk is the handoff. These pin the docs to that, so a future edit cannot
// quietly restore the PDF flow or lose the publish/pull wiring.
//
// Rewritten 2026-08-23 for the twelve-step layout: the commands moved out of
// SKILL.md and into the step READMEs, so that is where they are checked now. Two
// assertions were INVERTED in the same pass — this file used to require that
// `render-outline.mjs` stayed documented in the skill, and the owner has since
// dropped both renderers from the flow.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const read = (p) => readFileSync(join(REPO, p), 'utf8')

const STEPS = 'pipelines/youtube/yt-script/steps'

test('the publish step carries the publish command', () => {
  const s = read(`${STEPS}/070-publish-desk-run/README.md`)
  assert.match(s, /desk\.mjs publish/, 'DESK_WIRING_MISSING: step 070 does not publish to the desk')
  assert.match(s, /desk\.mjs list/, 'DESK_WIRING_MISSING: step 070 no longer documents the link registry')
})

test('the pull step carries the pull command', () => {
  const s = read(`${STEPS}/090-pull-draft-run/README.md`)
  assert.match(s, /desk\.mjs pull/, 'DESK_WIRING_MISSING: step 090 does not pull the draft')
})

test('the local review step tells the owner how to open it', () => {
  const s = read(`${STEPS}/060-review-local-desk-human/README.md`)
  assert.match(s, /npm run dev:local/, 'DESK_WIRING_MISSING: step 060 does not say how to run the desk locally')
  assert.match(s, /localhost:5175/, 'DESK_WIRING_MISSING: step 060 does not give the local URL')
})

test('the body-draft rule is restated where the plan is written', () => {
  const s = read(`${STEPS}/050-write-script-draft-llm/README.md`)
  assert.match(
    s,
    /SHORT DRAFT PROMPT|short draft prompt/,
    'DESK_WIRING_MISSING: step 050 no longer says a body SAY is a draft prompt, not finished copy',
  )
  const skill = read('pipelines/.claude/skills/yt-script/SKILL.md')
  assert.match(skill, /script-plan\.md/, 'DESK_WIRING_MISSING: the skill does not name script-plan.md')
})

test('the folder guide says the same thing', () => {
  const c = read('pipelines/youtube/yt-script/CLAUDE.md')
  assert.match(c, /desk\.mjs/, 'DESK_WIRING_MISSING: CLAUDE.md has drifted from SKILL.md')
})

test('neither renderer is back in the flow', () => {
  const skill = read('pipelines/.claude/skills/yt-script/SKILL.md')
  // Named once, in the "what changed" note explaining that they are retired.
  // A step folder calling one is the regression this guards.
  for (const step of ['030-write-outline-llm', '050-write-script-draft-llm', '100-write-script-llm']) {
    const s = read(`${STEPS}/${step}/README.md`)
    assert.doesNotMatch(
      s,
      /node render-(outline|script)\.mjs/,
      `RENDER_STEP_BACK: ${step} calls a retired renderer — the desk replaced both (owner, 2026-08-23)`,
    )
  }
  assert.match(
    skill,
    /render-outline\.mjs.*dropped|dropped.*render-outline\.mjs|No HTML or PDF/s,
    'RENDER_STEP_BACK: the skill no longer records that the renderers were dropped',
  )
})

test('the outline and the script plan are two different documents', () => {
  const outline = read('pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md')
  const plan = read('pipelines/youtube/yt-script/SCRIPT-PLAN-INSTRUCTIONS.md')

  assert.match(outline, /One line per section/, 'OUTLINE_BLOAT: the outline spec no longer caps a section at one line')
  assert.match(
    outline,
    /No spoken copy anywhere|No spoken copy/,
    'OUTLINE_BLOAT: the outline spec no longer forbids spoken copy — that is what made it a draft script',
  )
  assert.match(plan, /script-plan/, 'PLAN_DOC_DRIFT: the script-plan spec does not name its own file')
})
