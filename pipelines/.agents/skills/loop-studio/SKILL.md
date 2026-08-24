---
name: loop-studio
description: >
  Luuk's in-house AI edit studio — the ONE front door for making any video end to end:
  understand the content → plan → assemble/cut → grade → caption → score → brand → review.
  It routes to the right EDITOR (short, longform, intro, talking-head/explainer, vlog) and shares one
  core: the creative standard, taste memory, brand book, review loop, ingest, assets, render engine.
  TRIGGER whenever Luuk wants to make, edit, assemble, cut, caption, grade, or finish a video, or
  review/apply feedback on one. Personifiable as "Loop Studio".
---

# Loop Studio — one studio, many editors, one brand, one taste

The single system for Luuk's video work. You are the studio: understand what he's making, pick the
editor for that FORMAT, and run it in **full creativity mode** using the shared core. Every output is
on-brand, every first version is already creative, and every review round makes the studio smarter.

## 🎯 THE STANDARD — full creativity mode, from the FIRST version (read this before anything)

The #1 job of this skill is that **v1 is already creative** — not a flat first pass that needs nine
rounds of "make it more visual." The reviewer must never have to *ask* for creativity. Before you
author a single beat, read **[editors/creative-standard.md](editors/creative-standard.md)** and obey it.
The one-line version: **understand the WHOLE video's core concept first and give it a through-line that
recurs across scenes, then make every spoken idea a picture that *does* the idea** — enacted not
labelled, real not sketched, full-screen not corner-carded, cinematic on numbers, synced to the voice,
built-not-empty, with text and icons in service of the picture. That document holds Law 0 (whole-video
understanding + through-line), the 10 laws + a richness floor, the mandatory design-spec screenplay
method, the device library, and a **falsifiable** v1 self-audit (check pixels, not intent). Not optional.

## Bespoke, not templates (the standard — 2026-07-14)
**Every video is a Loop Studio project, authored in the bespoke Business Brain design language, NOT
dropped into a template.** The flagship Remotion engine lives inside the studio at
`core/engine/remotion/` (`src/bb2/` design system + `build_sfx.py` + `build_v<N>.sh`). The old
template motion-library approach (in the retired `video-edit` skill) is **superseded** — we
hand-author per-beat scenes in the design system and let `creative-standard` + `video-taste` be the bar.
When a video "must look designed," that IS the default, not the exception.

## How it's organized
```
loop-studio/
  SKILL.md                    ← you are here: the router + the loop
  editors/
    creative-standard.md      ← 🎯 THE creative mode (10 laws + screenplay method + device library + v1 audit)
    talking-head.md           ← THE designed treatment (= explainer / YouTube / talking-head): text + icons + enacted concepts
    short.md · longform.md · intro.md   ← the 3 FORMATS the designed treatment ships in
    vlog.md                   ← the other treatment: assemble a cinematic vlog from raw shoot footage
  core/                       ← SHARED by every editor (don't duplicate)
    brand/brand.json + brand-book.md   ← per-OWNER tokens: colors, fonts, captions, logo, LUT
    taste  → skill `video-taste`      (compounding quality bar + learned prefs)
    review → skill `video-feedback`   (the reviewer + "feedback done" loop + live check-offs + version history)
    ingest → skill `broll-ingest`     (transcode + stills/transcript/description metadata)
    engine/
      remotion/   ← THE flagship engine: Remotion 4 · src/bb2/ design system · design_<name>.json specs · build_sfx.py · build_v<N>.sh
                    ⚠ EDITING/CUTTING a comp with talking-head footage? READ remotion/COMPED_EDIT_GOTCHAS.md FIRST — the schema of every bug hit on the Fish videos (jumpy render-cuts, avatar snap→cross-dissolve, glued-speech audio mux, ASR misreads, LUFS matching). Do these or reintroduce a paid-for bug.
      cut/        ← THE cutting authority (MANDATORY, no other way). Raw takes follow the NON-NEGOTIABLE R1–R9 in cut/METHOD.md: LITERAL transcribe + forced-align → LAST-take selection (R1) → finish.py (wave_snap → level_cut → tighten) → cut.py verify. The WAVEFORM is ground truth, the transcript drifts ~2s + collapses doubles (R2/R3). Removing a word/phrase from a FINISHED video (e.g. cut a spoken model name): LLM-based cutting w/ transcription + sound waves — broadband AND high-pass(>4kHz) to protect the word's sibilant release (whisper word-ends miss it), verify on the rendered output. See cut/METHOD.md.
      vlog/       ← the vlog assembler (plan.json-driven)
  projects/<name>/            ← ONE folder per video: video.json · source/ · specs|scenes/ · renders/ · reviews/
```

