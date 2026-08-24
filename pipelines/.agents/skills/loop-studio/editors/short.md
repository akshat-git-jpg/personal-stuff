# Format: SHORT — the designed treatment in 9:16 (reel / TikTok / YouTube Short)

> **Treatment = [talking-head.md](talking-head.md) (designed motion-graphics). Creative mode =
> [creative-standard.md](creative-standard.md) (mandatory).** This file adds only what's specific to the
> 9:16, ≤60s shape. Everything else — engine, cut, screenplay method, sound, mix, the 10 laws, the v1
> self-audit — comes from those two. A short is not a lesser video; it's the full creative standard at a
> tighter shape.

## What's different about the SHORT shape
- **Canvas:** 1080×1920 (9:16). Comps are portrait; the lime-offset panel and every device is composed
  vertically (stack top/bottom, not left/right). Full-screen face is the default; graphics take the free third.
- **Runtime:** ≤60s (ideally 20–45s). **One idea only.** If it needs two ideas, it's two shorts.
- **Beat density:** 3–6 beats, fast. Every clause still gets its own enacted beat (Law 6) — the cadence is
  quicker but the "something happens on the spoken word" rule is stricter here, not looser.
- **Hook:** the first **1.5–3s** must land the promise on the face, full-screen, then hit the first enacted
  beat by ~2s. A short lives or dies on the first second — apply Law 7 (hook = highest polish) hard.
- **Captions:** ALWAYS on — phrase-level, kept inside the **middle-70% safe zone** (never under the platform
  UI top-10% / bottom-20%). One or two words emphasized, brand caption style from `brand-book.md`.
- **Subscribe bug:** composite the channel subscribe asset ONCE, between 60–80% of runtime, as a small
  overlay in the safe zone (never over the final CTA). Asset + rules: `video-feedback`/brand assets.
- **Sound:** one music track (no multi-section score — too short to justify it), kept under the VO; subtle
  word-synced SFX. Voice centered, both ears.
- **Close:** one spoken CTA beat, one clean end plate. No credits roll.

## Recipe
1. **Head:** recorded → cut with `core/engine/cut/` (mandatory method, see talking-head.md); or AI → `avatar-video`.
2. **Project:** `projects/<name>/video.json` → `{ "mode":"talking-head","format":"short","aspect":"9:16","fps":30, ... }`.
3. **Screenplay:** `design_<name>.json`, 3–6 beats, per creative-standard. Vertical `mode`/`object` framing.
4. **Author + render** the portrait comp in the engine; **sound**; **mix** (centered voice, one bed).
5. **v1 self-audit** (creative-standard) → publish to reviewer (Gate A) → feedback loop (Gate B) → learn.

## Reference comps & mechanics (stand on these — don't rebuild from scratch)
- **Proven 9:16 comps to copy from:** `src/shorts/` — `S83Short`, `LessIsMoreShort`, `LeftLovableShort`,
  `PromptMachineShort`, `AiLonelyShort` (+ `FishShort`) — all real 1080×1920, registered in `Root.tsx`.
  Open the closest one and reuse its portrait layout instead of re-deriving vertical composition.
- **Captions (word-timed karaoke):** the working impl is `FishShort.tsx` reading a word-timing JSON
  (`fishshort_s1.json` shape). Word timings come from the cut step (`core/engine/cut/`) — reuse this,
  don't invent a caption mechanism.
- **Render a portrait comp:** register it in `Root.tsx` at 1080×1920, then
  `COMP=<CompId> SCALE=1 OUT=out/<id>.mp4 node render-film.mjs`.
- **Mix:** there's no `build_short*.sh` — adapt a `build_v<N>.sh` (voice centered, one bed ducked under
  the VO, −14 LUFS), dropping the multi-act stitch. Keep it one continuous bed.

## Format checklist (on top of the v1 self-audit)
- [ ] 9:16, one idea, ≤60s, hook landed by ~2s?
- [ ] Captions on and inside the middle-70% safe zone; nothing under platform UI strips?
- [ ] Subscribe bug once, 60–80%, not over the CTA?
- [ ] Every device composed vertically (no left/right layout borrowed from 16:9)?
