# 100 - write the final script

**[LLM]** &nbsp; Finalises his words into the VO-ready script.

`script-draft.md` -> `script.md` (human-readable) + `script.json` (the per-section feed step 120 reads) + `respell.json` (pronunciation). Follows `SCRIPT-INSTRUCTIONS.md`. This is a FINALISE pass over someone else's words, not a fresh write - his phrasing survives unless it is wrong.

**Reads:** `script-draft.md`, `script-plan.md`, `knowledge.md`

**Writes:** `script.md`, `script.json`, `respell.json`

---

## What happens

Read `SCRIPT-INSTRUCTIONS.md` in full. Read the approved `script-plan.md` and
`knowledge.md`. Every claim in his draft must trace back to `knowledge.md`.

Write `script.md`, then derive `script.json` from it:

```bash
cd pipelines/youtube/yt-script
node -e "
import('./lib/build-script-json.mjs').then(async (m) => {
  const fs = await import('node:fs/promises')
  const key = process.argv[1]
  const md = await fs.readFile(\`videos/\${key}/script.md\`, 'utf8')
  const { script, errors } = m.buildScriptJson(key, m.parseScriptMd(md))
  if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
  await fs.writeFile(\`videos/\${key}/script.json\`, JSON.stringify(script, null, 2) + '\n')
  console.log(\`\${script.sections.length} sections\`)
})
" <key>
```

Then write `videos/<key>/respell.json` — every word an engine is likely to get
wrong, mapped to a plain-letters respelling. `script.md` keeps normal spelling;
the map is applied at synth time, never written into the script.

If the builder reports `BEAT_TOO_SHORT`, do not pad the beat to clear it. Raise
it to the owner — a beat under 8 words is an editorial call, and the maker wrote
those words.

## Run the `humanizer` skill, in Mode A

**Required, not optional.** Owner, 2026-08-27: *"My script should not look AI
generated, so use the humanizer skill"*. The script is text a viewer will hear,
so it is third-party copy and `humanizer` governs it — the owner's global rule
already lists video scripts under that skill; this step just never said so.

**Mode A, and the mode matters more than the pass.** Mode A is *editing someone
else's draft*: read it whole, note the voice signals worth keeping, then make the
minimum effective edit. That is the same instruction as "His words, not yours"
below, arriving from the other direction. **Never Mode B here.** Mode B supplies a
voice, and this draft already has one.

**What the pass is for:** the maker may well have used AI on his own lines. Strip
the tells, keep him. Removing an AI pattern and installing your register in its
place is the failure this step guards against twice over.

The patterns that actually bite a spoken script are listed in
`SCRIPT-INSTRUCTIONS.md` under "Reading as a human". Formatting patterns
(boldface, emojis, heading case, inline-header lists) do not apply to a
`Voiceover` block, but they still apply to anything the desk or the owner reads.

## His words, not yours

This is the one big rule. He was there and you were not: he used the tool, saw
what it did, and wrote from that. Reword only what is wrong, unspeakable, or
unsupported by `knowledge.md`. Rewriting his draft into your voice throws away
the entire point of the handoff.

## Report the diff

List every line reworded, respelled or cut, and why. That list is what the owner
reads at 110.
