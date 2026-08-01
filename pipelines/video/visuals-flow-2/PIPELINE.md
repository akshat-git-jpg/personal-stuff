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
| `005-configure-run-human` | [OWNER] | the owner's kickoff choices → `run-config.json` (engine heygen3\|heygen4, review full\|express, optional drive_folder/drive_account). No file = heygen3 + full review. Express waives the 037/080 board approvals ONLY — never the new-card look-preview, never 120 |
| `010-transcribe-run` | [RUN] + quality pass [RUN/LLM] | `vo.mp3` (or `vo.mp4`/`mov`/`mkv`/`m4a`/`wav` — audio auto-extracted to `vo.mp3`) + optional `script.txt` → `transcript.json` (word timestamps, cleaned — never raw ASR punctuation; script-first alignment when `script.txt` exists, else an LLM cleanup pass, both gated by `checkTimingIntegrity()`) |
| `015-map-segments-run` | [RUN] | `transcript.json` + `src/*.mp4` → `segments.json` (measured intro/body/conclusion `structure` + demo vs narration `segments`; owner sets `confirmed: true`, which promotes lint E5 from warning to error) |
| `020-choose-concept-llm` | [LLM] | `transcript.json` + `segments.json` → `concept.json` (gate `lint-concept` — required fields, anchors resolving in forward order, and ≥80% **narration** coverage by the register map; `segments.json` is what narration time is measured from) |
| `plan-skeleton` | [RUN] | `transcript.json` + `segments.json` → deterministic placement grid (the `{{SKELETON}}` prompt variable) |
| `030-pick-or-propose-graphics-llm` | [LLM] (pluggable) | `transcript.json` + `card-library/catalog.json` + `{{CONCEPT}}` → `cues.json`, **BODY ONLY**. Picks from the catalog OR proposes a card that should exist (approved at 037, built at 038) |
| `035-pick-or-propose-intro-outro-llm` | [LLM] (pluggable) | `transcript.json` + `catalog.json` + `segments.json`'s `structure` → zone cues in `cues.json`, each carrying a `zone` field. Own rulebook (`lib/zone-rules.mjs`) and own numbers (`lib/zone-constants.mjs`) — nothing shared with the body pass |
| `037-approve-card-plan-human` | [OWNER] | `cues.json` + `catalog.json` → `card-plan.json` (**REVIEW 1: Card Plan**. Every card the video uses — body AND zones — marked EXISTING or NEW-to-build, approved before anything is built or rendered. Reads `cues.json`, not `resolved.json`, so an unbuilt card is visible. Per-card and per-section notes write `zone-*` / `card-body:*` items into `feedback.json`, routed to the matching rulebook and never across) |
| `038-build-cards-llm-and-review-human` | [LLM] (Sonnet) + [OWNER] | approved NEW proposals → new cards in `card-library/<type>/<name>/` + `catalog.json` entries, committed and pushed. Skipped when nothing is NEW. **Then the owner reviews the built card**: landing it flips its plan item `new` → `existing`, which resets the 037 approval by design, so a card nobody has looked at cannot reach 090. Procedure lives in `card-library/CLAUDE.md` |
| `040-sync-graphics-run` | [RUN] | `cues.json` → `resolved.json` (absolute times + merged variables + `extendExposure`) … (+ lint gate E7/W7/W8/W9, and the zone bar W15/W16/W17/W19) |
| `050-review-graphics-llm` | [LLM] | `resolved.json` → `audit.json` (mute test) |
| `060-place-avatar-llm` | [LLM] (Sonnet default, pluggable) | approved `resolved.json` + `transcript.json` → `shots.json` (modes full/panel) |
| `080-approve-storyboard-human` | [OWNER] | `resolved.json` → approved `cues.json` + `shots.json` (**REVIEW 2: Storyboard**. Composition only — screen vs graphics vs avatar+mode, skippable on short videos. Localhost:4322 board; audit-gate blocks labelled fullframes) |
| `090-render-graphics-run` | [RUN] | approved `resolved.json` → `renders/*.mp4\|mov` + `manifest.md` (brand-inline; variant rotation) |
| `100-render-avatar-run` | [OWNER live HeyGen] | approved `shots.resolved.json` + `vo.mp3` → HeyGen template jobs → `avatar-jobs.json` + clips (kb-scratch) + `avatar-manifest.md` |
| `effects-plan` | [RUN] | `resolved.json` → `effects.json` (auto-approved — reviewed on Final Cut; register transitions, motif lane, captions default-on) |
| `sound` | [RUN] | `resolved.json` + `effects.json` → `sound.json` (auto-approved — reviewed on Final Cut) |
| `mix` | [RUN] | `vo.mp3` + `sound.json` → `master.wav` (auto-approved — reviewed on Final Cut; −14 LUFS, frame-exact) + bounces |
| `110-build-video-run` | [RUN] | `screen.mp4` + `master.wav` + `renders/` + avatar clips → `final.mp4` (freeze gap-filler, version registry) + `assembly.md` |
| `120-approve-final-cut-human` | [OWNER] | `final.mp4` → `final-cut.json` (**REVIEW 3: Final Cut**. Motion and sound review — effects, sound, pacing, captions; judged in motion) |
| `130-learn-from-feedback-opus` | [OPUS] | `videos/*/feedback.json` + chat feedback → durable edits to RULEBOOK/prompt/DESIGN.md/catalog, items marked folded (the never-repeat-a-mistake step) |
| `140-davinci-export-run` | [RUN, **OPTIONAL** — on owner request only, not a pipeline stage (decisions.md 2026-07-24)] | same inputs as 110 → layered FCPXML + music/sfx lanes + panel transforms |
| `150-deliver-drive-run` | [RUN] | approved `final.mp4` (full-res, 120-gated) → `Output/<slug>-final.mp4` in the video's own Drive folder (`run-config.json` drive_folder/drive_account; `pp-drive` upload with --overwrite) |
| qc (`scripts/qc-video.sh`) | [RUN] + [LLM read] | `final(-draft).mp4` + `assembly.md` + `effects.json` → kb-scratch `qc/` pack (checklist + event contact sheets) → session-read verdicts in committed `qc-report.md` |
| **publish templates** | [RUN] | once the video is done: `cd ../card-library && npm run publish-check` → fails on any card built for this video that is uncommitted or unpushed. Cards only reach the editor's gallery at render2.agrolloo.com once pushed (VPS `repo-sync` cron, ~15 min). See `card-library/CLAUDE.md`. |

