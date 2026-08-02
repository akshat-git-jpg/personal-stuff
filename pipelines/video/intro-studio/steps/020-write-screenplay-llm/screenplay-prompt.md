## Your job
write `videos/{{SLUG}}/screenplay.json` for the intro whose transcript follows. You are writing a PLAN, not HTML. Emit JSON only.

## What makes an intro good
one continuous stage rather than a sequence of slides; objects persist and transform instead of vanishing; the colour register turns with the story; the presenter's face is part of the composition, landing early. The failure mode being designed against is a slideshow of independent graphics.

## The default arc
The default arc is the seven intents in order: `hook`, `turn`, `scope`, `mech`, `stakes`, `tease`, `button`.
You can drop, merge and reorder freely when the script does not support a beat, and write `deviation_reason` on every beat when you do. An intro that fills seven slots badly is worse than one that does three things well.

## The schema
The beat object with every field, its type, and its enum:
- `id` (string): unique, ordered
- `intent` (string): one of `hook`, `turn`, `scope`, `mech`, `stakes`, `tease`, `button`
- `clause` (string): EXACT transcript words
- `t_start` (number)
- `t_end` (number)
- `register` (string): one of `dark`, `light`
- `face` (string): one of `full`, `panel`, `none`
- `stage` (string): prose
- `carries` (object or null): `{ from: "id", object: "...", as: "..." }`
- `transition_out` (string): one of `cut`, `flash`, `crossfade`, `dock`, `push`
- `deviation_reason` (string or null)

`clause` must be the EXACT words from the transcript and `t_start`/`t_end` come from the word timings, not from estimation.

## Continuity is the requirement
`carries` is not decoration. Name which earlier beat's object this beat inherits and how it transforms (shrink, dock, dim, promote, demote). At least half the beats after the first must carry something. If a beat genuinely starts fresh, `carries: null` is honest — but three of those in a row means the intro is a slideshow.

## The face
one avatar clip covers the whole intro, so the face can appear anywhere without sync concerns. `full` is full-screen, `panel` is docked, `none` is absent. It should land in the first two beats: the owner's recorded complaint was that the presenter arrived over two minutes in and it read as a surprise.

## Rules you will be linted against
| Code | Rule |
|---|---|
| E1 | Every beat's `clause`, normalised, appears as a contiguous run in the normalised transcript text. |
| E2 | `t_start`/`t_end` match the transcript word times bounding that clause, within **0.25s** on each end. |
| E3 | Beats are contiguous and gapless in order: `beats[0].t_start === 0` (±0.05), and each `beats[i].t_start === beats[i-1].t_end` (±0.05). |
| E4 | Every `id` is unique, and every `carries.from` names an EARLIER beat's id. |
| E5 | `intent`, `register`, `face`, `transition_out` are each in their enum; `stage` is a non-empty string. |
| E6 | If `followsDefaultArc(intents)` is false, EVERY beat carries a non-empty `deviation_reason`. (Deviating is legal; deviating silently is not.) |
| E7 | The last beat's `t_end` equals `introDuration` within 0.1s — the screenplay covers the whole intro. |
| W1 | At least half of the beats after the first have a non-null `carries`. **This is the continuity rule** — the whole reason this system exists. |
| W2 | `register` changes at least once across the screenplay. |
| W3 | At least one of the first two beats has `face: "full"` — the presenter lands early. |
| W4 | No beat is longer than 12s. |

## Output
write `screenplay.json` with a top-level `slug` and `beats` array, nothing else. Then stop; the owner reviews before anything is built.

Transcript:
{{TRANSCRIPT}}

Intro Duration:
{{INTRO_DURATION}}
