---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh && node lib/lint-cues.mjs test-03-conclusion
ui: true
deploy:
needs: [plan 162 MUST land first — E7 and exposure absorption are avatar-blind until it does. 155/156/159/160 already landed.]
---

# Plan 158: Cut and cue the conclusion — the payoff the video never reaches

## Summary

- **Problem statement**: `videos/test-03/src/conclusion.mp4` exists (79.2s) and contains the entire payoff — per-tool choose/avoid verdicts, the overall verdict, and the subscribe CTA. It has never been in a cut. The assembled video stops dead at exactly 300.0s because `video.json` sets `base: "screen"` and `screen.mp4` is 300s, so the viewer never gets the answer the intro promised at 0:30.
- **Goals**:
  - Stand up `videos/test-03-conclusion/` as its own 79.2s workdir with `base: "none"`.
  - Run the standard pipeline over it and land an assembled cut.
  - Cue it with the verdict cards that already exist, plus the now-fixed `like-subscribe`.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — deterministic setup plus the repo's own pipeline verbs.
- **Done criteria** (terse): the workdir assembles; lint exits 0; extracted frames show a verdict card and a non-green subscribe CTA.
- **Stop conditions** (terse): the subscribe overlay renders green; `feedback-status` is non-zero before any LLM pass.
- **Test / verification for success**: `scripts/check.sh` plus frame extraction from the assembled conclusion.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 64a151b..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/card-library/catalog.json`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans 155, 156
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `64a151b`, 2026-07-28

## Why this matters

The intro makes a promise at 0:30: *"by the end of this video, you will know exactly which one is worth using and which one quietly creates more work."* The cut never pays it off. The footage to pay it off has existed the whole time.

The conclusion's narration is already well structured — it needs cards, not rewriting. Transcribed verbatim from `src/conclusion.mp4`:

> Now to give you an individual conclusion on both of these, first of all, on Opus Clips, choose Opus Clips if your top priority is speed and you're okay with doing extra edits afterward for yourself. Do avoid it if you care about your branding, caption quality, or polished output. Choose Submagic if you want short form content that actually looks native to TikTok and Reels. Avoid it only if you want zero control and don't mind generic results. So the overall verdict is that Opus Clips is quite good at generating clips quickly, whereas Submagic is better at generating clips you can actually post. So if quality, consistency, and time-saving matters to you, I'd say Submagic is the better tool overall. Now, if you want to go ahead and try Submagic for yourself or you want to try Opus Clips for yourself, the links are in the description. And if you've used either tool before, drop a comment with your experience. It helps other creators decide. And if you want more honest decision-driven comparisons like this, do make sure to turn on the bell icon and subscribe. Do make sure to like this video. Clean, clear, and done. I will see you all in the very next video. Have a great day. Goodbye.

That is a choose/avoid matrix, an overall verdict, and a three-part CTA — and the library already has `verdict/persona-match`, `verdict/verdict-report-card`, `verdict/verdict-badges`, `verdict/verdict-trophy`, `verdict/winners-podium`, `link-in-description/link-in-description` and `like-subscribe/like-subscribe`. No new cards are needed.

This also exercises `like-subscribe` for the first time. Until 2026-07-28 that card painted a `#00b140` plate while its catalog entry declared no `chroma`, so nothing keyed it and it composited as a **solid green rectangle over the whole frame**. It is now authored transparent. The conclusion is where that fix gets proven, which is why Step 8 checks for green explicitly.

## Current state

**Source media** (verified durations):

| file | duration |
|---|---|
| `videos/test-03/src/intro.mp4` | 117.567s |
| `videos/test-03/src/body.mp4` | 879.733s |
| `videos/test-03/src/conclusion.mp4` | 79.233s |
| `videos/test-03/vo.full.mp3` | 1076.352s |
| `videos/test-03/vo.mp3` (the 5-min test slice actually used) | 300.012s |
| `videos/test-03/screen.mp4` | 300.000s |

