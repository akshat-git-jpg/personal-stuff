---
name: yt-video-edit
description: >-
  Operate the visuals-flow pipeline (pipelines/video/visuals-flow) by verb — the session runs the steps, the owner only reviews the board and green-lights live HeyGen. Verbs: run graphics for <video>, run the concept pass, audit the cues, make the sound plan, mix the audio, final cut review, run the shot pass for <video>, open my storyboard/board, render the graphics, make the avatar videos, download the avatar videos, assemble the video, export the timeline / open it in resolve, qc the video, analyze reference <url>, fold the feedback. The intro has two flows, chosen at 010 (`configure --intro simple|complex`, default simple): author the intro cut list / write the cut list (simple), check the intro pacing, render the intro, re-render the intro with the real avatar. Triggers on those phrases plus "yt-video-edit", "visuals-flow" (the old name, still accepted), "run the cue pass", "approve flow for <video>", "avatar clips for <video>", "resolve export", "filmstrip qc", "use the simple intro", "use the complex intro".
---

# yt-video-edit — operating skill (verb router)

Renamed from `visuals-flow` on 2026-08-20. The **pipeline folder is still**
`pipelines/video/visuals-flow/` — only the skill was renamed, so every path below
is unchanged.

Run everything from `pipelines/video/visuals-flow/`. This skill routes verbs to
step procedures; judgment content lives in the step rulebooks and stays there.
State of the pipeline + full command list: `README.md` and `run.sh <slug> status`. Schemas: `PIPELINE.md`.

## Guardrails (check BEFORE any verb, never skip)

1. **A workdir's name comes from the registry, never from slugifying a title.**
   Before creating `videos/<slug>/` for a video this pipeline has not seen, run
   from `pipelines/video-registry/`:

   ```bash
   KEY=$(node bin/vreg.mjs ensure <name> --title "<the video's working title>")
   node bin/vreg.mjs where "$KEY"
   ```

   `ensure` MINTS when the video is new and returns the EXISTING key when another
   pipeline (usually `yt-script`) already started it. **Use `$KEY` as the
   workdir name — it may differ from the name you proposed.** If `where` shows
   `[x]` beside `script`, the outline and script for this video already exist;
   read them before the concept pass.

   An *existing* workdir needs nothing — `resolveWorkdir` already resolves a
   registered alias to the canonical folder. This guardrail is about NAMING a new
   one. See `pipelines/video-registry/CLAUDE.md`.
2. **Pre-flight for ANY LLM pass** (concept, cue, audit or shot): `node lib/feedback-status.mjs`
   must exit 0. Non-zero = unfolded owner feedback = unapplied lessons — run the
   fold first or stop and tell the owner.
3. **Close every step in the run ledger, and name steps ONLY by their folder id.**
   The owner follows a run from the board's Run tab, not the terminal, so a step
   that is not recorded did not visibly happen. Two rules, both non-negotiable:

   - **Task names are the step folder ids**, verbatim:
     `030-pick-or-propose-graphics-llm`, never "body cue pass", "cue pass" or
     "body graphics LLM". The same step must read identically on every video.
     `node lib/run-log.mjs <slug>` prints the full list.
   - **Every `-llm` / `-opus` step you run gets closed out** the moment it
     finishes, before you move on:
     ```
     node lib/run-log.mjs <slug> 030 running
     node lib/run-log.mjs <slug> 030 done \
       --did "Placed 23 body cues from the catalog, proposed 2 cards that do not exist yet." \
       --issues "2 W7 bare-stretch warnings in the 3-4 min talking-head stretch, left as-is." \
       --output "cues.json — 23 cues, 2 marked NEW for step 038"
     ```
     `did` and `output` are required; a missing one is refused rather than
     written half-empty. Omitted `issues` becomes an explicit "none found", so
     never omit it when there WERE issues. Write plain sentences the owner can
     read cold, not counts.

   The `-run` steps record themselves through `run.sh`. The three `-human` gates
   are recorded by the board when the owner approves. You are responsible only
   for the model-run steps.