**Step history:**
- 2026-07-29 — steps renumbered and renamed to say what they do (`place graphics` → `pick or propose graphics`, `resolve` split into `sync-graphics` and `davinci-export`, `owner` → `human`).
- 2026-07-30 — `037-approve-card-plan-human` added and `070-approve-intro-outro-human` removed: the zone-only gate became one gate over the whole video's cards. `038-build-cards-llm-and-review-human` added. The `bespoke` card path was removed entirely — every new card now goes to the shared catalog.
- 2026-07-30 — `015-map-segments-run` given a folder. The stage always existed as `lib/segments.mjs --propose`, but this table named a folder (`015-segments-propose`) that was never on disk, so its owner action (`confirmed: true`) and its outside-the-cut warning were documented nowhere a step reader would look.

(The previous old→new mapping table lived here and was destroyed by two rounds of
automated renaming rewriting both of its columns; git history is the reliable
record. Do not reintroduce a table that a path-rename sweep will silently corrupt.)

### The entry point

The driver script is the single entry point for the whole chain:

- `bash run.sh <slug> status` prints an artifact table showing where the video is and names the next step to run.
- `bash run.sh <slug> <step>` dispatches the named step.

Each `steps/NNN-*/` folder has a `README.md` that remains the detailed reference for what that step does, its exact inputs, and its exact outputs.

## What v2 adds over v1

- **A. Doctrine port + concept pre-pass**: core idea, motif, register map enforced by machine lint (spec [docs/specs/2026-07-24-visuals-flow-v2-design.md](../../../docs/specs/2026-07-24-visuals-flow-v2-design.md)).
- **B. Enacted-device card family**: ~12 new cards that *do* ideas (fill, race, stack). The flywheel is steps 037→038: a pass proposes the card it wants, the owner approves it, it is built into the shared collection, and every later video can use it.
- **C. Coverage fix + motion density**: no more orange screen via `extendExposure` + gap filler; always-on karaoke captions and motif.
- **D. Selection quality**: mute-test self-audit catches bad card picks before render.
- **E. Sound + mix stage**: semantic SFX, ducked music, −14 LUFS master (frame-exact sync).
- **F. Effects vocabulary + variants**: marker family, snap-in plates, auto-rotated layout variants for reused cards.
- **G. Per-video manifest + tokens**: `video.json` and `brand.json` make re-skinning a simple swap.
- **H. Head layout modes**: full, panel, and hidden compositing for the talking head.
- **I. Board upgrade**: Storyboard + Final Cut tabs with point-pinned notes, global playback, and version history.

