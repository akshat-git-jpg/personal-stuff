# intro-simple — this video needs a fresh 115 pass

`cutlist.pre-catalog.json` was authored against the deleted 7-card intro kit
(`pipelines/video/intro-kit/`). Two of its beats use that kit's `checklist`
card, whose `{icon, rows:[{text, mark}]}` yes/no device has no equivalent in
the body catalogue — `checklist/checklist` draws checkmarks only, from
`beats[].text` under a required `title`. There is no faithful mechanical
migration, and the file was never approved (`"approved": false`).

Re-author it against the shared catalogue:

    bash run.sh consistent-character-ai-animation-howto intro-simple

Kept for reference (the beat timings and the transcript-verified word lists in
its `statement` beats are still good source material). Delete it once the new
cut list is approved at gate 125.
