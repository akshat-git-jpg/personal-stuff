// script.md -> script.json, the per-section feed the yt-vo engine reads.
//
// Step 100 writes script.md for humans and this file derives the machine copy,
// so the two cannot drift the way script.md + script.vo.txt would have. The
// shape is tp3's (pipelines/youtube/tutorial-pipeline-3/lib/schema.mjs) because
// pipelines/video/tts/lib/vo-synth.mjs reads exactly that shape.

// A section heading: "### 12. Pricing & Value"
const HEADING = /^###\s+(\d+)\.\s+(.+?)\s*$/
// A part heading: "## PART B — BODY"
const PART = /^##\s+PART\s+([ABC])\b/i

export const SCHEMA_ERROR = 'SECTIONS_SCHEMA_BAD'
export const SHORT_BEAT_ERROR = 'BEAT_TOO_SHORT'

// Pulls the blockquote body that follows a **Voiceover** label. Strips the
// leading "> " and the wrapping double quotes the house style uses, and joins
// wrapped lines back into paragraphs.
function readVoiceover(lines) {
  const out = []
  for (const raw of lines) {
    if (!raw.startsWith('>')) break
    out.push(raw.replace(/^>\s?/, ''))
  }
  return out
    .join('\n')
    .replace(/^\s*"/, '')
    .replace(/"\s*$/, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

// Everything after a **Notes** label until the next label or heading.
function readNotes(lines) {
  const out = []
  for (const raw of lines) {
    if (HEADING.test(raw) || PART.test(raw) || /^\*\*(Voiceover|Notes)\*\*/.test(raw)) break
    out.push(raw)
  }
  return out.join('\n').trim()
}

export function wordCount(text) {
  return String(text).split(/\s+/).filter(Boolean).length
}

// script.md text -> [{ number, title, part, display_text, notes }]
export function parseScriptMd(md) {
  const lines = String(md).split('\n')
  const beats = []
  let part = 'A'
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const p = line.match(PART)
    if (p) {
      part = p[1].toUpperCase()
      continue
    }

    const h = line.match(HEADING)
    if (h) {
      current = { number: Number(h[1]), title: h[2].trim(), part, display_text: '', notes: '' }
      beats.push(current)
      continue
    }

    if (!current) continue

    if (/^\*\*Voiceover\*\*/.test(line)) {
      current.display_text = readVoiceover(lines.slice(i + 1))
      continue
    }
    if (/^\*\*Notes\*\*/.test(line)) {
      current.notes = readNotes(lines.slice(i + 1))
      continue
    }
  }

  return beats
}

// beats -> the tp3-shaped script.json object.
//
// stage is "tts", not "polished", and every spoken_text is "". That pairing is
// deliberate and it is the only one that works: deriveSpoken (and therefore
// respell.json) only runs when spoken_text is empty, while validateScript's
// "polished" branch forbids an empty spoken_text. vo-synth accepts "tts".
export function buildScriptJson(key, beats) {
  const errors = []

  if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    errors.push(`${SCHEMA_ERROR}: key "${key}" is not a valid video key`)
  }
  if (beats.length < 3) {
    errors.push(`${SCHEMA_ERROR}: ${beats.length} sections, tp3 schema needs at least 3`)
  }

  const sections = beats.map((b, i) => {
    const id = `s${String(i + 1).padStart(2, '0')}`
    const demo = b.part === 'B'
    const words = wordCount(b.display_text)

    if (!b.display_text) {
      errors.push(`${SCHEMA_ERROR}: ${id} (${b.title}) has no Voiceover text`)
    } else if (words < 8) {
      // Never pad it to pass. A beat this short is an editorial decision.
      errors.push(`${SHORT_BEAT_ERROR}: ${id} (${b.title}) is ${words} words; the schema floor is 8`)
    } else if (words > 320) {
      errors.push(`${SCHEMA_ERROR}: ${id} (${b.title}) is ${words} words; the schema ceiling is 320`)
    }

    if (/\[(VERIFY|FILL):/.test(b.display_text)) {
      errors.push(`${SCHEMA_ERROR}: ${id} still carries a [VERIFY:/[FILL: marker`)
    }

    return {
      id,
      demo,
      display_text: b.display_text,
      spoken_text: '',
      flags: [],
      notes: b.notes,
      version: 1,
      tts: { regens_used: 0, locked: false, take: null },
      recording: { status: demo ? 'pending' : 'none' },
    }
  })

  if (!sections.some((s) => s.demo)) {
    errors.push(`${SCHEMA_ERROR}: no PART B section found, so no section has demo:true`)
  }

  return {
    script: { video: key, channel: 'main', version: 1, stage: 'tts', sections },
    errors,
  }
}