**Step 0 — first run only: prove the toolchain BEFORE you get creative.** On the FIRST video on a new
machine (or any time you're unsure the engine renders), smoke-test it with ONE short clip on the
**default brand, zero customization** — no font swap, no brand edits, no creative pass — using the engine's
own test render / `doctor` (see `core/engine/`). If the doctor flags missing system tools (ffmpeg, node,
a whisper backend), run **`python3 core/engine/setup.py`** to install them — that IS expected setup, not a
"dev environment" you should refuse; torch is optional (only the raw-take cutter needs it). **You do NOT
need to audit, refactor, or analyze the engine** to do this; it ships working. Only once that clean render succeeds do you move into the workflow
below and start customizing. Front-loading a brand / font / creative-standard audit before a single frame
has rendered is the #1 way first installs get stuck — don't do it.

## The workflow (any video — never skip a step)
1. **Understand** the content (subject, promise, format). Ask if unclear; never guess the premise.
2. **Route by FORMAT** (table below) — then use EXACTLY what that editor names; never freestyle the look.
3. **Set up the project folder:** `projects/<name>/video.json` = mode/flavor, aspect, fps, grade,
   subject/identity, brand variant, music, and the beat/comp map. Everything runs **inside this folder** —
   source, specs, renders, and its review/version history. Never scatter a video across `~/Downloads`.
4. **Understand the whole, then author the screenplay in full creativity mode.** FIRST distill the
   video's ONE core concept and design a **through-line** — a motif/object that recurs and evolves across
   scenes (Law 0) — plus the digestible frame for the hard ideas. THEN write `design_<name>.json` per
   [creative-standard.md](editors/creative-standard.md): a `concept` block, then one beat per spoken clause
   (enacted objects, register/mode/continuity/one-marker-copy/sync) — **before any JSX.** The whole-video
   understanding + through-line is what makes v1 actually creative, not just busy.
5. **Load the core BEFORE the first render:** `core/brand/brand.json` + `brand-book.md` + `video-taste`
   (`universal.md` + the editor's `by-type` if present + `by-subject`) + `creative-standard.md`. Apply to the first **creative** render (Step 0's smoke test stays on the defaults — customize only after it renders clean).
6. **Build** with the editor's recipe (engine + sound + mix). Run the **v1 self-audit** (creative-standard) before publishing.
7. **Review — MANDATORY on EVERY render, automatically. Two hard gates, both non-negotiable
   (both were missed in the loopstudio-intro rounds — the whole point of this step):**

   **Gate A — publish + PASTE THE URL, every time, unprompted.** The instant ANY render finishes —
   the FIRST cut and every version after — publish it to the reviewer and end your message with the
   clickable URL. Never hand over a video file without its review link, and never wait to be asked.
   ```bash
   # $LS = your skills dir (Claude Code: ~/.claude/skills · Codex: ~/.agents/skills)
   LS=~/.claude/skills; [ -d ~/.agents/skills/video-feedback ] && LS=~/.agents/skills
   python3 "$LS/video-feedback/scripts/make_review.py" <FINAL.mp4> --project <Name> --label v<N>
   # if curl http://127.0.0.1:<port>/review.html isn't 200: (cd <Review> && nohup python3 serve.py &)
   # then ALWAYS end the message with:  http://localhost:<port>/review.html
   ```

   **Gate B — on "feedback done", tick each note off LIVE as you fix it** (the page polls every 2.5s,
   so Luuk watches the to-dos scratch off — this is what he means by "seeing items checked off"):
   ```bash
   # $LS = your skills dir (Claude Code: ~/.claude/skills · Codex: ~/.agents/skills)
   LS=~/.claude/skills; [ -d ~/.agents/skills/video-feedback ] && LS=~/.agents/skills
   # 1) read the notes WITH ids:
   cat <Review>/feedback_latest.json      # ids come from here
   # 2) as EACH fix lands (incrementally, not one batch at the end):
   python3 "$LS/video-feedback/scripts/post_status.py" <Review> "<Name · vN>" \
     '{"<id>":{"status":"fixed","message":"what you changed"}}'
   ```
   ⚠ If Luuk **pasted** the notes instead of using the tool, `feedback_latest.json` won't exist and there
   are no ids to tick — so FIRST get them onto disk: ask him to click **"✓ Send to Claude"** once (writes
   the json), then check off against those ids. Use `"question"` ONLY when a note is genuinely too vague.
   Then re-render → **re-publish (Gate A again) → re-share the URL.** Every render is a new version — the
   reviewer keeps the ordered `versions.json` + `versions/<label>.mp4` history automatically.
8. **Learn:** fold every general lesson into `video-taste`, and when a round demands a new enactment,
   **promote the device** into `bb2/concepts.tsx` (creative-standard §device-library) — so it's never re-asked.

## Route by what you're making (the map)
There are **two treatments** and, for the designed one, **three formats**. Explainer videos, YouTube
videos, and talking-head videos are **the same thing** — the designed treatment (text + icons + enacted
concepts). Short-form, long-form, and intros are just the shapes it ships in, and they all use the
**talking-head** treatment. `vlog` is the one genuinely different editor.

| You're making… | Treatment (the HOW) | Format editor (the SHAPE) |
|---|---|---|
| A YouTube explainer / talking-head main video | **talking-head** (designed motion-graphics) | [longform.md](editors/longform.md) |
| A 9:16 short / reel / TikTok | **talking-head** (designed) | [short.md](editors/short.md) |
| A cold-open intro / hook film (≤~40s) | **talking-head** (designed) | [intro.md](editors/intro.md) |
| A vlog from a shoot's raw clips + monologue | **vlog** | [vlog.md](editors/vlog.md) |
| A Vox-style explainer section — one continuous camera flight through a generated world, with data graphics that argue | **Vox Mode (BETA)** | [../vox-edit/SKILL.md](../vox-edit/SKILL.md) — requires a Higgsfield account for the generated world; read its Requirements section FIRST |

Every designed format reads **[creative-standard.md](editors/creative-standard.md)** + **[talking-head.md](editors/talking-head.md)**
(the treatment) and adds only what's specific to its shape (aspect, duration, beat density, hook timing,
captions). Head source: **recorded** → cut with `core/engine/cut/` (mandatory method); **AI** → `avatar-video`.

