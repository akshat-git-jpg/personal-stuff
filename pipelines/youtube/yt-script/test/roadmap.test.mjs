// The intro roadmap must name every body section, and the spoken copy must
// contain NOTHING but spoken words.
//
// Both halves failed together on 2026-08-27 in `vox-style-video-ai`. The spec
// said the roadmap "must match the `### SECTION:` headings exactly" and nothing
// checked it, so the session appended each heading in brackets after the
// sentence that already contained it — eleven times — as its own proof of the
// match. Those brackets sat inside the `SAY` blockquote, which means they are
// spoken copy: the voiceover would have read every section name twice.
//
// Owner: *"What are these texts in the bracket and why are they in read as
// written? This is a major gap, right?"*
//
// It is the same class of failure as the DEMO-order bug logged the same night: a
// constraint stated in prose, verifiable by nobody, satisfied by writing the
// verification into the artefact. So this file checks the match. With the check
// here there is no reason to ever annotate it again.
//
// Writing the check found the same 25 annotations across THREE videos, going back
// to the earliest ones — it was a standing habit, not one bad night. It also
// found why: `ai-avatar-generators` has headings like "Summary Table" and
// "Pricing & Value", which cannot go into a sentence without sounding like a
// slide deck, so its roadmap paraphrases them ("one side-by-side comparison
// table") and reads better for it. The old verbatim rule left no legal way to
// write that line, and appending the heading in brackets was the session
// satisfying an impossible rule instead of questioning it.
//
// So the requirement is COVERAGE — every section is promised, in order — and
// verbatim is the default because T8 (everyday words) makes a modern heading
// already speakable. The three plans written before T8 are named below. That list
// can only shrink: a new plan under T8 has no reason to be on it.
const PRE_T8 = new Set([
  'ai-avatar-generator-comparison',
  'ai-avatar-generators',
  'character-consistency-ai',
])
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

const sectionsOf = (md) => [...md.matchAll(/^### SECTION: (.+)$/gm)].map((m) => m[1].trim())

// Every line of a blockquote, across the whole document.
const spokenLines = (md) =>
  md
    .split('\n')
    .filter((l) => /^>/.test(l))
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter(Boolean)

// The intro is everything before the body heading.
const introSpoken = (md) => spokenLines(md.split(/^## \d+ · BODY/m)[0]).join(' ')

for (const { key, path } of plans()) {
  const md = readFileSync(path, 'utf8')
  const sections = sectionsOf(md)
  if (sections.length === 0) continue

  test(`${key}: the intro roadmap names every body section verbatim`, {
    skip: PRE_T8.has(key)
      ? 'pre-T8 plan: Title Case headings that verbatim would make unspeakable — see the header'
      : false,
  }, () => {
    const intro = introSpoken(md).toLowerCase()
    const missing = sections.filter((s) => !intro.includes(s.toLowerCase()))
    assert.deepEqual(
      missing,
      [],
      `ROADMAP_MISMATCH: the intro never says ${JSON.stringify(missing)} — ` +
        'a section heading the roadmap does not name is a section the viewer was not promised. ' +
        'If the heading cannot go into a sentence without sounding like a slide title, the ' +
        'HEADING is the thing to fix (T8), not the sentence.',
    )
  })

  test(`${key}: no section heading is annotated inside the spoken copy`, () => {
    // A blockquote is what comes out of the presenter's mouth. A heading in
    // brackets is not spoken, so it must not be there — and the test above
    // already proves the match, so nothing is lost by banning it.
    const offenders = []
    for (const line of spokenLines(md)) {
      for (const s of sections) {
        for (const open of ['(', '[']) {
          const close = open === '(' ? ')' : ']'
          if (line.includes(`${open}${s}${close}`)) offenders.push({ line, s })
        }
      }
    }
    assert.deepEqual(
      offenders.map((o) => o.s),
      [],
      'SPOKEN_ANNOTATION: a section heading is bracketed inside a blockquote, so the voice ' +
        `reads it aloud. Offending line: ${JSON.stringify(offenders[0]?.line ?? '')}. ` +
        'Cross-references belong in EDIT, never in SAY.',
    )
  })
}
