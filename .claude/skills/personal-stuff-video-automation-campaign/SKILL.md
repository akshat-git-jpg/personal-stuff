---
name: personal-stuff-video-automation-campaign
description: Use when working on the multi-channel VO-first video factory — pipelines/youtube/final-workflow/ scale-up: productizing the processor (one-command TTS, script-fix stage, thumbnails), the title/thumbnail CTR loop, final-video QC, topic-selection wiring, analytics feedback, affiliate-link step, or the step-135 motion-graphics rulebook. Also before touching pipelines/video/tts or pipelines/video/heygen flows, or proposing any TTS/sync/avatar/graphics approach for YouTube production.
---

# Video-factory campaign — scale the VO-first final workflow

**Attended sessions only.** Phases 1c, 2, 3, and 4 carry OWNER GATE markers — explicit owner decisions recorded in `decisions.md` before their plan is written. If running unattended (cron, boss crew, `claude -p`): execute only up to the next OWNER GATE, then stop and report — never guess the owner's answer to unblock yourself.

**Background first:** if you're new to this domain (voice-cloning, why the sync math works, lip-sync/GPU economics), read the sibling skill `video-and-tts-reference` before executing. That skill is the theory; this one is the executable campaign.

## What changed (why this skill was rewritten 2026-07-12)

The old campaign (voice↔video sync + tutorial pipeline v3) is **resolved or retired**:

