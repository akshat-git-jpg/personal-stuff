# intro-kit — how to operate here

Human-facing tour: [README.md](README.md). The locked contract every card
must obey: [KIT.md](KIT.md).

## The kit is locked on purpose

Seven cards, five motion moves, one palette — derived from four reference
intros the owner measured (see `plans/219-vf-intro-kit-cards.md`). Its value
is that it is the SAME every video.

- **Adding an 8th card is an owner decision**, recorded in `decisions.md`, not
  a session's judgment call. If a video seems to need a treatment none of the
  7 cards cover, that is a finding to report, not a card to add.
- **Never edit a locked card to fit one video.** Content differences are what
  the `data-composition-variables` / `--variables` mechanism is for. If a
  card's variables can't express what a video needs, that is also a finding
  to report, not a reason to bend the card.
- **`logo-grid`'s blur is a documented, one-off exception** to
  `DESIGN.md`'s "never express focus with blur" — the blur IS the content
  (tools becoming noise), not a focus effect. Do not copy it into another
  card, and do not "fix" it back out.
- **`lower-third` is the only overlay card** (`"overlay": true` in
  `kit.json`). If a second overlay card is ever added, plan 220's pacing
  lint (which counts overlay beats as avatar time, not graphics time) must
  learn about it too.

## The `logos` / `shots` symlink pattern

`hyperframes render <card>` treats each card's OWN folder as the served
document root (confirmed empirically, 2026-08-22) — a relative `img.src`
inside `cards/<slug>/index.html` resolves against `cards/<slug>/`, not
against the kit root. So a card that references `logos/` or `shots/` needs
its OWN symlink inside its own folder, even though the kit root already
carries `logos -> ../card-library/logos`:

```bash
cd cards/<slug> && ln -s ../../logos logos && ln -s ../../shots shots
```

Local (non-`--docker`) rendering follows these symlinks transparently — the
render's file server has no symlink-containment check in that mode. This is
also why the original `logo-grid` card that shipped without its own `logos`
symlink rendered with `media_load_failed` and blank white tiles instead of
real logos: the warning is non-fatal (the render still "succeeds"), so a
session must always look at the contact sheet, not just the exit code.

## Before committing a card

1. Render it: `npx hyperframes@latest render cards/<slug> -o renders/<slug>.mp4 --fps 30`.
2. Extract a contact sheet: `ffmpeg -v error -i renders/<slug>.mp4 -vf "fps=4,scale=480:-1,tile=4x4" -frames:v 1 frames/<slug>.jpg -y`.
3. **Look at `frames/<slug>.jpg`.** A card that renders its heading and an
   empty stage is the exact defect `scripts/check.sh` is written against
   (LESSONS 2026-07-31) — but a human eye catches things the checker's
   thresholds don't (broken images, wrong colours, awkward wrapping).
4. Run `bash scripts/check.sh`. It must print `intro-kit check OK`.
5. Commit the card's `index.html`, any symlinks it added, and its contact
   sheet together.

## The gate is a real render, not a text match

`scripts/check.sh` / `lib/check-kit.mjs` renders every card headless via
puppeteer-core, seeks its own `window.__timelines[id]`, and asserts on the
resulting PIXELS and DOM. Do not weaken a threshold or add a per-card
exemption to make a failing card pass — fix the card. The mutation recipe in
the plan (deleting `<div id="rows">` from `checklist`) exists specifically to
catch a checker that only greps source text; keep it green.
