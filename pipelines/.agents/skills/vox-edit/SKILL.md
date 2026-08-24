---
name: vox-edit
description: >
  Build Vox-style explainer sections as ONE CONTINUOUS CAMERA FLIGHT through a single generated
  world — Higgsfield stills → chained Seedance clips → Remotion caption/data layer. Encodes the
  hard-won method from the 2026-07-22 bake-off: how to make cuts genuinely invisible (chain forward
  from real last frames — NEVER use end_image), the Vox motion grammar (12fps stutter, highlighter,
  never-still, graphics that argue), and the verification tests that catch the failures.
  TRIGGER when the owner wants a Vox-style / explainer / documentary-style animated section, a
  "one continuous world" sequence, cut-paper diorama visuals, or an AI-generated b-roll flight with
  data graphics over it. Pairs with `loop-studio` (which owns the render engine and brand).
---

# Vox Edit — one world, one flight, invisible cuts

Generate the WORLD, code the ARGUMENT. Higgsfield paints, Seedance moves, Remotion writes every word
and number. No generated pixel ever renders text.

## Requirements — read before promising anything (BETA)

Vox Mode is the one Loop Studio capability that is NOT fully local:

- **The generated world requires a Higgsfield account** (higgsfield.ai) with their MCP connected.
  Stills and clips are generated on Higgsfield's service and consume THEIR credits — a ~15s
  three-clip section costs on the order of 100–150 Higgsfield credits. This is a third-party cost,
  separate from the Claude/Codex plan.
- **Everything else stays local** like the rest of Loop Studio: the Remotion graphics layer,
  captions, cutting, rendering and verification run on the owner's machine at no extra cost.
- **Beta.** The pipeline is new; Windows is untested for the generation steps (the render and
  verification layers are the same cross-platform engine as the rest of Loop Studio).

If the owner has no Higgsfield account, say so up front instead of starting — the graphics layer
alone (captions, highlighter, data graphics over existing footage) still works without it.

---

This skill exists because a naive version of this pipeline looks good and **feels shallow**. The
difference is entirely in the transitions, the motion grammar, and whether the graphics do
explanatory work. All three are solved below — including two traps that cost a full afternoon.

---

## 🚨 THE ONE RULE — never use `end_image` to chain clips

**This is the single most expensive lesson in this skill. Read it before generating anything.**

Seedance 2.0 accepts `start_image` AND `end_image`. It is extremely tempting to chain clips by
setting clip A's `end_image` to clip B's `start_image` — the cut becomes pixel-perfect.

**It works for the cut and destroys the shot.** Forcing an end frame does not make Seedance find a
physically coherent camera path to that target. It **warps the geometry** toward the composition:
objects slide through each other, the camera lurches, the miniature deforms. This was caught instantly in review — *"one electricity tower is just moving into the other one"*, *"it is really shaky"* —
at timestamps that were **not cuts at all**. The damage was mid-clip.

### ✅ The correct method — CHAIN FORWARD from the real last frame

```
clip A: start_image = still 1, NO end_image     → moves naturally
        ↓ extract A's ACTUAL final frame, upload it
clip B: start_image = that frame, NO end_image  → moves naturally
        ↓ extract B's ACTUAL final frame, upload it
clip C: start_image = that frame
```

Cuts stay pixel-identical — clip B literally opens on clip A's closing frame — but nothing is
forced, so nothing warps. **Best of both, no trade-off.**

Cost: the chain is **sequential**. Each clip must finish before the next starts (~3 rounds
back-to-back, not 3 in parallel). Budget ~25 min for 3 clips, not ~10.

Exact commands: [reference/pipeline.md](reference/pipeline.md)

**Bonus, verified:** chaining forward also **fixes palette drift** instead of compounding it. Under
`end_image` the pylons kept coming back brown despite "NO brown" in the prompt; chaining from a real
on-palette frame gives the model a coherent anchor and the browns disappeared.

---

## The pipeline

1. **Design the flight** — one continuous camera journey through ONE connected world, with the
   waypoints being the beats of the argument. Not three scenes; one place you travel through.
2. **Generate the waypoint stills** (Higgsfield `nano_banana_pro`, 2k/4k) — these anchor the style
   and the composition. See [reference/prompts.md](reference/prompts.md).
3. **Chain the clips** (Seedance `seedance_2_0`, 720p for iteration) — forward-chained, never
   `end_image`. Rigid-body prompt language is mandatory.
4. **Cut on the VO's silence** — never on arithmetic thirds. Detect the gaps, place cuts inside them.
5. **Layer the Remotion graphics** — captions, highlighter, the graphic that argues.
6. **Verify, then publish** to the reviewer.

---

## Vox motion grammar (the layer that makes it read as Vox)

Core principle:
**animations EXPLAIN, they do not decorate.** If a graphic isn't advancing the argument, cut it.

| Move | Implementation |
|---|---|
| **12fps stutter** | Quantise the graphic layer's frame: `qt = Math.floor(frame/2)/FPS`. Half the timeline rate. Most recognisable Vox tell. |
| **Highlighter** | `Marker` from `bb2/scene` — lime sweep on the ONE load-bearing word of a caption. |
| **Jagged step reveal** | Caption plate wipes in 5 discrete steps (`Math.ceil(raw*5)/5`), text delayed ~0.13s behind the plate. |
| **Never-still** | Grain that steps to a new offset every ~0.4s. Nothing on screen is ever frozen. |
| **Graphics that argue** | Not a counter — a bar RACING a labelled reference line, which reacts when passed, with a payoff tag that only appears once the claim is true. |
| **Parallax** | Graphic plane counter-drifts against the camera direction. |