4. **130 feedback-fold is Opus-class ONLY.** If the current session is not
   Opus-class, refuse the fold verb and say why.
5. **Live HeyGen: Avatar III test renders are pre-authorized** (owner rule
   2026-07-24 — Avatar III unlimited mode is free): sessions may submit
   Avatar III for TESTING without asking each time. Anything metered
   (Avatar IV, generative credits) and production renders stay owner-run —
   explicit ask in THIS conversation. Never submit from a cron. Download is
   safe to re-run.
6. **`engineMode` defaults to `"test"` (Avatar III, free); `"production"`
   (Avatar IV, METERED) is implemented (2026-08-01) but only ever set on the
   owner's explicit ask, per video.** The owner may ask for either engine
   mid-flow — "use heygen 3" / "use heygen 4": set `engineMode` in
   `shots.json` (test|production), re-run `node lib/resolve-shots.mjs`, then
   submit; or override one submit run with
   `node lib/avatar-render.mjs <slug> --submit --engine heygen3|heygen4`.
   Before any heygen4 batch: `heygen-web limits` must cover the total span
   seconds, and note IV bills at render COMPLETION (submit-time meter always
   reads UNLIMITED). Never flip to production yourself.
7. **Snapshot before owner edits**: after a cue/shot pass converges, copy the
   final LLM output to `cues.llm.json` / `shots.llm.json` (committed, immutable).
7a. **The intro has two flows. Check which one before touching an intro step.**
   `bash run.sh <slug> status` prints `intro flow: simple|complex`, and it comes from
   `introMode` in `run-config.json` (set at 010 with
   `configure --intro simple|complex`; the default is **simple**).
   - `simple` — steps 115 (author the cut list) → 125 (owner gate) → 135 (render).
     The simple flow now picks cards from the body card catalogue (`pipelines/video/card-library/catalog.json`). You pick and fill;
     you never design. Rulebook: `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`.
     Taste: `TASTE-SIMPLE.md`. Pacing is ENFORCED by `lib/intro-kit/lint-cutlist.mjs`.
   - `complex` — steps 110 → 120 → 130 → 140 → 150 → 160, the bespoke film, unchanged.
     Rulebooks: `IDEA-PASS.md`, `AUTHORING.md`. Taste: `TASTE-INTRO.md`.

   Never run a step from the other flow's lane. The step registry already refuses
   (`modes` in `step.json`), but a session that reads the wrong rulebook wastes the run.

   **The intro's "full creative freedom" applies to `complex` only** — the `simple`
   flow now picks cards from the body card catalogue (`pipelines/video/card-library/catalog.json`); there is no composition to design, only
   a card and its variables to pick per beat.
7b. **Look-preview prompts go to a FILE, never into the chat.** Both gates that
   approve a look from generated frames — 110 (competing intro directions, `complex`
   mode only) and 240 (new-card look, owner rule 2026-07-31) — author their prompts as markdown:
   `videos/<slug>/intro-film/idea-previews/<idea-id>.md` and
   `videos/<slug>/card-previews/<card-slug>.md`. Then run
   `bash run.sh <slug> previews`, which pushes them to the `flow-queue` relay so
   the ZAPI FLOW extension loads them into Google Flow with nothing to copy.
   Format: `tooling/cli/flow-queue/README.md`. **This removes the copy-paste,
   not the gate — you still WAIT for the owner's verdict.**
8. Never edit RULEBOOK/prompt/DESIGN/catalog/lint constants mid-run — rule
   changes go through the 130 fold, not through operating sessions.
