# Learnings for the tutorial pipeline

> Companion to `script-style-dna.md`. This channel is 100% screen-recording tutorial
> content, so its narration↔action habits are direct evidence for **Plan 011**
> (deterministic assembly: segment maps tying each script block to a raw-footage span,
> boundaries only at silence gaps ≥1.0s or brief-section changes, `kind = screen` vs
> `a4_block` fullscreen). Transcripts carry no word-level timestamps, so evidence below
> is verbatim narration cues (not seconds); the pattern is what transfers.

---

## 1. How a tutorial is structured beat-by-beat (intro → setup → build → payoff)

Youri's single-tool tutorials (VJKGwXWtxMY Invideo, FeKkztzebak Hermes, oEzIrS7cM3M cartoon) follow a **stable macro-skeleton** that maps cleanly onto Plan 011 segment `kind`s:

| Beat | What happens | Plan-011 `kind` | Evidence |
|---|---|---|---|
| **Intro / promise** | Capability demo + multi-part promise, no software yet | `a4_block` (fullscreen intro) | "with inv video AI you can generate a complete video with a script voice over and video footage all from just one prompt… In this full step-by-step tutorial I will show you how" (VJKGwXWtxMY) |
| **Why-this-one / context** | Justify the tool, sometimes proof | `a4_block` or `screen` | "out of all the agents you could pick, there is a reason this is the one worth starting with. It's open source, it's completely free…" (FeKkztzebak) |
| **Setup** | Account / install / config — discrete, sequential clicks | `screen` | "The link in the description drops you straight onto the deploy page… The plan you want is KVM2… click continue, pay, and make your account" (FeKkztzebak) |
| **Build (the body)** | Each FEATURE / STEP is its own beat; one action per beat | `screen` (majority) | 5-step cartoon: "the first step… is to generate the actual prompts… Step two of this workflow is to generate the actual images… we're going to head over to another tool. This one is called 11 Labs… the final step, which is stitching everything together" (oEzIrS7cM3M) |
| **Verdict / pricing** | Opinion to camera-voice, no new clicks | `a4_block` (fullscreen verdict) | "allow me to give you my personal opinion on nid AI if we take a look at the pricing you can get started for as low as just $20 per month" (VJKGwXWtxMY) |
| **Payoff / final-result reveal** | Show the finished artifact playing | `screen` (full-bleed playback) | "here's the final video that I generated with Nvidia AI…" then the artifact plays (VJKGwXWtxMY); "I have already completed mine, and here is the final result" (oEzIrS7cM3M) |
| **CTA** | Self-loop / affiliate | `a4_block` | "go click the link below and get your own agent up and running… Thank you for watching and I'll see you in the next one" (FeKkztzebak) |

**Takeaway for 040 (segment-map emission):** the intro, the pricing/verdict, the conclusion, and the CTA are exactly the beats Plan 011 already flags as `a4_block` (avatar-fullscreen). The channel confirms these are *narration-only, no-screen-action* moments — a good default rule: **a block with no on-screen action verb → `a4_block`; a block that narrates a click/type/generate → `screen`.**

---

## 2. Where they cut / change segments, and how narration syncs to on-screen action

This is the richest signal for Plan 011's boundary rules. Youri's narration is **continuous and self-narrating** — he says the action as (or just before) he performs it, which makes the *action verb* the natural segment boundary.

**(a) Action-verb cadence = segment boundaries.** Each demo sentence is an atomic "verb → result" unit:
- "I'm going to paste it inside the prompt window. Then, I'm going to switch the size to widescreen… Then click generate. And here are all four images." (oEzIrS7cM3M)
- "I'll paste in this command with those four characters from the dashboard added to the end and press enter. Then I'll paste the next command to open Hermes itself. Press enter." (FeKkztzebak)
- "I would open up the first five or six results… then with the vid Q extension… we can analyze the video data" (74JEr6bTszw)

→ **Boundary heuristic:** a new segment begins at each imperative demo verb (**"I'll type / paste / click / select / head over to / switch to / generate / upload / search for"**). These verbs are where the screen state changes, i.e. where a raw-footage cut most naturally lands. For 040, prefer block boundaries at these verbs *when they coincide* with the ASR ≥1.0s silence gap — Youri pauses briefly between actions while the UI responds, so the gap and the verb usually co-occur.

**(b) Generation waits = jump-cut over dead footage.** Whenever a tool renders, Youri narrates the wait and CUTS to the result — he never sits through the render:
- "Then I just click create. And in about 60 to 90 seconds, the video is done." (tQ84XYcP-nA)
- "this can take a few minutes depending on how long your prompt and video is so I'll get back to you once this is done and it is done" (VJKGwXWtxMY)
- "Counting from the moment you hit deploy to Hermes actually being ready to talk, it's roughly 10 minutes. And almost all of that was just waiting on the server to finish." (FeKkztzebak)

