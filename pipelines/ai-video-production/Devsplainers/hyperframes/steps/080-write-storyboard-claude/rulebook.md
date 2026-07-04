# Rulebook — 080 write-storyboard

One scene **per beat**. Durations come from the VO, not guesses. Output
`videos/<slug>/storyboard.md`. Read `../../SPEC.md` §3 and `../../kit/atoms.md` first.

## Inputs
- `videos/<slug>/beats.md` — the ordered beats (step 020).
- `videos/<slug>/durations.json` — measured VO clip length per beat (step 060).

## Method
1. **One scene per beat, in order** — never merge or split beats here (the beat↔clip↔scene 1:1 mapping is what keeps audio in sync).
2. **Scene duration = that beat's `durations.json` value** (optionally + a tiny breath, ≤0.3s). Do not invent durations.
3. **Pick a color law up front** and state it — semantic accents carry the argument (SPEC §3): white neutral; blue/amber/red/green = this video's recurring concepts. Reuse consistently.
4. **Per scene choose a visual metaphor and map it to real kit atoms** (`atoms.md`) — don't invent atoms. Note the layout in a phrase.
5. **Name recurring characters/objects** and reuse the same atoms/positions across scenes for continuity.
6. **Flag the ONE signature beat** — the thesis moment that gets the most deliberate treatment.

## `storyboard.md` format
Header (source, style, total length, color law) + one row per scene:

| # | start | dur | VO beat (paraphrase) | Visual metaphor + layout | Kit atoms | Accent |

Then "Notes / bespoke calls" (recurring characters, signature beat, any inline icons the kit lacks).

**Required — the machine `scenes` block.** Step **090** is a deterministic parser
that reads this block; without it the pipeline stalls. At the end of the file emit a
fenced block, one `NN slug` per scene (number = beat number; `slug` = short
kebab-case scene id you choose), in order:

    ```scenes
    01 hook-sees-hears
    02 eyes-ears-removed
    03 still-works
    ```

The `slug` becomes the folder `sNN-<slug>`. Keep it 1:1 with the table rows and with `durations.json`.

## Then
Hand to **100** (human review). Iterate on text only — it's free. The machine
manifest (`scenes.json`) is produced next in step **090**; don't scaffold until the plan is approved.

Reference: `../../videos/test/storyboard.md` is a worked example.
