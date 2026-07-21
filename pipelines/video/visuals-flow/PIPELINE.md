# visuals-flow

Beat-synced motion graphics for a video: word-timestamp transcription → LLM cue
pass → anchor resolver → owner storyboard review → batch render + editor
manifest. Everything except the cue pass is scripted and costs zero tokens.
Cards themselves (the Hyperframes compositions + `catalog.json`) live in
`../card-library/`, which this flow treats as a read-only source of truth.

**Current state + open items for the next phase: [HANDOFF.md](HANDOFF.md).**
**Shareable style guide for the human editor's hand-built graphics: [EDITOR-STYLE-GUIDE.md](EDITOR-STYLE-GUIDE.md).**

## The flow (run top to bottom)

| Step | Actor | In → Out |
|---|---|---|
| `010-transcribe-run` | [RUN] | `vo.mp3` (or `vo.mp4`/`mov`/`mkv`/`m4a`/`wav` — audio auto-extracted to `vo.mp3`) → `transcript.json` (word timestamps) |
| `015-segments-propose` | [RUN] | `transcript.json` → `segments.json` (demo vs narration segments) |
| `020-cue-pass-llm` | [LLM] (pluggable: Sonnet default; agy/Antigravity allowed as form-fillers) | `transcript.json` + `card-library/catalog.json` → `cues.json` |
| `030-resolve-run` | [RUN] | `cues.json` → `resolved.json` (absolute times + merged variables) … (+ lint gate) |
| `040-storyboard-review-owner` | [OWNER] | `resolved.json` → approved `cues.json` (localhost:4322 board: full-script timeline, transcript + inline cue previews + mini-map, per-cue playback; board default = horizontal timeline overview, List toggle = the per-cue detail view) |
| `050-render-run` | [RUN] | approved `resolved.json` → `renders/*.mp4\|mov` + `manifest.md` |
| `070-shot-pass-llm` | [LLM] (Sonnet default, pluggable) | approved `resolved.json` + `transcript.json` → `shots.json` (full-screen avatar spans; corner+screen-rec is the implicit baseline) |
| `080-avatar-render-run` | [RUN] | approved `shots.resolved.json` + `vo.mp3` → HeyGen template jobs → `avatar-jobs.json` + clips (kb-scratch) + `avatar-manifest.md` |
| `090-assemble-run` | [RUN] | `screen.mp4` + `vo.mp3` + `renders/` + avatar clips (`avatar-jobs.json`) → `final.mp4` (kb-scratch) + `assembly.md` |
| `095-resolve-export-run` | [RUN] | same inputs as 090 → `resolve-export/` in kb-scratch (`timeline.fcpxml` + segment clips) for human touch-up in DaVinci Resolve / Premiere; default = native layered project (spec docs/specs/2026-07-21-native-editor-export-design.md), --baked = pre-encoded WYSIWYG |
| qc (`scripts/qc-video.sh`) | [RUN] + [LLM read] | `final(-draft).mp4` + `assembly.md` + `effects.json` → kb-scratch `qc/` pack (checklist + event contact sheets) → session-read verdicts in committed `qc-report.md` |
| `060-feedback-fold-opus` | [OPUS] | `videos/*/feedback.json` + chat feedback → durable edits to RULEBOOK/prompt/DESIGN.md/catalog, items marked folded (the never-repeat-a-mistake step) |
| **publish templates** | [RUN] | once the video is done: `cd ../card-library && npm run publish-check` → fails on any card built for this video that is uncommitted or unpushed. Cards only reach the editor's gallery at render2.agrolloo.com once pushed (VPS `repo-sync` cron, ~15 min). See `card-library/CLAUDE.md`. |

Each `steps/NNN-*/` folder has a `README.md` (purpose, exact command, in →
out); the four scripted steps also have a thin `run.sh` wrapper.

## `videos/<slug>/` layout

```
videos/<slug>/
  vo.mp3           # input voiceover — gitignored (regenerable from the tts hub)
  transcript.json  # step 010 output — committed
  segments.json    # step 015 output — committed
  cues.llm.json    # step 020's final output, pre-owner-edits — committed, immutable
  cues.json        # step 020 output, step 040 edits — committed
  resolved.json    # step 030 output — committed
  shots.llm.json   # step 070's final output, pre-owner-edits — committed, immutable
  shots.json       # step 070 output, board edits — committed
  shots.resolved.json  # resolve-shots output (absolute times) — committed
  avatar-jobs.json     # step 080 HeyGen job tracking — committed
  effects.json         # per-instance assembly-effects manifest (node lib/effects-plan.mjs <slug>) — owner-editable, committed; see EFFECTS.md
  slices/              # per-cue vo slices, step 040's board — gitignored
  slices-avatar/       # per-job vo slices, step 080 — gitignored
  renders/             # step 050's clips — gitignored (regenerable)
  manifest.md      # step 050 output, at the workdir root — committed
  avatar-manifest.md   # step 080 output — committed
  screen.mp4       # VO-aligned screen recording (owner-provided) — gitignored
  assembly.md      # step 090 output, the assembly EDL — committed
  qc-report.md     # filmstrip QC verdict table (qc verb output) — committed
  feedback.json    # owner feedback typed on the board (per-cue, per-gap, global) — committed
```

