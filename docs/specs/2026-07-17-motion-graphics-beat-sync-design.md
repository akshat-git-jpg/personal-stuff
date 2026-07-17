# Motion graphics for final-workflow videos: beat-synced card flow

Date: 2026-07-17 (brainstormed with owner; all open questions resolved)
Status: approved design, awaiting implementation plan via `orchestrate`
Supersedes: the deferred `docs/motion-graphics-strategy-handoff.md` (2026-07-07) for this workflow; realizes the step-135 rulebook stub's intent for final-workflow videos

## Problem

Final-workflow videos (30-min review/comparison and how-to) need many motion graphics per video. Today the video editor hand-edits HTML cards from the card library and renders them at render2.agrolloo.com. The owner wants to move graphics generation in-house to Claude: give it the video's voiceover MP3, get back rendered clips plus timestamps telling the editor where each one goes.

Three constraints shaped the design:

1. **Token cost.** A 30-min video must not mean an LLM authoring dozens of graphics from scratch, or watching video frames.
2. **Early feedback.** The owner reviews a storyboard of planned graphics before anything renders, and nothing built for the preview may be throwaway work: the preview must be the actual graphic.
3. **Internal sync.** A graphic is not a static 5-second clip dropped at a timestamp. A pros/cons card must reveal each pro at the moment the voiceover speaks it, flip to cons when the VO does, and reveal each con on its beat. This applies to every progressive-reveal graphic.

## Decisions (owner-confirmed 2026-07-16/17)

| Decision | Choice | Why |
|---|---|---|
| Target videos | final-workflow production line | Where the volume is; ties into the video-factory campaign |
| Input to cue detection | MP3/transcript only, no video frames | VO-first workflow means the MP3 is the master clock; frames are the dominant token cost and the editor handles screen-area judgment |
| Framework | HyperFrames, not Remotion | Card library is already HyperFrames; render2 runs `hyperframes render`; one HTML file is both the live browser preview and the render input, which is what makes "preview = actual graphic" possible. Remotion's React build step splits preview and render into two artifacts. (`archive/hyperframes-vs-remotion/` already retired the comparison.) |
| Cue-pass executor | Pluggable (Sonnet default; agy/Antigravity allowed) | The per-video LLM step is form-filling against a JSON schema, so any model can do it. The Antigravity fence (decisions.md 2026-07-05) applies to *authoring novel motion*, not to filling cue variables; any Antigravity card authoring carries the render + visual-inspection mitigation from the 2026-07-07 override |
| Storyboard | Local server, card-gallery style | Zero hosting, MP3 slices stay local, owner reviews from this machine |
| Catalog start | Retrofit the ~8-10 highest-use existing cards to the beat contract | The library already holds 37 cards across 11 categories (verified 2026-07-17), including the needed types. Retrofit = move reveal timing from hardcoded timeline values into `items[].at` data (~20 lines/card); visuals and motion untouched. Obvious candidates: pros-cons, checklist, bullet-points, key-takeaways, summary-table, feature-matrix, verdict-report-card, table-of-contents. Single-shot cards (title/, deal-stamp, lower-third, arrow-label) need no change, only catalog entries. Video #1 mostly picks cards instead of flagging gaps |
| Rendered clip audio | Video-only | VO already sits on the editor's timeline; manifest timecode is the alignment contract |

## Architecture

One LLM call per video in the steady state. Everything else is mechanical scripts.

```
locked script + VO mp3
        |
  [1] whisper word-timestamps            (local, free — transcribe skill)
        |
  [2] cue pass                            (THE one LLM step, pluggable model)
        |  reads: transcript + compact card catalog (slug, purpose, variable schema)
        |  writes: cues.json — quotes anchor PHRASES, never timestamps
        |
  [3] anchor resolver                     (script, deterministic)
        |  phrase -> word timestamp; fails loudly on missing/out-of-order anchors
        |
  [4] storyboard board                    (local server, no LLM)
        |  per cue: timestamp + spoken line + iframe of the REAL card with real
        |  beat variables + the ffmpeg-cut MP3 slice driving the composition clock
        |  owner edits text/timing inline (writes back to cues.json), approves
        |  cues with no fitting card are flagged here
        |
  [5] novel-card authoring                (only for flagged cues; Sonnet default)
        |  new cards land IN the library — the catalog compounds
        |
  [6] batch render + manifest             (script: hyperframes render loop)
        |  per cue: clip named <t>-<slug>.mp4/.mov, duration locked to the beats
        |  manifest.md: timestamp | file | duration | overlay-or-fullframe
        v
editor places clips at manifest timecodes
```

