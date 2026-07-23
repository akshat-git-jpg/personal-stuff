# VO-first tutorial pipeline — the how; WORKFLOW.md is the why

| Step | Actor | In → Out |
|---|---|---|
| `010-inputs` | [RUN] | slug → `videos/<slug>/inputs/` skeleton (topic.md, vision.md, transcripts/) |
| `020-script-gen` | [LLM: Claude session, Sonnet default] | inputs + dossier + style DNA → `script.json` + `script.md` |
| `030-verify-tm` | [HUMAN: tutorial maker] | script.md → flag resolutions (applied back into script.json) — plan 130 |
| `040-polish-lint` | [LLM + RUN] | verified script.json → polished script.json (zero flags) — plan 130 |
| `050-publish-ui` | [RUN] | polished script.json → UI store (Worker) — plan 132 |
| `060-intake-qc` | [RUN] | Drive recordings → intake-report.md — plan 133 |
| `070-handoff-visuals` | [RUN] | locked audio + recordings → visuals-flow `videos/<slug>/{vo.mp3,screen.mp4}` — plan 133 |

```
videos/<slug>/
  inputs/topic.md        # committed
  inputs/vision.md       # committed
  inputs/transcripts/    # committed (text)
  script.json            # committed — the contract artifact
  script.md              # committed — human-readable render for the tutorial maker
  audio/                 # gitignored (locked section wavs, pulled from UI)
  recordings/            # gitignored (per-section clips from Drive)
  qc/                    # gitignored (contact sheets)
  intake-report.md       # committed (plan 133)
```

## The script.json contract (single source of truth — goes into PIPELINE.md)

```json
{
  "video": "notion-vs-asana",
  "channel": "agrollo-reviews",
  "version": 1,
  "stage": "generated",
  "sections": [
    {
      "id": "s01",
      "demo": false,
      "display_text": "Notion and Asana both promise to run your whole team...",
      "spoken_text": "",
      "flags": [],
      "notes": "",
      "version": 1,
      "tts": { "regens_used": 0, "locked": false, "take": null },
      "recording": { "status": "none" }
    },
    {
      "id": "s02",
      "demo": true,
      "display_text": "Head to the pricing page and click [VERIFY: exact upgrade button label].",
      "spoken_text": "",
      "flags": [ { "kind": "VERIFY", "note": "exact upgrade button label" } ],
      "notes": "stay on the pricing page until the section ends",
      "version": 1,
      "tts": { "regens_used": 0, "locked": false, "take": null },
      "recording": { "status": "pending" }
    }
  ]
}
```

Field rules (encode exactly these in `lib/schema.mjs`):

- `video`: matches `/^[a-z0-9][a-z0-9-]*$/`.
- `channel`: non-empty string.
- `version` (top-level and per-section): integer ≥ 1.
- `stage`: one of `"generated" | "verified" | "polished" | "tts" | "locked" | "recorded" | "qc-passed"`.
- `sections`: array, length ≥ 3.
- `id`: `/^s\d{2}$/`, strictly sequential starting at `s01` (s01, s02, ...).
- `demo`: boolean. At least one section in the file must have `demo: true`.
- `display_text`: non-empty. Word count: hard error if < 8 or > 320 words; warning
  (reported, not fatal) outside 45–170 words (≈ 20–60 s of narration).
- `spoken_text`: string; may be `""` (meaning: derive from display_text). When
  non-empty it must contain no `[VERIFY:` / `[FILL:` markers.
- `flags`: array of `{ kind: "VERIFY" | "FILL", note: non-empty string }`. Every
  inline marker in `display_text` (see flag syntax below) must have a matching
  entry with the same kind and note, and vice versa — mismatch is a hard error.
- `notes`: string (may be empty).
- `tts.regens_used`: integer ≥ 0. `tts.locked`: boolean. `tts.take`: string or null.
- `recording.status`: `"none"` (non-demo) | `"pending" | "received" | "qc-passed" | "re-record"` (demo).
  A non-demo section with status other than `"none"` is a hard error, and a demo
  section with `"none"` is a hard error.

Flag syntax inside `display_text` (encode in `lib/flags.mjs`):
`[VERIFY: <note>]` and `[FILL: <note>]`, regex
`/\[(VERIFY|FILL):\s*([^\]]+)\]/g`. `scanFlags(text)` returns
`[{ kind, note, raw }]` with `note` trimmed.

Lint stages (`lib/lint-script.mjs`):
- default (`--stage generated`): all schema rules above.
- `--stage polished`: additionally, zero flags anywhere (no inline markers, empty
  `flags` arrays) and `spoken_text` non-empty for every section.

## Section state machine

Stage order (top-level `stage`): generated → verified → polished → tts → locked
→ recorded → qc-passed. `set-stage` may only move one step forward, except the
edit rule below which moves the file backward automatically.

Per-section invariants:

1. **Text edit invalidates everything derived from the text.** Changing a
   section's `display_text` or `spoken_text` bumps `section.version`, resets
   `tts` to `{ regens_used: 0, locked: false, take: null }`, and sets
   `recording.status` to `"re-record"` if a recording was already
   `"received"`/`"qc-passed"`, else `"pending"` (demo) / `"none"` (non-demo).
2. **Lock preconditions.** A section may lock only when: `flags` is empty,
   `spoken_text` is non-empty, and `tts.take` is non-null. Locking sets
   `tts.locked = true`. There is no unlock operation — only a text edit (rule 1)
   clears a lock.
3. **Stage gates.** `stage: "tts"` requires lint `--stage polished` to pass.
   `stage: "locked"` requires every section locked. `stage: "recorded"` requires
   every demo section `recording.status` ∈ {"received","qc-passed"}.
   `stage: "qc-passed"` requires every demo section `"qc-passed"`.