`concat.txt` lists intro + body + conclusion in that order, so the conclusion occupies the final 79.233s of the 1076.352s timeline — i.e. it starts at **997.119s** in `vo.full.mp3`.

**`videos/test-03/video.json`**, verbatim:

```json
{"base":"screen","aspect":"16:9","brand":"default","music":""}
```

**`lib/video-manifest.mjs`** constrains it (lines 4, 11–12):

```js
export const MANIFEST_DEFAULTS = { base: 'screen', aspect: '16:9', brand: 'default', music: '' };
...
  if (!['screen', 'none'].includes(m.base)) throw new Error(`video.json base must be "screen"|"none", got "${m.base}"`);
  if (m.aspect !== '16:9') throw new Error('video.json aspect: only "16:9" is supported (longform-only, decisions.md 2026-07-24)');
```

So `base: "none"` is legal and is correct here — there is no screen recording over the conclusion, only the presenter.

**`base: "none"` means NO FOOTAGE AT ALL, not "no screen recording".** This is the correction that blocked the first attempt at this plan (2026-07-28). `lib/assemble.mjs`'s `fillGapsWithFreeze` turns every segment of kind `screen` into a **freeze frame** when base is `none`, which is exactly why `E7 uncovered-second` demands that fullframe cards cover every active second. The first version of this plan set `base: "none"` **and never ran the avatar step**, so the conclusion had no presenter: a 79.2s video that must be 100% graphics, with a 20s end-exclusion zone (E4) and two mandatory end CTAs that must sit on footage (E9), is correctly impossible.

The resolution is footage, not a weaker rule. **Step 5b runs the avatar step**, so `avatar-full` spans carry the presenter; cards then cover only what they should, the CTAs sit on avatar footage, and E4/E7/E9 are all satisfiable together. `decisions.md` 2026-07-28 records that E4 and E9 are NOT to be weakened, and that setting `base: "screen"` to escape this is rejected — it reintroduces the 300s screen-recording cap this plan exists to remove. The first crew tried exactly that (`825802d "Fix E4 and E9 by setting base to screen"`); do not repeat it.

**Plan 162 must land before this one.** Until it does, `lib/lint-cues.mjs` has zero awareness of avatar spans (E7 counts only cards as coverage) and `extendExposure` absorbs straight across an avatar span. With avatar spans present but 162 absent, this plan will fail again for a different reason.

**`base: "none"` also changes exposure behaviour.** `lib/resolve.mjs` (line 374):

```js
    let wanted = base === 'none' ? gap : (gap <= CUE_CONSTANTS.GAP_ABSORB.value ? gap : 0);
```

On `base: "none"` a fullframe card absorbs the *whole* gap to the next fullframe rather than only gaps under `GAP_ABSORB`. Expect longer holds than in test-03, and expect plan 156's `W13 frozen-fullframe` to police them.

**Pipeline verbs** (`run.sh`): `concept-pass`, `cue-pass`, `audit`, `board`, `render`, `sound`, `mix`, `assemble`, `cut`, `qc`, `export`. `bash run.sh <slug> status` prints where a workdir stands.

