import re

# 7a: SIMPLE-PASS.md
with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/SIMPLE-PASS.md', 'r') as f:
    simple_pass = f.read()

pattern = r'## The 7 cards.*?## The pacing targets'
replacement = """## Pick from the body card catalogue — the same one the cue pass uses

There is no intro card set. `pipelines/video/card-library/catalog.json` is the
ONE catalogue for the intro and the body (owner decision 2026-08-23), and every
card in it is available to you. A slug is always `"<type>/<card>"` —
`slate/kinetic-sentence`, never `kinetic-sentence`.

Read `catalog.json` and pick per beat. Each entry tells you everything you
need:

| Field | What it means for you |
|---|---|
| `purpose` | one line on what the card is for — this is your selection signal |
| `placement` | `overlay` cards may ONLY be used with `kind: "overlay"`; `fullframe` cards ONLY with `kind: "card"` |
| `variables` | `vars` must contain every entry with `"required": true`, and nothing outside the whole list |
| `beat_shape` | present on beat cards: the shape of each element of `vars.beats[]` |
| `max_beats` | the cap on `vars.beats[]` length |
| `default_duration` | the length the card's motion was designed for — see the truncation note below |

`vars.beats[]` elements may additionally carry `at` (seconds, rebased to the
beat's own start), which is the cut list's own field and is not in any
`beat_shape`.

**Never set `duration`.** The renderer computes it from `t_end - t_start` and
injects it; lint code `S4 renderer-owned-var` refuses a cut list that sets one.

If nothing in the catalogue expresses a beat, use `slate/kinetic-sentence` —
one spoken sentence, word by word, on the ambient canvas. It always works, and
it is the direct replacement for the old kit's `statement`.

### The four cards that came from the old intro kit

These were the intro kit's own devices and are now ordinary body cards, so the
body may use them too:

| Slug | Purpose |
|---|---|
| `tool-icon/logo-grid` | "too many tools" — real logos, then the line lands and they dim |
| `enacted/shot-float` | generated stills or screenshots as evidence while the line runs |
| `enacted/ui-mock` | a stylised app window around a screenshot, in an ok or a fail state |
| `process/chain` | N labelled inputs converging on one named output |

They are the only cards that scale their motion to the beat length.

### Truncation: expect it, report it, do not work around it

Body cards hard-code their motion schedule in absolute seconds against a
`default_duration` of 4–15s, while an intro beat runs 1.5–4.0s. A body card in
an intro therefore plays its entry animation and is cut off part-way through
its idle motion. The owner accepted this on 2026-08-23 rather than retrofitting
every body card up front.

`intro-simple-lint` prints a `NOTICE truncation:` line per beat that runs under
60% of its card's `default_duration`. Notices are NOT errors and never fail the
lint. **Do not lengthen a beat past its transcript line to silence one** — the
cut length comes from the words being spoken, and `S3` caps it at 4.0s anyway.
Leave the notices; they are the owner's list of what to look at in the render.

## The pacing targets"""

simple_pass = re.sub(pattern, replacement, simple_pass, flags=re.DOTALL)
with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/SIMPLE-PASS.md', 'w') as f:
    f.write(simple_pass)

# 7b: README.md
with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/README.md', 'r') as f:
    readme = f.read()

readme = readme.replace("the locked kit of 7 (`../intro-kit/kit.json`)", "the shared body catalogue (`../../../card-library/catalog.json`)")
readme = readme.replace("| `../intro-kit/kit.json` | plan 219's locked 7-card kit (the schema) |", "| `../../../card-library/catalog.json` | the shared card catalogue — the schema for every card the intro may use |")

with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/README.md', 'w') as f:
    f.write(readme)

# 7c: step.json
with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/step.json', 'r') as f:
    step = f.read()

step = re.sub(r'"summary":\s*"[^"]+"', '"summary": "`transcript.json` + `segments.json` + `concept.json` + `../card-library/catalog.json` → `intro-simple/cutlist.json`. Runs only when `run-config.json` has `introMode: \\"simple\\"`. Picks a card slug per beat from the shared body catalogue and fills its variables — it never writes HTML. Approved at 125, rendered at 135."', step)

with open('pipelines/video/visuals-flow/steps/115-author-intro-simple-llm/step.json', 'w') as f:
    f.write(step)