`references/<video-id>.md` — committed moment tables from analyzed external reference videos (feeds `EFFECTS.md`).

Per-video text artifacts (transcript, cues, resolved times, manifest) are
committed so each video's graphics data is reviewable in one place; media
(voiceover, slices, rendered clips) is regenerable and never lands in git —
same house rule as the rest of `pipelines/`.

## Independence

Any flow may call `lib/resolve.mjs`, `lib/render.mjs`, or `lib/board.mjs`
directly with a path argument instead of a slug — this flow's steps are not
the only caller. Full caller contract: [INTEGRATION.md](INTEGRATION.md).

## cues.json schema

This is the interface plans 064 (writes it) and 065 (edits it) build against. Change it in one place only — this README — and update both consumers.

```json
{
  "video": "notion-vs-asana",
  "approved": false,
  "offset": 0,
  "cues": [
    {
      "id": "c01",
      "card": "pros-cons/pros-cons",
      "anchor": "let's look at the pros",
      "lead": 0.5,
      "hold": 3.0,
      "variables": { "title": "Notion" },
      "beats": [
        { "reveal": { "kind": "pro", "text": "Unlimited free tier" }, "anchor": "the free tier alone" },
        { "reveal": { "kind": "con", "text": "Slow on mobile" },      "anchor": "the mobile app crawls" }
      ],
      "flagged": false
    }
  ]
}
```

Field semantics:

- `anchor` — verbatim transcript phrase (≥3 words) where the cue/beat lands.
- `lead` — seconds the card starts before its anchor (default 0.5).
- `hold` — seconds held after the last beat (default 3.0).
- `variables` — card variables excluding beats.
- `logo` / `productLogos` (optional) — in variables or beats, a registry slug for a tool logo.
- `beats[].reveal` — the card-specific beat item (shape per catalog.json `beat_shape`, WITHOUT `at` — the resolver adds it).
- `placement` comes from catalog.json, not from the cue.
- `flagged: true` — no card fits, needs a novel card (plan 065 surfaces these).
- `kind: "word-sync"` cards (catalog) take `variables.text` (the sentence, quoted verbatim from the voiceover) and optional `variables.accent` (a phrase appearing verbatim inside `text`, rendered in the brand accent). They author **no** `beats` — the resolver derives one beat per word from `transcript.json`, so the cue's `anchor` must be the opening words of the sentence itself.
- Board feedback: every cue block, gap block, and the header carry a feedback box;
  Save writes non-empty entries to `feedback.json` (`items` keyed by cue id,
  `gap-<mm:ss>`, or `_global`). Items are objects `{text, added, folded?}`.
  The next Claude session working on the video reads it — no screenshots-to-terminal needed.
- `offset` (top-level, default 0) — seconds the VOICEOVER starts at on the editor's
  final timeline (e.g. 6.0 if a cold-open precedes it). All cue/beat times stay
  VO-relative; the offset is applied ONLY to manifest.md's "place at" column, so
  the editor always drops clips at real timeline timecodes. If the VO shifts after
  rendering, update `offset` in cues.json, re-run step 030 then 050 (or shift the
  manifest timecodes by hand — the clips themselves don't change).

Single-card cues (`kind: "single"`) have `beats: []` and use catalog `default_duration`.

## shots.json schema

This README is the schema's single home (same one-place rule as cues.json).

```json
{
  "video": "<slug>",
  "approved": false,
  "engineMode": "test",
  "spans": [
    {
      "id": "s01",
      "kind": "avatar-full",
      "from_anchor": "verbatim first words of the span",
      "to_anchor": "verbatim last words of the span",
      "note": "why this is a host moment",
      "flagged": false
    }
  ]
}
```

Field semantics:
- `from_anchor`/`to_anchor` (verbatim, ≥3 words, forward order; span = first word of from_anchor → last word of to_anchor)
- `kind` (`avatar-full` only today; enum exists for additive future kinds)
- `engineMode` (`test` = every span renders HeyGen 3 template; `production` = full-screen→HeyGen 4, corner→HeyGen 3 — **a validation error until the owner explicitly enables it**)
- `flagged` (parked span)
- `approved` (board gate, same lifecycle as cues.json)
- `offset` (top-level) shared meaning with cues.json

Note that the corner track is a standing output of the avatar render step, not a span.