## Brand is the gate on ALL creative work — and it's per-OWNER
Read `core/brand/brand.json` (machine-readable tokens) + `core/brand/brand-book.md` BEFORE any creative
decision — the first cut, and **especially any "go full creativity" pass.** Creativity lives in the ideas,
the enactment, and the motion; the **palette / type / names are LOCKED to `brand.json`.** Never hardcode a
brand value in a scene or invent an off-brand colour, even when going wild — wild concept, locked look.

**Branding is per-owner and swappable.** This instance is branded **BuildLoop** (the current owner). A
buyer of Loop Studio swaps `brand.json` + `core/brand/assets/` for their own brand and every output
re-skins automatically — same engine, same taste, their look. Keep the engine palette
(`core/engine/remotion/src/bb2/engine.tsx`) a mirror of `brand.json`; if the owner changes, update both.
So: when Luuk (or any owner) says "go full creativity," the FIRST move is to load the brand and run the
creativity **inside** it — never to freestyle a look.

## Relationship to existing skills
Loop Studio is the umbrella and OWNS its flagship engine (`core/engine/remotion/`, moved in from the
retired `video-edit` skill 2026-07-14). `video-feedback`, `video-taste`, `broll-ingest` are its core services
(kept as their own skills — genuinely reused standalone, referenced not copied so they can't drift).
`avatar-video`, `thumbnail`, `buildloop-slides` are studio capabilities an editor can call.
`motion` and `video-edit` are **LEGACY** (template/viz-catalog systems) — do not call them; author animation
bespoke in the engine per `creative-standard.md`.

## State (honest)
- `editors/creative-standard.md` — the creative mode, built from the LoopStudio v2→v11 / BusinessBrain
  v7→v26 feedback arc. This is the anti-"flat v1" gate; every designed editor points at it.
- `core/engine/remotion/` — **THE flagship engine.** Proven BusinessBrain v7→v26 + LoopStudio v1→v11.
  The **shared** `bb2` library holds the Act-1-era primitives; the richer devices later feedback forced
  (cash-tower-vs-$0, atoms→computer, niche columns, platform marks, calendar, sourced-stat graph,
  review-room) still live **hardcoded** inside `LSAct2/3/4.tsx` — promote them into `concepts.tsx` when
  reused (creative-standard §device-library). ONE home for the engine — never keep a second copy.
- `editors/short.md · longform.md · intro.md` — the three designed formats (all use talking-head + creative-standard).
- `core/engine/vlog/` — still to generalize `render_film.py` (trip-specific) into a config-driven engine; do it against the NEXT vlog.
- The buyer BUNDLE (`scripts/build_bundle.py`) ships the engine **source** (src/bb2 + build scripts +
  package.json + logos) — small (~5MB), complete, and clean; it allow-lists the engine and denies
  node_modules/out/public-footage/licensed-music so a build can never leak personal assets or balloon.
