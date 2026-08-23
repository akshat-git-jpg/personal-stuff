import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const read = (p) => readFileSync(join(REPO, p), 'utf8')

const URL = 'https://script-desk.agrolloo.com'

test('the skill routes the handoff through the desk', () => {
  const s = read('pipelines/.claude/skills/yt-script/SKILL.md')
  assert.match(s, /desk\.mjs publish/, 'DESK_WIRING_MISSING: step 2 does not publish to the desk')
  assert.match(s, /desk\.mjs pull/, 'DESK_WIRING_MISSING: step 3 does not pull the draft')
  assert.match(s, /Angle/, 'DESK_WIRING_MISSING: the body-draft rule is not restated')
})

test('the folder guide says the same thing', () => {
  const c = read('pipelines/youtube/yt-script/CLAUDE.md')
  assert.match(c, /desk\.mjs/, 'DESK_WIRING_MISSING: CLAUDE.md has drifted from SKILL.md')
})

test('the fallback renderers are still documented, not deleted', () => {
  const s = read('pipelines/.claude/skills/yt-script/SKILL.md')
  assert.match(s, /render-outline\.mjs/, 'DESK_WIRING_MISSING: render-outline.mjs was dropped from the skill')
  assert.match(s, /render-worksheet\.mjs/, 'DESK_WIRING_MISSING: render-worksheet.mjs was dropped from the skill')
})

test('the app is registered in the local dashboard', () => {
  const apps = JSON.parse(read('tooling/cli/local-apps-dashboard/apps.json')).apps
  const entry = apps.find((a) => a.id === 'script-desk')
  assert.ok(entry, 'DESK_WIRING_MISSING: no script-desk entry in apps.json')
  assert.equal(entry.cwd, 'apps/yt-script-desk')
  const ports = apps.flatMap((a) => a.ports || (a.port ? [a.port] : []))
  assert.equal(new Set(ports).size, ports.length, 'DESK_WIRING_MISSING: two dashboard apps share a port')
})

test('the URL is in every inventory surface', () => {
  for (const f of ['my-hosted-sites.md', 'INFRA.md']) {
    assert.ok(read(f).includes(URL), `DESK_URL_MISSING: ${f} does not list ${URL}`)
  }
})

test('the app carries its own docs', () => {
  for (const f of ['apps/yt-script-desk/README.md', 'apps/yt-script-desk/CLAUDE.md']) {
    assert.ok(read(f).split('\n').length > 25, `DESK_WIRING_MISSING: ${f} is still a stub`)
  }
})
