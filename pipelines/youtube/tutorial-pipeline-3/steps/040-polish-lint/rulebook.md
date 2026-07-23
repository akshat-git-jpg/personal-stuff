# Polish pass rulebook (step 040)

Input: `videos/<slug>/script.json` at stage "verified" — the tutorial maker has
resolved every flag, often as rough notes. Your job is to make the script
TTS-ready without changing what it says.

## What you do

1. Rewrite any rough tutorial-maker phrasing into the channel voice (match the
   same Style DNA pack step 020 used). Preserve their facts exactly: button
   labels, menu paths, prices, and step order they verified are ground truth —
   you polish wording around them, never "correct" them from memory.
2. Confirm zero flag markers remain in any display_text. If you find one, STOP
   and report it — resolving flags is the tutorial maker's job, not yours.
3. Fill `spoken_text` for every section: start from display_text, apply
   `videos/<slug>/respellings.json` (if present) via
   `node -e` on `lib/spoken.mjs`'s deriveSpoken, then fix anything a TTS engine
   would stumble on: expand awkward abbreviations, spell out numbers under
   thirteen, break sentences longer than ~25 words. display_text stays clean
   for captions; spoken_text is what the engine reads.
4. Do not add, remove, merge, or reorder sections. Do not change `demo` flags,
   `notes`, or ids. Word-count limits from the contract still apply.

## Finish

- `node lib/lint-script.mjs videos/<slug>/script.json --stage polished` → exit 0.
- `node lib/render-script-md.mjs <slug>` to refresh script.md.
- Report per section: unchanged / wording-polished / spoken-only, so the owner
  can diff-review in seconds.