9. **If the owner says this session owns ONE track, obey the track boundary.**
   After 050 the flow splits into two tracks that share no artifact — `intro`
   and `main` (everything else) — and they are meant to be run by two sessions
   at once. The `intro` track's own step range is mode-dependent (both flows
   declare `"track": "intro"` in their `step.json`): `110-160` in `complex`
   mode (the bespoke film, unchanged), `115`/`125`/`135` in `simple` mode. Every
   `step.json` declares its `track`; see your own lane with `bash run.sh <slug>
   status --track intro|main`. Four rules, none of them enforced by code:
   - **Only the MAIN session runs git.** A `git add -A` from the intro session
     sweeps the other's in-flight files and races `index.lock`. The intro
     session writes only under `videos/<slug>/intro-film/` (`complex`) or
     `videos/<slug>/intro-simple/` (`simple`); main commits it.
   - **Never launch a second board.** One board serves both tracks (it reads
     from disk per request and `?video=` re-points it). `lib/board.mjs` now
     reuses a live board on 4322 — do not work around that.
   - **Never write a file while your own gate is open on the board**, which
     writes approvals into `cues.json`/`shots.json`/`screenplay.json`/
     `intro-simple/cutlist.json`.
   - **The intro session STOPS at the last intro-track step**: `160` in
     `complex` mode, `135` in `simple` mode. `440`/`445` (the shipping encode
     with the real avatar) is `main`, because it needs 430's output.

   Full contract + copy-paste kickoff prompts:
   `pipelines/video/visuals-flow/docs/two-session-kickoff.md`.

## Verb Map

**Review model — mode-dependent: FIVE human steps in `simple` mode, SIX in
`complex` (plan 221; verified against `run.sh` and `steps/` on 2026-08-22).**
This section used to say "three owner gates" numbered 037 / 080 / 120. All
three numbers predate the phase renumber, the card-plan gate it called Gate 1
was deleted by plan 195, and three real gates were missing entirely. The
owner noticed before the doc did: a session working from this list looks like it
is asking for the same review over and over, because it cannot name the gate it
is actually at. The table below IS the contract, and `ls steps/ | grep human` is
the check that keeps it honest — it now lists SEVEN folders on disk (010, 120,
125, 150, 340, 420, 530), because 120/150 (`complex`) and 125 (`simple`) both
exist, but a `step.json`'s `modes` field means only one of the two intro rows
ever fires for a given video.

| Step | What the owner does | Kind | Mode |
|---|---|---|---|
| `010-configure-run-human` | Engine, Drive folder, **and the intro flow** | setup, not a review | both |
| `120-approve-intro-idea-human` | Picks one proposed intro direction | review | complex |
| `150-approve-intro-film-human` | Approves the built intro film | review | complex |
| `125-approve-intro-simple-human` | Approves the cut intro (player + beat table) | review | simple |
| `340-approve-storyboard-human` | Cards, on-card text, avatar placement | review | both |
| `420-propose-avatar-human` | Picks character + model | **spend gate** | both |
| `530-approve-final-cut-human` | The assembled cut, judged in motion | review | both |

None is skippable. **Express review no longer exists** — `--review full|express`
was removed by plan 194 (2026-08-07) and `configure` takes `--engine` only. Any
memory of a mode that waives 340 is stale; 340's own README says MANDATORY GATE,
never skipped, never waived, because skipping it pushes card-choice errors into
the final cut where each one costs a full re-render.

**The engine choice at 010 authorises the avatar spend.** `heygen3` is free
(Avatar III unlimited); `heygen4` is METERED. Sessions set shots.json
`engineMode` from it (`heygen3`⇔`test`, `heygen4`⇔`production`) and
avatar-render refuses on mismatch. **The character approved at 420 IS the render
template** — never pass `--template` to override it; avatar-render now refuses a
`--template` that disagrees with the approved plan.

**Which cards get built is no longer a gate.** `235-build-card-plan-run` is a
machine step. A NEW card still stops the flow for the owner's look-preview
before any card code is written, but there is no separate card-plan approval.

**340 — Storyboard (COMPOSITION review).** The owner reviews and
finalises the whole plan before ANY render:
- where an avatar appears, and **which avatar variation** each span uses
  (full screen / bubble / panel / side view / avatar with motion graphics)
- where motion graphics appear, and **which card** each one uses
- the **text on every card**

The shot pass (320) therefore runs BEFORE this gate, not after — avatar spans
must be on the board when the owner reviews. Nothing renders until the owner
approves both `cues.json` and `shots.json`.

