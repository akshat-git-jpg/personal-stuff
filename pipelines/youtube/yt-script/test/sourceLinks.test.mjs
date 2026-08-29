// A source named in the instructions must be openable.
//
// The lanes cite people by name — "Joseph's checklist", "Skai's angle", "both
// Thomas Creates and Joseph" — and the freelancer working from the desk has
// never heard of any of them. Owner, 2026-08-28: *"can we please add reference
// link wherever possible for my freelancer... you said Joseph's list, but I
// don't think my freelancer is aware of Joseph."*
//
// The fix is a reference line in every section that names anybody, plus URL
// auto-linking in the instruction track (WriteView.tsx) so the link is clickable
// rather than text to retype.
//
// Two spellings are accepted. `- Sources: ...` is the current one: the last
// bullet of a section card's `**NOTES**` list. `Who these people are: ...` is
// what plans written before the 2026-08-29 card format used, in a section FACTS
// block. Both reach the desk in the same `Notes` block.
//
// This test exists because the failure is silent in both directions: a name with
// no link renders perfectly, and a link written as markdown renders its brackets
// literally on a track with no markdown parser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const VIDEOS = join(HERE, '..', 'videos')

const plans = () =>
  readdirSync(VIDEOS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ key: d.name, path: join(VIDEOS, d.name, 'script-plan.md') }))
    .filter((p) => existsSync(p.path))

// Instruction lines only. A blockquote is spoken copy and a URL has no business
// in one — nobody reads a link out loud.
const instructionLines = (md) =>
  md
    .split('\n')
    .filter((l) => !l.startsWith('>') && l.trim() && !l.startsWith('#') && !l.startsWith('---'))

for (const { key, path } of plans()) {
  const md = readFileSync(path, 'utf8')
  const sections = [...md.matchAll(/^### SECTION: (.+)$/gm)]
  if (sections.length === 0) continue

  test(`${key}: every section that cites a person says who they are, with a link`, () => {
    // A source citation looks like a capitalised name in a FACTS or SHOW lane.
    // Rather than guess at names, use the plan's own reference lines as the
    // index: if a section names anybody, it must carry one.
    const bodies = md.split(/^### SECTION: .+$/gm).slice(1)
    const missing = []
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i]
      const citesSomebody = /\b(?:Joseph|Skai|Luuk|Koen|MoSidd|Leo Ai|Ai-Seekify|Thomas Creates)\b/.test(
        body,
      )
      if (citesSomebody && !/(?:Who these people are|Sources):/.test(body)) {
        missing.push(sections[i][1])
      }
    }
    assert.deepEqual(
      missing,
      [],
      `SOURCE_UNEXPLAINED: these sections name a person with no "Sources:" line — ` +
        `the freelancer reads "Joseph's checklist" and has no way to find out who Joseph is: ${JSON.stringify(missing)}`,
    )
  })

  test(`${key}: source links are bare URLs, never markdown`, () => {
    const offenders = instructionLines(md).filter((l) => /\[[^\]]+\]\(https?:\/\//.test(l))
    assert.deepEqual(
      offenders,
      [],
      'MARKDOWN_LINK_IN_LANE: the instruction track has no markdown parser, so this prints its ' +
        `brackets literally. Write the bare URL. Offending line: ${JSON.stringify(offenders[0] ?? '')}`,
    )
  })

  test(`${key}: no URL is hidden inside spoken copy`, () => {
    const spoken = md.split('\n').filter((l) => l.startsWith('> ') && !l.startsWith('> -'))
    const offenders = spoken.filter((l) => /https?:\/\//.test(l))
    assert.deepEqual(
      offenders,
      [],
      `URL_IN_SPOKEN_COPY: a blockquote is what comes out of the presenter's mouth, and nobody ` +
        `reads a URL aloud. Offending line: ${JSON.stringify(offenders[0] ?? '')}`,
    )
  })
}