**Hard guardrail** (`.claude/skills/visuals-flow`): before ANY LLM pass, `node lib/feedback-status.mjs` must exit 0. It currently does.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Pre-flight | `cd pipelines/video/visuals-flow && node lib/feedback-status.mjs` | exit 0 |
| Workdir status | `cd pipelines/video/visuals-flow && bash run.sh test-03-conclusion status` | prints stage state |
| Transcribe | see Step 3 | writes `transcript.json` |
| Concept pass | `cd pipelines/video/visuals-flow && bash run.sh test-03-conclusion concept-pass` | writes `concept.json` |
| Cue pass | `cd pipelines/video/visuals-flow && bash run.sh test-03-conclusion cue-pass` | writes `cues.json` |
| Resolve + lint | `cd pipelines/video/visuals-flow && node lib/resolve.mjs test-03-conclusion && node lib/lint-cues.mjs test-03-conclusion` | exit 0 |
| Render | `cd pipelines/video/visuals-flow && node lib/render.mjs test-03-conclusion` | mov/mp4 per cue |
| Assemble | `cd pipelines/video/visuals-flow && bash run.sh test-03-conclusion assemble` | registers a version |
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/videos/test-03-conclusion/**` (new workdir; text artifacts only — media goes to `~/kb-scratch/`)

**Out of scope**:
- `videos/test-03/**` — do not extend or re-cut the existing 5-minute slice. It is a deliberate test slice and re-cutting it is a separate decision.
- Any `lib/*.mjs` change. If the pipeline cannot handle a 79s `base: "none"` video, that is a finding to report, not to patch inside this plan.
- Re-recording or editing the conclusion audio/video.
- `pipelines/video/card-library/**` — every card this needs already exists.

## Git workflow

- Branch: `advisor/158-vf2-cut-the-conclusion`
- Commit: `feat(visuals-flow): cut and cue the test-03 conclusion` — no AI footers. Do NOT push.

## Steps

### Step 1: Pre-flight

**Verify**: `cd pipelines/video/visuals-flow && node lib/feedback-status.mjs; echo "exit=$?"` -> `exit=0`. If non-zero, STOP — there is unfolded owner feedback and no LLM pass may run.

### Step 2: Create the workdir and its media

```bash
cd pipelines/video/visuals-flow
mkdir -p videos/test-03-conclusion/src
cp videos/test-03/src/conclusion.mp4 videos/test-03-conclusion/src/body.mp4
ffmpeg -v error -y -ss 997.119 -i videos/test-03/vo.full.mp3 -c copy videos/test-03-conclusion/vo.mp3
printf '%s\n' '{"base":"none","aspect":"16:9","brand":"default","music":""}' > videos/test-03-conclusion/video.json
```

**Verify**: `cd pipelines/video/visuals-flow && ffprobe -v error -show_entries format=duration -of csv=p=0 videos/test-03-conclusion/vo.mp3` -> a value between `78.5` and `80.0`. If it is far off, the tail offset is wrong — recompute as `(duration of vo.full.mp3) - 79.233` and redo.

### Step 3: Transcribe

```bash
cd pipelines/video/visuals-flow
node lib/transcribe-groq.mjs test-03-conclusion
```

If that script takes different arguments, read its usage line and call it correctly — do not hand-write `transcript.json`.

**Verify**: `cd pipelines/video/visuals-flow && node -e "const w=require('./videos/test-03-conclusion/transcript.json');console.log(w.length, w[w.length-1].end)"` -> a word count over 150 and a final `end` between `78` and `80`.

Then confirm the words are the right ones: `node -e "const w=require('./videos/test-03-conclusion/transcript.json');console.log(w.map(x=>x.text).join(' ').slice(0,80))"` -> begins with text about giving an individual conclusion on both tools.

### Step 4: Concept pass

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh test-03-conclusion concept-pass && node -e "console.log(Object.keys(require('./videos/test-03-conclusion/concept.json')))"` -> includes `thesis` and `throughline`.

### Step 5: Cue pass

Run the cue pass, then apply these THREE decisions, which are made here and are not the executor's to re-litigate:

1. **The link mention uses the PILL, not the scrim.** `R_LINK_CTA` says the first description mention in a video uses `link-in-description/link-scrim` and later ones use the pill. This workdir is a continuation of test-03, where the scrim already fired at 109.9s — the counter restarting is an artifact of splitting the workdir, not a new video. If the cue pass emits `link-scrim` here, change that one cue's `card` to `link-in-description/link-in-description` and leave everything else alone.
2. **The subscribe CTA uses `like-subscribe/like-subscribe`**, anchored at "turn on the bell icon and subscribe".
3. **One winner per verdict card** (`R_VERDICTS`). The narration gives a choose/avoid pair for each tool and then a single overall winner. Route the per-tool pairs to `verdict/persona-match` and the overall verdict to ONE `verdict/verdict-report-card` or `verdict/verdict-trophy` anchored at "Submagic is the better tool overall" — never two trophies.

```bash
cd pipelines/video/visuals-flow
bash run.sh test-03-conclusion cue-pass
node lib/resolve.mjs test-03-conclusion
node lib/lint-cues.mjs test-03-conclusion; echo "exit=$?"
```

**Verify**: lint `exit=0` (warnings allowed, errors not), and:

`node -e "const c=require('./videos/test-03-conclusion/cues.json').cues;console.log(c.map(q=>q.card).join('\n'))"` -> includes `like-subscribe/like-subscribe`, at least one `verdict/*`, and `link-in-description/link-in-description` (NOT `link-scrim`).

### Step 5b: Shot pass + avatar — the conclusion needs a presenter

**This step is why the first attempt failed and must not be skipped.** Without avatar spans the conclusion has no footage at all, every second must be a card, and E4/E9 become unsatisfiable.

```bash
cd pipelines/video/visuals-flow
bash run.sh test-03-conclusion shot-pass
```

The shot pass authors `shots.json` — presenter spans with a `mode`. Two decisions, made here:

1. **`mode: "full"` for every span.** `side` splits the frame with a graphics column and this is a talking-head payoff; do not use it here.
2. **The presenter must carry the CTA stretch.** The final ~20s (link, comment, subscribe, sign-off) sits inside the E4 end-exclusion zone where non-endcard fullframes may not end, so it must be presenter footage with the CTA overlays on top. Ensure a span covers it.

Then submit the avatar renders. **Avatar III test renders are pre-authorized** (owner rule 2026-07-24 — Avatar III unlimited mode is free); anything metered stays owner-run. `engineMode` must remain `"test"`.

```bash
bash run.sh test-03-conclusion avatar
```

**Verify**:
```bash
cd pipelines/video/visuals-flow && node -e "
const j=require('./videos/test-03-conclusion/avatar-jobs.json').jobs;
const full=j.filter(x=>x.kind==='avatar-full');
console.log('avatar-full spans:', full.length);
console.log('covers to:', Math.max(...full.map(x=>x.end)).toFixed(1), 's of ~79.2s');
"
```
-> at least one `avatar-full` span, and coverage extending into the final 20s.

Then re-run the lint now that footage exists:

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-03-conclusion; echo "exit=$?"` -> `exit=0`, with **no E4, E7 or E9 errors**. If E7 still reports uncovered seconds where an avatar span exists, plan 162 has not landed — STOP and report.

### Step 6: Render

**Verify**: `cd pipelines/video/visuals-flow && node lib/render.mjs test-03-conclusion && ls videos/test-03-conclusion/renders/ | wc -l` -> equals the cue count from Step 5.

### Step 7: Assemble

**Verify**: `cd pipelines/video/visuals-flow && bash run.sh test-03-conclusion assemble 2>&1 | tail -3` -> prints `assembled:` with a duration near `01:19` and `registered version: v1`.

### Step 8: MANDATORY frame check — the subscribe CTA must not be green

This is the reason the plan exists in this order. Extract a frame at the subscribe cue's midpoint (read its `start`/`duration` from `resolved.json`) and one at a verdict cue's midpoint:

```bash
cd pipelines/video/visuals-flow
V=~/kb-scratch/video/visuals-flow/test-03-conclusion/versions/v1.mp4
node -e "
const r=require('./videos/test-03-conclusion/resolved.json').resolved;
for (const q of r) console.log(q.id, q.card, (q.start+q.duration/2).toFixed(2));
"
# then, for the like-subscribe cue time T:
ffmpeg -v error -ss <T> -i "$V" -frames:v 1 /tmp/concl-sub.png -y
```

Check it mechanically:

```bash
python3 - <<'PY'
import subprocess
b=subprocess.run(['ffmpeg','-v','error','-i','/tmp/concl-sub.png','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
import sys
W=1280 if len(b)==1280*720*3 else 1920
H=len(b)//(W*3)
green=sum(1 for y in range(0,H,2) for x in range(0,W,2)
          if b[(y*W+x)*3+1] > b[(y*W+x)*3]+8 and b[(y*W+x)*3+1] > b[(y*W+x)*3+2]+8)
tot=len(range(0,H,2))*len(range(0,W,2))
print(f'green fraction: {100*green/tot:.2f}%')
PY
```

**Verify**: green fraction is **under 2%**. A value near 100% means the subscribe card is still painting a chroma plate — STOP and report.

Then **open `/tmp/concl-sub.png` and look**: the subscribe pill must sit over the presenter, with the presenter still visible.

### Step 9: Full gate

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, ends `visuals-flow check OK`

## Test plan

There are no unit tests to add — this plan produces a video, and the repo's own gates (`resolve`, `lint-cues`, `check.sh`) plus the Step 8 frame checks are the verification. The green-fraction check in Step 8 is the load-bearing one: it is the only thing standing between a fixed `like-subscribe` and shipping a full-screen green rectangle, and it is exactly the class of defect that four content-blind gates missed before.

## Done criteria

- [ ] `videos/test-03-conclusion/` exists with `video.json` `base: "none"`
- [ ] `vo.mp3` duration is within `78.5`–`80.0`s
- [ ] `transcript.json` has >150 words ending near 79s
- [ ] `node lib/lint-cues.mjs test-03-conclusion` exits 0 with no `E` lines (specifically no E4, E7 or E9)
- [ ] `avatar-jobs.json` has at least one `avatar-full` span, and presenter footage covers the final 20s where the CTAs sit
- [ ] cues include a `verdict/*` card, `like-subscribe/like-subscribe`, and the link PILL (not the scrim)
- [ ] `bash run.sh test-03-conclusion assemble` registers a version ~79s long
- [ ] the subscribe frame's green fraction is under 2% and the presenter is visible behind the pill
- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0

## STOP conditions

- `node lib/feedback-status.mjs` is non-zero at Step 1 — unfolded owner feedback blocks every LLM pass. Stop.
- The subscribe frame's green fraction is above 2%. The `like-subscribe` transparency fix has regressed or the card was re-rendered from a stale copy. Stop and report the fraction.
- The cue pass emits two verdict cards each naming a different winner — `R_VERDICTS` allows one winner per card but the narration has exactly one overall winner. Stop and report rather than picking.
- `bash run.sh test-03-conclusion assemble` produces a video whose duration is not within 2s of 79.2s. Stop and report the actual duration — a large mismatch means the VO tail offset in Step 2 is wrong.
- You are about to set `base: "screen"` to make E4/E9 pass. REJECTED (`decisions.md` 2026-07-28) — it reintroduces the 300s screen-recording cap this plan exists to remove. The first crew did exactly this in `825802d`. Stop and report.
- You are about to weaken E4, E9, or exempt `base:"none"` from the exclusion zone. All three were rejected. Stop and report.
- E7 reports uncovered seconds across a span where an `avatar-full` job exists — plan 162 has not landed. Stop; do not compensate by adding cards.
- Any step needs a change under `lib/`. Report the limitation; do not patch the pipeline inside this plan.

## Maintenance notes

- Splitting the conclusion into its own workdir is a deliberate trade: it avoids re-cutting the 18-minute body just to reach the last 79 seconds, at the cost of restarting per-video counters. `R_LINK_CTA`'s "first mention uses the scrim" is the one rule that notices, which is why Step 5 pins it explicitly. If a full 18-minute cut is ever produced, that override should be dropped.
- `base: "none"` makes fullframe cards absorb whole gaps (`resolve.mjs` line 374). On a 79s talking-head stretch that can produce very long holds; plan 156's `W13` is what surfaces them. Read the lint warnings before judging the cut dull.
- This is the first real exercise of the `verdict/` family and of `like-subscribe`. Anything that looks wrong in those cards is a card-library finding worth its own note, not something to patch in the workdir.