**530 — Final Cut (OUTPUT review).** The assembled draft, which must contain
**everything the final video will have** — graphics, avatar layer, effects,
sound, captions. Judged in motion, timestamped comments, versions, live
check-off. It is not a plan review: plan-class defects should already be gone.

Between the gates the session runs unattended: render → avatar renders → cut.

| Phrase | `run.sh` verb / CLI | Owner Gate / Behavior |
|---|---|---|
| "where are we", "what's the status", "show me the run" | `bash run.sh <slug> status` (or the board's **Run** tab) | reads `run-log.json`; steps with no entry are labelled as inferred |
| "use heygen 3/4", "set up the run" | `bash run.sh <slug> configure --engine heygen3\|heygen4` | **010 kickoff config** — see Review model above. There is no `--review` flag; express was removed by plan 194 |
| "use the simple intro", "use the complex intro" | `bash run.sh <slug> configure --intro simple\|complex` | **010**; default `simple` |
| "author the intro", "write the cut list" | `bash run.sh <slug> intro-simple` | 115; prints `SIMPLE-PASS.md` (simple mode only) |
| "check the intro pacing" | `bash run.sh <slug> intro-simple-lint` | S1-S7 (`lib/intro-kit/lint-cutlist.mjs`); errors, not warnings |
| "render the intro" | `bash run.sh <slug> intro-simple-render` | 135 |
| "re-render the intro with the real avatar" | `bash run.sh <slug> intro-simple-rerender` | 445 |
| "map the segments", "propose segments" | `bash run.sh <slug> segments` | writes `structure` + `segments`; owner then sets `confirmed: true`. 035 refuses without `structure` |
| "run graphics", "run the concept pass" | `bash run.sh <slug> concept-pass` | |
| "run the cue pass" | `bash run.sh <slug> cue-pass` | authors the BODY only |
| "run the zone pass", "do the intro and outro" | `bash run.sh <slug> zone-pass` | authors the INTRO + CONCLUSION only, own rulebook |
| "check the cues", "validate the plan" | `bash run.sh <slug> validate` | pre-037; tolerates cards 038 has not built yet |
| "show me the card plan", "outline the cues" | `bash run.sh <slug> outline` | text view of the 037 plan |
| "approve the cards", "card plan" | `bash run.sh <slug> card-plan` then `board` | **037 card plan approval** |
| "build the new cards" | step 038 — see `steps/038-build-cards-llm-and-review-human/README.md` | only when 037 left something NEW |
| "audit the cues" | `bash run.sh <slug> audit` | |
| "run the shot pass" | `bash run.sh <slug> shot-pass` | |
| "open my board", "open my storyboard", "final cut review" | `bash run.sh <slug> board` | **080 storyboard approval** or **120 final cut approval** |
| "render the graphics" | `bash run.sh <slug> render` | |
| "make the avatar videos" | `bash run.sh <slug> avatar` | **100 live HeyGen** |
| "make the cut", "cut the video" | `bash run.sh <slug> cut` | |
| "make the sound plan" | `bash run.sh <slug> sound` | |
| "mix the audio" | `bash run.sh <slug> mix` | |
| "assemble the video" | `bash run.sh <slug> assemble` | Prints board URL for final cut |
| "export the timeline", "resolve export" | `bash run.sh <slug> export` | **on-request only** |
| "deliver the final", "upload to drive", "ship it to the output folder" | `bash run.sh <slug> deliver` | **150** — uploads the approved full-res final to the video's Drive `Output/` folder; needs `drive_folder`+`drive_account` in run-config (005); 120 approval re-checked, never waived |
| "qc the video", "filmstrip qc" | `bash run.sh <slug> qc` | |
| "fold the feedback", "feedback is done", "I'm done reviewing" | **invoke the `yt-video-edit-feedback` skill** (it wraps `bash run.sh <slug> fold`) | **130 fold** |
| "queue the previews", "send the prompts to flow" | `bash run.sh <slug> previews` | pushes the 110 intro-idea and 240 new-card look prompts to the `flow-queue` relay; the ZAPI FLOW extension loads them into Google Flow by itself |
| "analyze reference <url>" | `bash scripts/analyze-reference.sh <url>` | |
