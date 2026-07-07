# Step 130 — plan visuals (everything on screen except the full-screen avatar)

Plan what fills the screen **between and under** the full-screen host moments: screen recording,
motion graphics, b-roll, zoom/highlight — with the **corner avatar always on**. Runs **after** the
avatar plan (step 2): the full-screen ranges are already decided there; here you carry them in and
fill everything else. Claude produces this by reading the timestamps + script + the step-2 avatar
plan and applying the rules below. Output: `output/<base>.visual-plan.md` (the full timeline).

## Input
- `../120-make-timestamped-transcript-run/output/<base>.timestamps.txt` — the timestamped segments from step 120 (source of timing).
- `../080-synthesize-voice-run/output/<base>.avatar-fullscreen.md` — **the avatar plan (step 060, realised as audio + doc by step 080)**: the time ranges that are
  already full-screen host. Carry these in as 🧍 AVATAR-FULL rows; **don't re-decide them.**
- `../040-polish-script-for-delivery-sonnet/output/<base>.improved.txt` — the clean script (correct wording; the ASR may
  misspell brand names — trust the script).

## Standing constraints (hard rules)
- **Corner avatar is the baseline.** A small talking-head avatar sits **bottom-left for the whole
  video**, layered over screen-rec / motion-gfx / b-roll. A human is *always* on screen. It's a
  constant — never its own row; just assume it's on except during 🧍 AVATAR-FULL ranges.
- **Full-screen avatar ranges are fixed by step 2.** Pull them in as 🧍 AVATAR-FULL rows and plan
  around them. If a range feels wrong, that's step-2 feedback (note it), not something to override here.

## The visual vocabulary (the non-avatar visuals)
| Tag | What it means | Reach for it when the narration… |
|-----|---------------|----------------------------------|
| 🧍 **AVATAR-FULL** | Full-screen host (**from step 060 — carried in, not decided here**) | …falls in a range the avatar plan marked full-screen. Copy the row; don't invent new ones. |
| 🖥️ **SCREEN-REC** | Screen recording of the actual tool (corner avatar stays bottom-left) | …describes *doing* something: "click", "open", "go to", "type", "select", "drag", "paste", "hit generate", settings, a walkthrough. The spine of the body. |
| 📊 **MOTION-GFX** | Animated text / diagram / chart (corner avatar stays on) | …is **explaining something complex**, **comparing** options, or **concluding / summarizing** — and any time numbers, lists, definitions, or key terms should stick. Used liberally there. |
| 🎞️ **B-ROLL** | Stock / illustrative footage (corner avatar stays on) | …is abstract or sets mood with nothing concrete to show ("AI is changing everything"), or an example that isn't on the screen. |
| 🔍 **ZOOM/HL** | Zoom-in or highlight on the screen-rec | …points at one specific UI element ("see this little toggle here"). Pairs with SCREEN-REC, not standalone. |

## How to decide (for every stretch NOT already full-screen avatar)
1. **Concrete on-screen action → SCREEN-REC.** Verbs of doing (click/open/type/select/drag/
   upload/paste/run) mean "show the screen." The spine of the body; corner avatar rides along.
2. **Explaining something complex / comparing / concluding → MOTION-GFX** (corner avatar stays).
   The second-most-used visual after screen-rec — pricing tables, the scorecard, feature comparisons.
3. **Nothing concrete, just vibe or an off-screen example → B-ROLL.**
4. **Calling out a specific element on screen → ZOOM/HL** on top of the running SCREEN-REC.

When two fit, prefer the one that *shows the work* — a tutorial earns trust by showing the screen,
so bias toward SCREEN-REC in the body.

## Output format — `<base>.visual-plan.md`
The **full timeline**, one row per segment (merge adjacent rows that share a visual). The
AVATAR-FULL rows are carried from step 060; everything else is filled here.

```
# Visual plan — <base>

_Baseline: corner avatar (bottom-left) is on the whole time except 🧍 AVATAR-FULL rows._
_Full-screen avatar (from step 060): ≈M:SS total — see <base>.avatar-fullscreen.md for verbatim lines._

| Time | Narration (gist) | Suggested visual | Note for editor |
|------|------------------|------------------|-----------------|
| 0:00–1:35 | Intro + overview of all 5 | 🧍 AVATAR-FULL | From step 2 (front-loaded open) |
| 1:35–1:55 | "open the dashboard and click New" | 🖥️ SCREEN-REC | Start the demo recording here |
| 1:55–2:05 | "it costs about forty cents" | 📊 MOTION-GFX | Pop "$0.40"; corner avatar stays |
| 2:05–2:40 | "select your avatar, hit generate" | 🖥️ SCREEN-REC + 🔍 ZOOM | Zoom the Generate button |
…

Capture list:
- Screen-rec: <each distinct recording the editor needs to grab>
- Full-screen avatar: see ../080-synthesize-voice-run/output/<base>.avatar-fullscreen.md
```

Rules for the table:
- **Time** comes straight from the timestamps — don't invent it.
- **Narration (gist)** is a short paraphrase (editor scrubs the SRT for exact words).
- One primary tag per row; a secondary tag (`+ 🔍 ZOOM`) only when it genuinely stacks.
- **Note** is the actionable bit — what to capture, what to overlay, where to cut.
- Carry the 🧍 AVATAR-FULL rows from step 060 verbatim (time + "from step 060"); don't re-plan them.
- End with a **capture list**: the distinct screen-recordings to grab, plus a pointer to the avatar doc.

## What this is NOT
- Not the full-screen avatar decision (that's step 2) — only what fills the rest.
- Not final cuts, not a sync map, not binding — every row is "suggest"; the editor's judgement wins.

## Learnings — grows over time (like the pronunciation-map)
When the editor overrides a non-avatar suggestion, record the lesson here and fold it into the
vocabulary/rules above, so the next video's plan is better instead of repeating the same wrong call.

| Date | What we learned | Rule change |
|------|-----------------|-------------|
| 2026-06-29 | (seed — fill on first editor feedback) | — |