## `videos/<slug>/` layout

```
videos/<slug>/
  video.json       # v2 manifest (aspect, brand, music mood, format) — committed
  run-config.json  # step 005 owner kickoff choices (engine, review mode, drive folder) — committed
  vo.mp3           # input voiceover — gitignored (regenerable from the tts hub)
  script.txt       # optional input — when present, wins as the authoritative caption text (step 010 script-first mode)
  transcript.json  # step 010 output, cleaned (never raw ASR punctuation) — committed
  transcript.<engine>-raw.bak.json  # step 010's raw ASR backup, pre-cleanup — committed
  segments.json    # step 015 output — committed
  concept.json     # step 020 output (core idea, motif, register map) — committed
  cues.llm.json    # steps 030+035's final output, pre-owner-edits — committed, immutable
  cues.json        # steps 030 (body) + 035 (zones) output, step 080 board edits — committed
  card-plan.json   # step 037 gate output — committed
  resolved.json    # step 040 output — committed
  audit.json       # step 050 mute-test output — committed
  shots.llm.json   # step 060's final output, pre-owner-edits — committed, immutable
  shots.json       # step 060 output, board edits — committed
  shots.resolved.json  # resolve-shots output (absolute times) — committed
  avatar-jobs.json     # step 100 HeyGen job tracking — committed
  effects.json         # per-instance assembly-effects manifest (node lib/effects-plan.mjs <slug>) — owner-editable, committed; see EFFECTS.md
  sound.json       # sound output, SFX placement plan — committed
  motif/               # per-video through-line assets — committed
  slices/              # per-cue vo slices, the 080 board's — gitignored
  slices-avatar/       # per-job vo slices, step 100 — gitignored
  renders/             # step 090's clips — gitignored (regenerable)
  manifest.md      # step 090 output, at the workdir root — committed
  avatar-manifest.md   # step 100 output — committed
  screen.mp4       # VO-aligned screen recording (owner-provided) — gitignored
  assembly.md      # step 110 output, the assembly EDL — committed
  qc-report.md     # filmstrip QC verdict table (qc verb output) — committed
  feedback.json    # owner feedback typed on the board (per-cue, per-gap, global) — committed
  run-log.json     # the run ledger: what each step did — committed

# Plus ~/kb-scratch/video/visuals-flow/<slug>/versions/ for Final Cut board version history
```

`references/<video-id>.md` — committed moment tables from analyzed external reference videos (feeds `EFFECTS.md`).

Per-video text artifacts (transcript, cues, resolved times, manifest) are
committed so each video's graphics data is reviewable in one place; media
(voiceover, slices, rendered clips) is regenerable and never lands in git —
same house rule as the rest of `pipelines/`.

## Source files (`src/`)

Every video's `src/` directory must contain `intro.mp4`, `body.mp4`, and `conclusion.mp4`. `intro.mp4` and `conclusion.mp4` are required, and their absence is a hard error during processing. The `structure` field in `segments.json` is derived by measuring these files, and is distinct from the `segments` array (which describes demo vs narration on screen).

## Independence

Any flow may call `lib/resolve.mjs`, `lib/render.mjs`, or `lib/board.mjs`
directly with a path argument instead of a slug — this flow's steps are not
the only caller. Full caller contract: [INTEGRATION.md](INTEGRATION.md).

## concept.json schema

This schema defines the whole-video concept.

