# Loop Studio v0.13.0 — read me first (yes, you — Claude Code or Codex)

> **Which skills directory?** These skills work in BOTH Claude Code and Codex — they use the same open
> Agent Skills format. Install them into YOUR agent's skills directory:
> **Claude Code → `~/.claude/skills/`** · **Codex → `~/.agents/skills/`**.
> Every path below is written for Claude Code; if you're Codex, swap `.claude` → `.agents` everywhere.

This bundle was just installed for a NEW BUYER. Their machine is not the author's:
1. Copy everything in `skills/` into your agent's skills directory (see above — merge, don't overwrite newer files).
2. Run the doctor: `python3 ~/.claude/skills/loop-studio/core/engine/ls_platform.py`
   — install anything it flags (ffmpeg, whisper backend, **Node + npm**) before continuing.
3. Install the engine's dependencies once:
   `cd ~/.claude/skills/loop-studio/core/engine/remotion && npm install`
   (only `package.json` ships — `node_modules` is rebuilt here, not downloaded.)
4. Fill the brand: `skills/loop-studio/core/brand/brand.json` + `brand-book.md` (interview the buyer,
   then write the files). The engine IMPORTS brand.json and derives its whole palette — editing the
   `colors` there re-skins every scene automatically, NO code edits. (Only changing FONTS also needs
   swapping the 3 `@remotion/google-fonts` loader imports at the top of `.../remotion/src/bb2/engine.tsx`.)
5. Ask the buyer to fill `skills/video-taste/by-subject.md` (who they are on camera).
6. First run: ask for ONE short video and run the reviewer on it
   (`python3 ~/.claude/skills/video-feedback/scripts/make_review.py <file> --open`) so the buyer
   gets a ship-moment in minute one.

## Keep it simple (don't over-engineer the install)

You do NOT need to audit, refactor, or analyze the engine source to install or to
make that first video. Install the skills as-is, run the doctor, render ONE test
with the DEFAULT brand, THEN customize. Customizing is small and direct — for fonts
it's just the 3 `@remotion/google-fonts` loader imports at the top of
`core/engine/remotion/src/bb2/engine.tsx` plus `brand.json` (the legacy `src/bb/`
files are reference only, not the active render path). Don't spin up multi-agent
audits of the engine for this — it's a few lines.

## How to make a video
`loop-studio/SKILL.md` is the front door. **Read `editors/creative-standard.md` before authoring
anything** — it is the "full creativity mode" that makes the first version already good. Route by
format (short / longform / intro), all using the `talking-head` designed treatment; or `vlog` for
raw-shoot assembly. Every video runs inside a `projects/<name>/` folder with the reviewer's
feedback + version-history loop attached.

## About the shipped engine source
`core/engine/remotion/src/` includes the author's REFERENCE scenes (e.g. `LSAct*.tsx`,
`design_*.json`, `bb2/`) as a learnable **device library** — this is where the high-quality edits
come from, and `creative-standard.md` points at them by name. They reference the author's own media
(footage, music, stills) which is NOT shipped, so those specific comps won't render as-is — study
them, reuse the `bb2/` primitives, and author your own comps + `design_<name>.json` for the buyer's
footage. Only the generic brand logos ship under `public/logos/`.

The taste memory GROWS: after every review round, fold general lessons into `video-taste/` and
promote any new enacted device into `bb2/concepts.tsx` (see `creative-standard.md`).