→ **Direct map to Plan 011's 125/162 logic:** these are segments where **raw footage vastly exceeds VO length** ("footage exceeds VO at max speed"). Youri's answer is a hard cut (drop the render seconds), not a speed-up. So the segment map should mark render-wait spans as *droppable* (cut the middle, keep the "click" frame and the "here's the result" frame) rather than retime them — a useful complement to the `speed`/`freeze_pad` band: **when footage ≫ VO because of a render wait, cut, don't stretch.**

**(c) Section-change transitions = hard segment breaks.** Moving between tools/steps is announced explicitly, which is a clean brief-section boundary for 040:
- "That's it for the media… what about the script" (VJKGwXWtxMY)
- "Now, we're moving into image to video." / "Finally, let's explore element mode." (tQ84XYcP-nA)
- "which brings us to step number three, finding video ideas" (eAUBU2hzsBA)

→ These phrases ("that's it for X… now let's do Y", "which brings us to step N", "let's move over to") are reliable segment-boundary markers even without a silence gap — they correspond to a brief-section change in Plan 011's rules.

**(d) Result-reveal beats.** After each action, a short "here's what we got" evaluation beat runs over the just-rendered output ("And here's what it then generated which looks absolutely fantastic", 9Xifo4iMb6A). These are separate `screen` segments (footage = the result playing) and often carry the honest-critique line — worth their own block so 125 can time them against the result clip, not the action clip.

---

## 3. Pacing habits specific to demo/tutorial narration

- **Baseline density is high and flat:** ~206 WPM median across the corpus (see DNA Pacing). Screen tutorials do not slow down for "explaining" vs "doing" — the narration rides continuously over both.
- **Typing/clicking is narrated in real time, not in silence:** he talks *through* the action ("I'm going to write a realistic image of a sword being stuck in a huge boulder. But before I generate, there's one thing that's really important", pgxFACkE7Fo). Implication for 125's VO↔footage alignment: **do not expect long silence during typing** — VO length ≈ action length for demo blocks, so speed factors stay near 1.0 for `screen` blocks and the retime band rarely needs to clamp.
- **Dead air is engineered out two ways:** (1) render waits are jump-cut (§2b); (2) wait-time is back-filled with WHY-commentary — "As you can see, I try to be as in-depth as I possibly can. This is very important for all models we are going to cover today. The more specific you are in your prompt, the better the result" (tQ84XYcP-nA). So a segment map for this style will have **few, short silence gaps** — mostly at section changes, not mid-demo. 040's ≥1.0s-gap rule will therefore key mostly on section transitions; verb-level boundaries may need the section-marker heuristic (§2c) as a fallback.
- **Callouts / on-screen directives** are frequent and short — "Feel free to take a screenshot, by the way, in case you'd like to" (eAUBU2hzsBA); "By the way, if you want to know how I ax all of the AI models in just one tool…" (tQ84XYcP-nA). These asides are candidates for graphic/text overlays (Plan 011 step 135 graphics), not new footage segments.
- **Verdict/opinion beats slow the visual, not the voice:** during "my personal opinion on pricing" the screen typically holds on a pricing page while narration continues — a natural `a4_block`/held-frame segment where 162 can substitute an avatar or a static card without losing sync.

---

## 4. Concrete suggestions to feed Plan 011

1. **040 boundary rule, augmented:** open a new segment at (a) an ASR ≥1.0s silence gap, (b) a section-change phrase ("now let's…", "that's it for…", "which brings us to step N", "let's move over to"), OR (c) a demo action verb ("I'll type/paste/click/select/generate/upload") that coincides with a gap. Tag intro, verdict/pricing, conclusion, and CTA blocks as `a4_block`; tag click/type/generate blocks as `screen`.
2. **125/162 render-wait handling:** add a segment flag for "render wait" (footage ≫ VO with no narration change) → **cut the interior** and keep head+tail frames, instead of applying max-speed retime. This matches how the channel actually edits and avoids the "footage exceeds VO at max speed" flag firing on every generation.
3. **Expect near-1.0 speeds for `screen` demo blocks** because narration is real-time over the action — clamps and freeze-pads should be rare; if 125 produces many clamped speeds, the segment boundaries are probably wrong (a block spans a render wait that should have been cut).
4. **Result-reveal blocks are their own segments** (time them against the *result* clip, not the action clip).
5. **Asides/callouts → 135 graphics overlays**, not footage segments — they're short, static, and additive.

---

## Caveat

Youri edits a real recording by hand (or with tools like Gling AI — "an automatic editing tool that allows you to cut out all of your mistakes… often will add up into the hundreds", _PB4MH2bGy4). Plan 011 works the other way: it derives cuts deterministically from the script segment map + TTS timing. The value here is the **boundary vocabulary** (action verbs, section-change phrases, render-wait cuts, verdict holds) that a screen-tutorial creator uses instinctively — encode those as 040's boundary signals and 125's retime exceptions, and the deterministic assembly will land cuts where a human tutorial editor would.
