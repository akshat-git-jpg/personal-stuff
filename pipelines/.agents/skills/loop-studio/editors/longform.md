# Format: LONGFORM — the designed treatment in 16:9, multi-minute (the YouTube explainer)

> **Treatment = [talking-head.md](talking-head.md) (designed motion-graphics). Creative mode =
> [creative-standard.md](creative-standard.md) (mandatory).** This file adds only what's specific to a
> multi-minute 16:9 explainer. This is the **default** for a main YouTube video / explainer / talking-head.
> The proven references are BusinessBrain (v7→v26) and LoopStudio (v1→v11) — per-act comps, full device
> library, documentary score.

## What's different about the LONGFORM shape
- **Canvas:** 1920×1080 (16:9). Acts render as separate comps (`Act1..ActN`) at locked VO durations, then stitch.
- **Structure:** split the script into **acts/chapters**; give each a comp and a `design_<name>_actN.json`
  screenplay. A chapter opens on a register shift (dark↔light) and a hero beat.
- **Retention (this is where longform is won or lost):** a named hook up front, an intro pyramid, and a
  **retention beat every 60–90s** — a reframe, a stat, a tease, a device change — so attention never flatlines
  (Law 6 at the macro scale). A curiosity teaser must *mean* something (Law 5), never a bare "?". See
  `video-taste` retention rules. Target ~70% retention at 0:30; run-time typically 9–11 min.
- **Score:** a **multi-track documentary bed mapped to structural sections** (not one loop for 10 minutes —
  that's the "one track becomes annoying" reject). Each track loops from its sustained core, sidechain-ducked
  **under** the VO, and dipped **harder** over tutorial/screenshare stretches. Voice centered, both ears.
- **Stats:** any real number gets a **real source** and a graph that plots the actual series (Law 10).
- **Device budget:** longform is where the full library earns its keep — cash-tower-vs-$0, atoms→computer,
  niche columns, platform-mark orbits, calendar, sourced-stat curve, review-room. Promote each into
  `concepts.tsx` when first reused (creative-standard §device-library); never re-hardcode a fourth copy.
- **Screenshares:** show the **real product UI / real published outcome** (Law 2), full-screen when pointed at (Law 3).

## Recipe
1. **Head:** recorded continuous take → cut with `core/engine/cut/` (mandatory), per-act voice baked as `<Audio>`.
2. **Project:** `projects/<name>/video.json`. Use the REAL shape (copy `projects/loopstudio-main/video.json`):
   a required **`throughline`** string (Law 0 made explicit) + a **`structure`** array of segments, each
   `{seg, file, type:"talking-head"|"screenshare", comp:"ActN", span, passthrough?}` — talking-head segs get a
   designed comp; screenshare segs pass through untouched.
   ```json
   { "mode":"talking-head","flavor":"explainer","aspect":"16:9","fps":30,"head":"recorded","brand":"<owner>",
     "throughline":"the ONE recurring motif that each act advances (e.g. 'the raw clip travels through stations')",
     "structure":[ {"seg":"th1","file":"source/th1.mp4","type":"talking-head","comp":"Act1","span":"cold open -> ..."},
                   {"seg":"ss1","file":"source/ss1.mp4","type":"screenshare","passthrough":true,"span":"demo: ..."} ] }
   ```
3. **Screenplay per act:** `design_<name>_actN.json`, one beat per clause, per creative-standard.
4. **Author** `ActN.tsx` from each spec (registers, footage `skf`, enacted concepts). Durations LOCKED to VO.
5. **Render** each comp (`render-film.mjs`), **sound** (`detect_events.py` → `build_sfx.py`), **mix + stitch + master** (`build_v<N>.sh`, frame-exact, −14 LUFS, centered voice).
6. **v1 self-audit** → publish (Gate A) → feedback loop (Gate B); **re-render ONLY the changed act** to iterate cheaply → learn.

## Format checklist (on top of the v1 self-audit)
- [ ] Named hook + intro pyramid; a retention beat every 60–90s?
- [ ] Multi-track score mapped to sections, ducked under VO (harder over screenshares), not one loop?
- [ ] Every real stat sourced, graph plots the real series?
- [ ] Screenshares are the real UI / real published outcome, full-screen when pointed at?
- [ ] Acts stitched frame-exact, voice centered in both ears, −14 LUFS?