```json
{
  "video": "<slug>",
  "thesis": "one-sentence ARGUMENT (not the topic) the whole video makes",
  "frame": "the plain-language analogy that makes the hardest idea digestible",
  "throughline": {
    "name": "short id, e.g. the-race-track",
    "description": "the recurring visual object/motif",
    "evolution": "how it changes from first to last appearance"
  },
  "registers": [
    { "from_anchor": "verbatim >=3 words", "to_anchor": "verbatim >=3 words", "register": "dark" }
  ]
}
```

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
- `marker` (optional) — in variables for marker-supporting cards, at most ONE word verbatim from the clause.
- `beats[].reveal` — the card-specific beat item (shape per catalog.json `beat_shape`, WITHOUT `at` — the resolver adds it).
- `placement` comes from catalog.json, not from the cue.
- `register` (optional) — `dark` or `light` matching the register span its anchor falls in.
- `register_why` (optional) — one-line reason if deviating from the span's register.
- `legacy_why` (optional) — one-line reason if falling back to a legacy text/reveal card instead of the enacted family.
- `motif` (optional) — boolean, true if the cue hosts the through-line motif.
- `flagged: true` — no card fits, needs a novel card (plan 065 surfaces these).
- `propose` (optional) — object, present when `card` names a card that does not exist yet. `{ does, kind, placement, beats, variables }` — what the card DOES, whether it is `single` or `beat`, how many beats, and what varies. The owner approves or kills it at 037; 038 builds what survives. A cue carrying `propose` is legal through `validateCues` but rejected by `resolveCues`, because by step 040 the card must exist.
- `kind: "word-sync"` cards (catalog) take `variables.text` (the sentence, quoted verbatim from the voiceover) and optional `variables.accent` (a phrase appearing verbatim inside `text`, rendered in the brand accent). They author **no** `beats` — the resolver derives one beat per word from `transcript.json`, so the cue's `anchor` must be the opening words of the sentence itself.
- Board feedback: every cue block, gap block, and the header carry a feedback box;
  Save writes non-empty entries to `feedback.json` (`items` keyed by cue id,
  `gap-<mm:ss>`, or `_global`). Items are objects `{text, added, folded?}`.
  The next Claude session working on the video reads it — no screenshots-to-terminal needed.
