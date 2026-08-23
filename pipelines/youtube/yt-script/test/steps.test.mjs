// The step table in SKILL.md IS the contract, so it has to match the folders on
// disk. visuals-flow's own table drifted until it named gates that had been
// deleted and missed three that existed, and a session working from it could not
// name the gate it was actually at. Same shape here, same failure available —
// except this fails the build instead.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const STEPS = join(ROOT, 'steps')
const SKILL = join(ROOT, '..', '..', '.claude', 'skills', 'yt-script', 'SKILL.md')

const KINDS = ['llm', 'run', 'human']

function stepDirs() {
  return readdirSync(STEPS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

test('every step folder is named NNN-verb-thing-kind', () => {
  for (const d of stepDirs()) {
    assert.match(d, /^\d{3}-[a-z0-9-]+-(llm|run|human)$/, `STEP_NAME_BAD: "${d}" does not match NNN-...-<llm|run|human>`)
  }
})

test('every step folder has a step.json and a README.md', () => {
  for (const d of stepDirs()) {
    assert.ok(existsSync(join(STEPS, d, 'step.json')), `STEP_INCOMPLETE: ${d} has no step.json`)
    assert.ok(existsSync(join(STEPS, d, 'README.md')), `STEP_INCOMPLETE: ${d} has no README.md`)
  }
})

test('each step.json agrees with its own folder name', () => {
  for (const d of stepDirs()) {
    const j = JSON.parse(readFileSync(join(STEPS, d, 'step.json'), 'utf8'))
    assert.equal(j.slug, d, `STEP_SLUG_DRIFT: ${d}/step.json says slug "${j.slug}"`)
    assert.equal(j.number, d.slice(0, 3), `STEP_NUMBER_DRIFT: ${d}/step.json says number "${j.number}"`)
    const kind = d.slice(d.lastIndexOf('-') + 1)
    assert.equal(j.actor, kind, `STEP_ACTOR_DRIFT: ${d}/step.json says actor "${j.actor}" but the folder says "${kind}"`)
    assert.ok(KINDS.includes(j.actor), `STEP_ACTOR_BAD: ${d} has actor "${j.actor}"`)
    assert.ok(j.oneLiner && j.oneLiner.trim().length > 0, `STEP_NO_ONELINER: ${d}`)
    assert.ok(j.summary && j.summary.trim().length > 0, `STEP_NO_SUMMARY: ${d}`)
  }
})

test('step numbers are unique and ascending', () => {
  const nums = stepDirs().map((d) => d.slice(0, 3))
  assert.deepEqual(nums, [...new Set(nums)], 'STEP_NUMBER_DUPLICATE: two folders share a number')
  assert.deepEqual(nums, [...nums].sort(), 'STEP_NUMBER_ORDER: folder order is not numeric order')
})

test("SKILL.md's table lists exactly the folders on disk", () => {
  const skill = readFileSync(SKILL, 'utf8')
  const listed = [...skill.matchAll(/^\| `(\d{3}-[a-z0-9-]+)` \|/gm)].map((m) => m[1]).sort()
  assert.deepEqual(
    listed,
    stepDirs(),
    'STEP_TABLE_DRIFT: the SKILL.md step table and steps/ on disk disagree. ' +
      `Table has ${listed.length} rows, disk has ${stepDirs().length} folders.`,
  )
})

test('every owner gate in the table is a human step, and every human step is in it', () => {
  const skill = readFileSync(SKILL, 'utf8')
  const humanOnDisk = stepDirs().filter((d) => d.endsWith('-human'))

  const gateLine = skill.match(/\b[A-Z][a-z]+ owner gates: ([^.]+)\./)
  assert.ok(gateLine, 'STEP_TABLE_DRIFT: SKILL.md no longer states which steps are the owner gates')
  const gateNums = gateLine[1].match(/\d{3}/g) ?? []

  assert.deepEqual(
    gateNums.sort(),
    humanOnDisk.map((d) => d.slice(0, 3)).sort(),
    'STEP_GATE_DRIFT: the gates SKILL.md names are not the human steps on disk',
  )
})

test('the publish step comes after the local review step', () => {
  const dirs = stepDirs()
  const review = dirs.findIndex((d) => d.includes('review-local-desk'))
  const publish = dirs.findIndex((d) => d.includes('publish-desk'))
  assert.ok(review >= 0, 'STEP_MISSING: no local review step')
  assert.ok(publish >= 0, 'STEP_MISSING: no publish step')
  assert.ok(
    review < publish,
    'PUBLISH_BEFORE_REVIEW: publishing mints a live secret URL, so it must come after the owner has seen it. ' +
      'This was the actual bug on 2026-08-23 — the old step 2 published, then said "wait for approval".',
  )
})

test('no step in the flow renders HTML or PDF any more', () => {
  for (const d of stepDirs()) {
    const j = JSON.parse(readFileSync(join(STEPS, d, 'step.json'), 'utf8'))
    const produced = (j.produces ?? []).join(' ')
    assert.doesNotMatch(
      produced,
      /\.(html|pdf)\b/,
      `RENDER_STEP_BACK: ${d} produces ${produced} — the desk replaced both renders (owner, 2026-08-23)`,
    )
  }
})