---

## Hard-won rules (each one cost a round)

1. **Cut on the VO's silence.** Arithmetic thirds put a cut mid-sentence. Detect gaps in the audio
   and place cuts inside them.
2. **Graphics must CLEAR before a cut.** A graphic straddling a cut betrays it even when the footage
   is perfectly seamless. End the data graphic ~0.5s before the cut.
3. **The graphic carries its own darkness.** A continuous flight CANNOT reserve empty frame space —
   the camera keeps moving and fills it. Don't prompt "keep the left third empty"; give the graphic
   a directional scrim tied to its own opacity.
4. **The camera must never retreat at a cut.** If entry scale goes `1.18 → 1.00` that's a pull-back
   before the push — it reads as "goes back a bit, then forward". Entry should GROW (`0.96 → 1.00`).
5. **A match cut must be a HARD cut.** A dissolve shows both shots at once and destroys the
   illusion. If shapes align, swap on ONE frame. If you need blur+bloom to sell a cut, the cut
   isn't working — fix it upstream.
6. **Vary the camera axis.** Three identical dollies = one second in, you know what happens. Use
   pull-back / crane-down / lateral-track so each beat opens on something unplaceable.
7. **Simplicity is the tell.** When the transition method is right, the transition CODE nearly
   disappears. A real seam costs code to hide; an absent seam costs none. If you're writing
   elaborate transition code, you're fixing it in the wrong layer.
8. **Characters need an anchor, not a description.** Prompt language alone invents a NEW person
   every still ("a paper-craft person hunched at a desk" ≠ the same man twice). Once a hero
   character exists, EVERY subsequent still showing them must pass the hero still as an `image`
   reference (nano_banana_pro medias role `image`) with "THE EXACT SAME man from the reference —
   same head, same hair, same shirt" in the prompt. Chained clips inherit the character for free;
   independently-generated vignettes do NOT (caught in testing: the montage's time-lapse
   man didn't match the hero from shot 2).
9. **Chained shots keep their chain even inside a montage.** When retiming a shot whose NEXT shot
   was chained from its final frame, trim the HEAD (`from`) and solve the rate so the LAST source
   frame lands exactly on the cut: `rate = (srcLen − from) / window`. Trimming or rate-limiting the
   TAIL skips the shared frame and the "invisible" cut jumps (cost a round on 2026-07-22: shot
   ended at source 3.4s while its successor began on the 4.0s frame — 0.6s of missing footage).
10. **Seedance does NOT reproduce a `start_image` exactly — a chained cut may still need a short
    dissolve (2026-07-23).** Chaining a clip forward from an extracted frame removes the ENVIRONMENT
    pop (props, dressing) but the model reinterprets the start frame, often opening a touch wider/
    dimmer than the frame it continues from. On a cut that is MEANT to flow, add a ~7-frame
    crossfade (`xin`) on that one boundary to blend the residual light/framing shift. This does NOT
    contradict rule 5 (match cuts stay hard) — a match cut hides a shape TRICK, this hides nothing,
    it just smooths two near-identical frames. Keep the deliberate montage cuts hard (`xin` unset).
    Fix caught in review: the chained time-lapse killed the lamp-pop but left a bright-tight → dim-wide
    jump; a 7f dissolve closed it.

---

## Verification (never skip — averages hide these)

**The 8-frame strip test.** Tile 8 consecutive frames spanning each cut:
```bash
ffmpeg -v error -ss <CUT-0.10> -t 0.24 -i out.mp4 -vf "scale=370:-1,tile=4x2" -frames:v 1 strip.png
```
**Pass condition: you cannot identify which frame is the cut.**

**Per-clip motion + jitter:**
```bash
ffmpeg -v error -i clip.mp4 -vf "select=gt(scene\,0),metadata=print:file=-" -f null - 2>/dev/null \
 | grep -o "scene_score=[0-9.]*" \
 | awk -F= '{s+=$2;n++; if($2>m)m=$2} END{printf "avg=%.4f max_spike=%.4f\n", s/n, m}'
```
A low average with a high `max_spike` means a lurch — look at the frames, don't trust the average.
This is exactly how the frozen-scene bug and the warp bug both hid.

**Always eyeball the arc:** tile 6 frames across each clip to confirm the camera actually travels
and the geometry stays rigid.

---

## Engine

Renders through the Loop Studio Remotion engine
(`~/.claude/skills/loop-studio/core/engine/remotion/`), bb2 design system, brand tokens.
Reference implementation: `src/VoxTestV6.tsx` + `src/index-vox.tsx` (comp `VoxV6`).
Details: [reference/remotion-layer.md](reference/remotion-layer.md).

Iterate at **1280×720** (~4 min/render); master at 1920×1080. Blur/scale must be proportional to
frame width so both look identical.

## Known-unsolved

- **Texture drift toward photoreal.** As the camera pulls back to wide, the cut-paper/torn-fibre
  quality thins and surfaces read as smooth 3D plastic. Macro frames hold the paper look; wides lose
  it. Not yet solved by prompt alone — candidate fixes: shorter clips, more waypoint stills to
  re-anchor, or a grain/texture pass in post.