- **Sync is solved by decision, not code.** The final workflow is **VO-first** (SYNC-PROBLEM.md's option C): the processor generates the TTS voiceover FIRST; the tutorial maker records the screen while listening to it. New videos are synced by construction (decisions.md 2026-07-12). Do NOT re-solve sync.
- **Plan 011 is DONE** (verified 2026-07-12 — 105/125/162 implemented, 125 fixture reproduces 1.11/1.00/flag). Open remnants: the step-135 rulebook stub (Phase 7 below) and 162's avatar/graphics overlay passes (PIPE-01, still blocked on real HeyGen downloads — `lib/heygen.py` `TODO[HNS]` stubs verified present 2026-07-12).

The campaign target is now **scaling `pipelines/youtube/final-workflow/`** — the multi-channel production line (both channel categories: big review/comparison AND how-to). Roles: tutorial maker (script + screen recording) → reviewer ($150/mo, SCRIPT only) → **processor (a manual admin Claude session: script fix, TTS, avatar, thumbnail — the throughput bottleneck)** → video editor. Doc of record: `pipelines/youtube/final-workflow/final-workflow-notes.md` (workflow, cost table, the 7 open problems). This skill is the executable campaign over those 7 problems, in priority order.

## Success metrics (never judge by eye)

| Metric | Now (2026-07-12) | How measured |
|---|---|---|
| Videos/month | 12 (stuck — processor-bound) | tutorial-tracker-app cards published/mo |
| $/video | ~$48 at 12/mo (→ $43.83 at 18, $40.50 at 30 — reviewer share is the volume lever) | cost table in final-workflow-notes.md |
| Processor-hours/video | unmeasured — **baseline it via the protocol below before claiming any improvement** | "Processor time log" table in final-workflow-notes.md (protocol below) |

Cost context (as of 2026-07-12): ~$48/video at 12/mo; reviewer share ($150/mo ÷ volume) is the only pure volume lever; target <$10/video. Full cost table: **video-and-tts-reference** + `pipelines/youtube/final-workflow/final-workflow-notes.md`. If fal-lipsync is ever adopted, subtract ~$3.25/video — but see the fence below.

**Exit horizon (owner-calibrated 2026-07-12):** "beyond state of the art" for this project = autonomy + cost, not raw throughput. After videos/mo unsticks, the promotion path is (a) **autonomy** — widen past the read-only-first unattended policy (decisions.md 2026-07-11) only after ≥4 clean weeks, one class at a time; and (b) **cost** — toward <$10/video, where fal-lipsync un-deferral is the primary lever but remains OWNER-DEFERRED as of 2026-07-12: keep it fenced, do not build it; re-raise it only as a decision for the owner.

### Processor-hours baseline protocol (run at the start of Phase 1)

The bottleneck metric gets a mechanical protocol, not a vibe:

1. **Where it lives:** the operator adds a `## Processor time log` section to `pipelines/youtube/final-workflow/final-workflow-notes.md` (this campaign instructs that edit; it doesn't exist yet as of 2026-07-12) with this exact header:

   ```
   | Date | Video slug | Step | Minutes |
   |---|---|---|---|
   ```

2. **What a row looks like** — one row per step per processor session, wall-clock minutes; `Step` is one of `script-fix` / `tts` / `avatar` / `thumbnail`:

   ```
   | 2026-07-15 | notion-vs-asana | tts | 35 |
   ```

3. **Gate:** Phase 1 sub-builds may ship at any time, but NO phase may be declared an improvement until ≥3 videos have complete baseline rows (all four steps) to compare against. "Feels faster" is not a measurement.

## Change control (every phase)

No phase's build work happens inline in a chat session. Route: `orchestrate` skill → plan file in `plans/` → `/secretary raise` → boss dispatch (see **personal-stuff-change-control**). Never pick the executor model unilaterally: routing comes from `tooling/boss/data/rules.md` (orchestrate stamps the plan's `executor`/`model` frontmatter; agy runs use Gemini 3.1 Pro (High)) — a boss build was once wrongly forced onto Claude; don't repeat it. Phases marked **OWNER GATE** need an explicit owner decision recorded in `decisions.md` before the plan is written. De-risk anything unproven with a small paid/timed test first (see **personal-stuff-research-methodology**); evidence bar for "done" per **personal-stuff-validation-and-qa**.

## Phase 1 — productize the processor (open problem #1, do this first)

**Entry:** always — this is the default starting point; it is why 12/mo is stuck.
**First:** read `final-workflow-notes.md` problem #1, then start the processor-hours baseline protocol (above) — sub-builds may proceed in parallel with baselining, but no improvement claim until ≥3 videos have baseline rows.

Three sub-builds (each its own plan; independent, any order):

- **1a. TTS one-command run.** Read `pipelines/video/tts/CLAUDE.md` (hub conventions + "Target deployment") and `pipeline/run.py`. **Expected observation:** the existing pipeline is dub-shaped — `run.py --video --segments --engine` needs a Whisper `segments.json` with timestamps and anchors clips to them. VO-first has NO source video: the needed entry is script-text → chunk → Modal synth (`modal/indextts2_app.py`, per-segment `{id,text}`) → gap-joined voiceover, no anchoring. **Gate:** if a plain-script path already exists → thin wrapper plan; if not (expected) → plan the script→VO entry point. Output goes to `~/kb-scratch/video/tts/final-workflow/` + a row in `video/tts/OUTPUTS.md`; voice by slug from `REFERENCES.md` (production slug: `jamila-30s` — that's the slug, `jamila-walking-30s.wav` is its file). OUTPUTS.md is header-only as of 2026-07-12 (no rows to copy conventions from), so match its 6 columns exactly — example row: `| 2026-07-15 | final-workflow/notion-vs-asana-vo.mp3 | final-workflow | IndexTTS-2 (Modal) | jamila-30s | script-lock v2; first VO-first run |`. The editor-UI/VPS deployment in the tts CLAUDE.md "Target deployment" section is the stretch goal, CLI first.
- **1b. Script-fix as a pipeline stage.** Today "processor fixes/updates script" is ad-hoc chat. Write it as a rulebook'd stage — prior art: `pipelines/youtube/tutorial-pipeline-2/3-scripting/` (030 transcript-clean, 040 polish). Quality-setting step → Sonnet-in-Claude-Code (decided routing, decisions.md 2026-07-05). Include the free quality lever from the notes: Claude first-pass review against the tool's dossier so the $150 reviewer reviews a diff, not raw drafts.
- **1c. Thumbnail generation — the only piece with NOTHING built for this workflow.** Prior art: `pipelines/youtube/explainer-videos-pipeline-1/6-thumbnail/010-generate-thumbnail-opus/rulebook.md` (style-DNA-driven, runs on Opus). **OWNER GATE:** model routing — that rulebook runs Opus per-video, which conflicts with "Opus/Fable stay OUT of the per-video loop" (decisions.md 2026-07-05); the owner picks Sonnet vs an explicit Opus exception before the plan is written.

**Avatar step stays as-is:** manual `tooling/cli/heygen-web` (read its CLAUDE.md first — Avatar III only, never `--iv`/metered MCP; prove every create op stayed free: `heygen-web usage --save` before, `usage --diff` after). Do NOT build the fal-lipsync avatar CLI — fenced below.

**Exit criterion:** each processor step is one command or one rulebook'd session; processor-hours/video re-measured and lower; videos/mo can rise without the processor serializing. If a sub-build stalls on a missing owner decision → STOP, record the question in the plan, don't improvise.

## Phase 2 — title/thumbnail CTR packaging loop (problem #2, highest-ROI gap)

**Entry:** Phase 1c exists (candidate generation is mechanical).
**First:** read `pipelines/youtube/yt-analysis/CLAUDE.md` and check what `sync_views.py` / `sync_metadata.py` already pull; CTR/impressions need the YouTube Analytics API on the owner's channels — verify credentials exist before promising the loop (see **personal-stuff-config-and-secrets**).
**Shape:** generate 2–3 title+thumbnail candidates per video → publish → measure CTR → feed back into the next generation prompt.
**OWNER GATE:** which channels, and YouTube's built-in Test & Compare vs manual swaps — owner picks; record in decisions.md.
**Decision gate:** if Analytics-API auth for the channels doesn't exist and the owner won't add it → branch to "manual CTR readings pasted monthly" and record the degraded loop; don't silently ship a loop with no feedback signal.

## Phase 3 — final-video QC gate (problem #3)

**Entry:** any videos shipping (always true).
**Fact (confirmed 2026-07-12):** the $150 reviewer covers the SCRIPT only — nobody signs off the shipped video.
**Options to put in the plan:** (a) extend the reviewer's scope ($ decision), (b) an automated checklist stage — transcribe the final cut (`pipelines/.claude/skills/transcribe` / local faster-whisper) and diff against the locked script, plus ffprobe checks (duration vs VO, audio levels, black frames), (c) both. QC must emit a pass/fail checklist, not a vibe.
**OWNER GATE:** human vs automated vs both — it's a recurring-cost decision.

## Phase 4 — wire topic selection in (problem #4)

**Entry:** processor no longer the bottleneck (else more topics just queue).
**Assets that already exist, unused by the workflow:** `pipelines/youtube/yt-research/` (niche→knowledge-base, TS), `pipelines/youtube/keyword-research/` (competitor affiliate-opportunity scan), `pipelines/youtube/dossiers/` (per-tool research library — note plans 052/053 fixing dossier-build are still TODO in `plans/README.md`).
**Deliverable:** a "pick next topics" step at the head of the workflow consuming keyword-research output + dossier coverage (+ Phase 5 data once it exists).
**OWNER GATE:** the selection criterion (affiliate-revenue-first vs views-first vs per-channel) is a business call — get it on record first.

## Phase 5 — analytics feedback loop (problem #5)

**Entry:** Phase 4's topic picker exists (feedback needs something to feed).
**Assets:** `yt-analysis/` sync scripts (views/rankings/clicks → tracker sheet), `apps/analytics-app` (yt-analytics.agrolloo.com click dashboard reading the redirector's D1).
**Deliverable:** performance-by-topic/channel summary that Phase 4's picker and Phase 2's CTR prompts consume. Design Phases 4+5 in one brainstorm even if built as separate plans — they share the data model.

## Phase 6 — affiliate links as a workflow step (problem #6)

**Entry:** independent; small; do whenever. For review/comparison channels this is the revenue.
**Assets:** `apps/tutorial-tracker-app` mints `go.agrolloo.com` links — deterministic, LLM-free link-gen with drift report landed 2026-07-11 (plan 056, PR#13); `apps/redirector` serves them; `sync_clicks.py` counts.
**Deliverable:** an explicit step in final-workflow-notes.md between script-lock and upload: mint/verify the link in the tracker, place it in the description template. Mostly a workflow-doc + checklist change; verify against the tracker's current link-gen UI before writing it.

## Phase 7 — step-135 motion-graphics rulebook (problem #7)

**Entry:** independent of 1–6; unblocks the "editor places pre-rendered clips" cost lever.
**File:** `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` — a 14-line stub (verified 2026-07-12). Ignore the legacy flat `steps/` folder; the stage folders (`5-visuals/`, …) are canonical.
**How:** author it in a Claude Code session on Sonnet with the pipelines-scoped `hyperframes*` skills loaded (they activate under `pipelines/`), grounded in `pipelines/youtube/competitor-styles/channels/devsplainers/` (design-system breakdown + hyperframes build kit) and `pipelines/video/card-library/` (GSAP card templates; editor-facing rendering at render2.agrolloo.com).
**Expected output (the stub's own spec):** per cue type — which hyperframes workflow authors it, brand tokens, render settings (full-frame 1920x1080 MP4 / overlay transparent MOV, duration locked to the cue), and a midpoint-frame verify pass before handoff to 162.
**Gate:** graphics quality is judged against the rulebook's verify pass + the visual-plan cues, not taste. Related remnant: 162's overlay passes (PIPE-01) stay deferred until real HeyGen downloads exist — don't implement against `TODO[HNS]` stubs.

## Fenced wrong paths (evidence attached — do not re-attempt without new evidence)

| Wrong path | Status + evidence |
|---|---|
| Dub-flow per-sentence sync (SYNC-PROBLEM.md options A+B/D) | **RETIRED** — VO-first makes it unnecessary (decisions.md 2026-07-12; SYNC-PROBLEM.md header). The `video/tts` anchor+silence-absorb path stays ONLY as legacy fallback for dubbing pre-existing recordings |
| Re-solving voice↔video sync in any form | The workflow syncs by construction; a "sync fix" proposal means someone skipped the VO-first decision — point them at decisions.md 2026-07-12 |
| fal-lipsync migration + avatar CLI | **VALIDATED BUT DEFERRED** — de-risk test passed 2026-07-11 (~$0.30–0.40/min, holds the gaze-down pose), owner decided 2026-07-12 to stay on HeyGen; do not build the CLI or push the migration until the owner revisits (`pipelines/video/heygen/fal-lipsync/README.md`) |
| Antigravity in the graphics path | Devsplainers PoC failed on all four axes (decisions.md 2026-07-05). The ONE exception — explainer pipeline step 020 (plan 047) — was an explicit, recorded owner override with a mandatory render+visual-inspection mitigation (decisions.md 2026-07-07). Never silently repeat it |
| ElevenLabs / any per-generation paid TTS | "No recurring cost" is a hard requirement (`video/tts/CLAUDE.md`); IndexTTS-2 on Modal is the decided engine |
| RVC to fix delivery/pronunciation | Voice skin — copies every flaw; archived at `pipelines/archive/rvc-flow/` |
| HeyGen Avatar IV/V or the metered MCP | Avatar III only (owner rule, `tooling/cli/heygen-web/CLAUDE.md`); prove create ops stayed free with `usage --save`/`usage --diff` |

## When NOT to use this skill

- Domain theory — voice-cloning, why the sync math works this way, lip-sync/GPU economics → **video-and-tts-reference** (sibling skill; this campaign only executes against those decisions)
- Hyperframes authoring mechanics → the pipelines-scoped `hyperframes*` skills; browsing generated media → `media-board` (localhost:4100)
- Script/style generation for a specific channel → `yt-style-copy` + `pipelines/youtube/competitor-styles/`
- "What's open across the whole repo / what next overall" → **personal-stuff-frontier**
- De-risking an unproven external service/model → **personal-stuff-research-methodology**
- Plan/PR mechanics → **personal-stuff-change-control** (never hand-roll the branch; secretary raises boss PRs)

## Provenance and maintenance

Grounded in `pipelines/youtube/final-workflow/final-workflow-notes.md`, `pipelines/video/tts/{CLAUDE.md,SYNC-PROBLEM.md,OUTPUTS.md,REFERENCES.md}`, `pipelines/video/heygen/CLAUDE.md` + `fal-lipsync/README.md`, `decisions.md` (2026-07-12 VO-first + hubs + fal-deferral entries; 2026-07-11 autonomy policy; 2026-07-05/07 routing entries), `tooling/boss/data/rules.md` (executor/model routing), `plans/README.md` (011 DONE + PIPE-01 backlog). All paths, the 135 stub, the `TODO[HNS]` stubs, the OUTPUTS.md columns (header-only, 6 columns), the `jamila-30s` slug, and the cost numbers re-verified 2026-07-12. Most volatile skill in the library — re-verify before each campaign session:

- VO-first still the decision? `grep -n "VO-first" decisions.md | head -3`
- Open problems / cost table moved? `sed -n '16,52p' pipelines/youtube/final-workflow/final-workflow-notes.md`
- Processor time log started yet (baseline rows)? `grep -n "Processor time log" pipelines/youtube/final-workflow/final-workflow-notes.md` (no match as of 2026-07-12 — the operator adds it per the Phase-1 protocol)
- fal-lipsync still deferred? `grep -n "fal-lipsync deferred" decisions.md`
- Unattended runs still read-only-first? `grep -n "Autonomy policy" decisions.md`
- 135 rulebook still a stub? `head -3 pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md`
- HeyGen still stubbed (PIPE-01)? `grep -n "TODO\[HNS\]" pipelines/youtube/tutorial-pipeline-2/lib/heygen.py`
- Which phases already have plans? `grep -in "final-workflow\|thumbnail\|qc" plans/README.md`