### cues.json: beats, anchored by quotation

```json
{
  "card": "comparison/pros-cons",
  "anchor": "let's look at the pros",
  "variables": { "title": "Notion", "tone": "pros" },
  "beats": [
    { "reveal": "Unlimited free tier", "anchor": "the free tier alone" },
    { "reveal": "Great templates",     "anchor": "templates are genuinely" },
    { "reveal": "— cons —",            "anchor": "but it's not all good" },
    { "reveal": "Slow on mobile",      "anchor": "the mobile app crawls" }
  ]
}
```

The LLM quotes phrases it just read in the transcript; a script resolves each phrase to seconds via the Whisper word timestamps. LLMs are unreliable at timestamp arithmetic and quoting is nearly free in tokens, so timestamps never pass through the model. The resolver rejects anchors that don't appear in the transcript or resolve out of order, before anything renders.

Card start = first anchor's timestamp. Card end = last beat + a per-card hold default. Duration is derived, never chosen.

### The card contract: timing is data

This extends the card library's existing CONTENT-vs-TIMELINE split one level. Any progressive-reveal card takes its beats as data and builds its timeline from that data:

```js
const DATA = {
  title: 'Notion',
  items: [
    { text: 'Unlimited free tier', at: 1.8 },
    { text: 'Great templates',     at: 6.2 }
  ],
  duration: 24.5
};
// TIMELINE (never edited per-video):
DATA.items.forEach(item => tl.add(revealItem(item), item.at));
```

Same card, any number of points, any spacing, driven by when the VO actually says each thing. Motion (easing, reveal style, section flips) is authored once and locked; only the *when* is data. Existing cards get retrofitted to this contract as they're first used. The step-135 rulebook records this as a hard requirement for new cards, with `revealItem`-style examples, so no executor can ship a hardcoded timeline.

### The storyboard proves the sync

Because beats are variables, each board tile plays the real composition with the real timing, with the cue's MP3 slice as the clock. The owner presses play on a tile and watches "Slow on mobile" slide in as the VO says the mobile app crawls. What gets approved is the synced artifact itself; the reuse of the card-gallery `serve.mjs` machinery means the board costs no per-video tokens.

## Token model

Per 30-min video, steady state: one transcript in + one cues.json out (a few cents on Sonnet). Whisper, anchor resolution, the board, rendering, and the manifest are all scripts. Novel-card authoring is the only other LLM spend and it amortizes: every authored card joins the catalog, so per-video cost trends toward pure variable-filling.

## What this is not

- Not a re-solve of voice/video sync (that's settled by VO-first, decisions.md 2026-07-12). This syncs graphics *to the VO*, which is the master clock by construction.
- Not an Antigravity graphics pipeline. The fence stands; Antigravity may at most fill the cue-pass form or author a card under the recorded mitigation.
- Not a hosted product. Board and renders run locally; render2 stays the editor-facing tool it already is.

## Build order (for the plan)

1. Card contract + seed catalog: retrofit the ~8-10 highest-use existing cards (see Decisions table) to beat-parameterized timing; document the retrofit convention in the card library README; catalog entries for the no-change single-shot cards. New cards from scratch only in step 6.
2. Anchor resolver + cues.json schema + transcript step wiring.
3. Cue-pass rulebook (prompt, density guidance, brand tokens, catalog format) — this *is* the step-135 rulebook content, written for final-workflow.
4. Storyboard board server (extend `serve.mjs` pattern: cue tiles, MP3 slices, inline edit, approve/flag).
5. Batch render + manifest script.
6. Novel-card authoring loop (flag -> author -> lint -> library).

Each piece is independently testable; 1-2 can land before any LLM prompt exists. Plan routing per repo change control: `orchestrate` writes the plan, `secretary` raises it, boss dispatches per `tooling/boss/data/rules.md`.

## Open questions deliberately deferred

- Overlay (transparent MOV) vs full-frame (MP4) per card type: decided in the rulebook per cue type, not globally.
- Whether the cue pass eventually merges into the processor's session flow (video-factory campaign phase 1): revisit once both exist.
- Editor-facing delivery (folder handoff vs something fancier): folder + manifest.md first; anything more waits for editor feedback.