- `offset` (top-level, default 0) — seconds the VOICEOVER starts at on the editor's
  final timeline (e.g. 6.0 if a cold-open precedes it). All cue/beat times stay
  VO-relative; the offset is applied ONLY to manifest.md's "place at" column, so
  the editor always drops clips at real timeline timecodes. If the VO shifts after
  rendering, update `offset` in cues.json, re-run step 040 then 090 (or shift the
  manifest timecodes by hand — the clips themselves don't change).

Single-card cues (`kind: "single"`) have `beats: []` and use catalog `default_duration`.

## card-plan.json schema

The 037 gate. Every card the video will use, body and zones alike, marked
EXISTING or NEW-to-build — approved before anything is built or rendered.

Built from `cues.json`, **not** `resolved.json`: a cue naming a card that does
not exist yet can never reach `resolved.json`, because `resolve.mjs` refuses
unknown cards and writes nothing. The zone-only gate this replaced read
`resolved.json`, so its "NEW — to build" chip could only ever fire for a card
somebody had already hand-built.

```json
{
  "video": "notion-vs-asana",
  "approved": true,
  "sections": [
    {
      "part": "intro",
      "start": 0,
      "end": 15,
      "items": [
        {
          "id": "c01",
          "card": "title/title-versus",
          "status": "existing",
          "placement": "fullframe",
          "anchor": "welcome back everyone",
          "flagged": false,
          "proposal": null
        }
      ]
    }
  ]
}
```
- `approved`: boolean gate; `render.mjs` refuses while false (unless `--force`). Resets to false whenever the plan changes — including when 038 builds a card and its `status` flips `new` → `existing`, so the built card is looked at before it reaches a video.
- `sections`: one per `intro` / `body` / `conclusion` that has cues; empty ones are dropped. `start`/`end` appear only for the zones, which are the only parts measured from the source recordings — the body has no span.
- `items`: `status` is `existing` (found in `catalog.json`) or `new` (to be built at 038). `anchor` rather than a timestamp: this gate runs before 040 puts the plan on a clock.
- `proposal`: the structured spec of a NEW card (`does` / `kind` / `placement` / `beats` / `variables`), taken from the cue's `propose` field.

## run-config.json schema

Step 005 output — the owner's kickoff choices. Absent file = all defaults.

```jsonc
{
  "engine": "heygen3",        // heygen3 (Avatar III, free; default) | heygen4 (Avatar IV, METERED — setting it IS the owner authorization for this video)
  "review": "full",           // full (every gate; default) | express (unattended to final cut; waives 037/080 board approvals ONLY — never the new-card look-preview, never 120)
  "drive_folder": "1x-…",     // optional — the video's own Drive folder (holds Input/ and Output/); step 150 delivers into its Output/
  "drive_account": "a@b.com", // optional — pp-drive token account with write access
  "decided_at": "2026-08-01T…"
}
```

Read via `lib/run-config.mjs` (`loadRunConfig`/`gateWaived`); gates in
render/avatar-render/assemble consult it. shots.json `engineMode` must agree
with `engine` (`heygen3`⇔`test`, `heygen4`⇔`production`) — avatar-render
refuses on mismatch.

## run-log.json schema

The run ledger. It exists because `run.sh <slug> status` used to reconstruct
progress by probing for files, which can report `resolved.json present` but can
never report what a step actually did. The board's **Run** tab and `run.sh
<slug> status` render this same view, so the page and the terminal cannot
disagree.

```json
{
  "video": "<slug>",
  "updated": "2026-07-30T09:19:41.204Z",
  "steps": {
    "030-pick-or-propose-graphics-llm": {
      "status": "done",
      "started": "2026-07-30T09:12:04.881Z",
      "ended": "2026-07-30T09:19:41.204Z",
      "did": "Placed 23 body cues from the catalog, proposed 2 cards that don't exist yet.",
      "issues": "2 W7 bare-stretch warnings in the 3-4 min talking-head stretch, left as-is.",
      "output": "cues.json — 23 cues, 2 marked NEW for step 038"
    }
  }
}
```

- **Keys are step folder names**, read from `steps/` at load time. There is no
  second list to maintain, and `lib/run-log.mjs` **refuses** a key that is not a
  folder — which is what stops the same step being logged as "body cue pass" on
  one video and "body graphics LLM" on the next.
- `status`: `todo` | `running` | `done` | `blocked` | `skipped`.
- `done` **requires** `did` and `output`. A missing one is refused rather than
  written half-empty. An omitted `issues` is stored as an explicit
  `"none found"`, because a blank field must never read as "nobody checked".
- **Who writes what**: the `-run` steps record themselves through `run.sh`
  (`record_step`, which also scrapes their warning lines into `issues`); the
  three `-human` gates are recorded by the board at the moment the owner
  approves; the `-llm`/`-opus` steps are closed out by the session via
  `node lib/run-log.mjs <slug> <step> done --did … --issues … --output …`.
- **Steps with no entry fall back to probing the artifacts** and are marked
  `derived`, rendered as "inferred from the files on disk". A derived entry
  carries no summary, because none was ever written. This is what keeps videos
  that predate the ledger from showing as a blank page.

## audit.json schema

This is the mute-test audit output produced by `050-review-graphics-llm`.

```json
{
  "video": "<slug>",
  "items": [
    {
      "id": "c01",
      "verdict": "labelled",
      "fix": { "card": "<catalog-slug>|new", "how": "<one sentence>" },
      "accepted": true
    }
  ]
}
```

Field semantics:
- `verdict` — either `enacted` or `labelled`.
- `fix` — object describing the enactment to author (only for `labelled` cues).
- `accepted` (optional boolean) — the owner's explicit override, passing a labelled cue through the audit gate.

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
      "purpose": "avatar-full",
      "mode": "full",
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
- `purpose` (`avatar-full` only today; enum exists for additive future purposes. Renamed from `kind` 2026-07-31 — it says what the rendered file is FOR, distinct from `mode`, which is layout; readers still accept legacy `kind`)
- `mode` (`full` | `side` | `panel` — REQUIRED, matching `resolve-shots.mjs`; how the avatar is laid out on screen)
- `engineMode` (`test` = every span renders HeyGen 3 template; `production` = full-screen→HeyGen 4, corner→HeyGen 3 — **a validation error until the owner explicitly enables it**)
- `flagged` (parked span)
- `approved` (board gate, same lifecycle as cues.json)
- `offset` (top-level) shared meaning with cues.json

Note that the corner track is a standing output of the avatar render step, not a span.

## sound.json schema

This is the SFX placement plan generated by the `sound` verb.

```json
{
  "approved": true,
  "instances": [
    { "id": "pop-5.4", "sample": "pop", "at": 5.4, "enabled": true }
  ]
}
```

Field semantics:
- `approved`: Must be true for `mix` to proceed.
- `id`: Unique identifier, usually `{sample}-{at}`.
- `sample`: The basename of a file in `assets/sfx/` (without `.wav`).
- `at`: Absolute timeline time in seconds.
- `enabled`: Allows soft-muting instances.
