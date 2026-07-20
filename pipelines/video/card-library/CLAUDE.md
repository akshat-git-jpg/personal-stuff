# card-library — how to operate here

Human-facing tour of the cards, editing, and rendering: [README.md](README.md).
Visual rules every card must follow: [DESIGN.md](DESIGN.md).
This file is the operating contract: **where a new card must live, and how it
reaches the editor.**

## The one rule: a card is only real once it is pushed

The editor never opens a terminal. He works from the Templates tab at
**https://render2.agrolloo.com**, and that tab is a **live directory scan** of
this folder — on the VPS it is mounted read-only as `/cards`.

So a card appears to him when, and only when, it is:

1. shaped **`<type>/<card-name>/index.html`** — one folder per card, and
2. **committed and pushed** to `origin/main`.

The VPS `repo-sync` cron (`*/15`) pulls `personal-stuff`, so a pushed card is
live within ~15 minutes. **There is no registration step and no redeploy.**

The corollary is the trap: a card saved locally and never pushed is invisible to
the editor **forever, silently** — nothing errors, it just never shows up.
`verdict/winners-podium` was built for test-02 and sat untracked for a day
exactly this way (found 2026-07-20).

Verify with:

```bash
bash scripts/check-cards.sh              # structural — run before committing
bash scripts/check-cards.sh --publish    # also requires everything PUSHED
```

## Two registrations, not one

They are independent, and a card can satisfy one while failing the other:

| Consumer | Needs | Symptom if missing |
|---|---|---|
| render2 Templates tab | the folder `<type>/<card>/index.html` | editor cannot see or render the card |
| visuals-flow cue pass | a `catalog.json` entry (`slug: "<type>/<card>"`) | LLM never selects the card; it exists but is never used |

`gallery-order.json` is **ordering only**, not a whitelist — it pins chosen
cards to the front of the Templates tab; everything unlisted still appears,
alphabetically after them. Add a card there only to make it easy to find.

## Adding a new card

1. `mkdir <type>/<card-name>/` and write `index.html` (copy the nearest existing
   card — the TIMELINE block is the shared motion feel, leave it alone).
2. Follow [DESIGN.md](DESIGN.md) — palette, typography, layout capacity, motion.
3. Add a `catalog.json` entry so visuals-flow can select it.
4. `npx hyperframes@latest lint <type>/<card-name>` (the "Studio can't drag-edit"
   and "Google Fonts" warnings are expected).
5. `bash scripts/check-cards.sh`
6. Commit **and push**.

Pick `<type>` from the folders that already exist (`title/`, `section/`,
`comparison/`, `verdict/`, `process/`, …). A new type is fine — render2 picks it
up automatically — but every top-level folder is scanned as a card type, so do
not park anything else at this level. `brand/` and `logos/` are the existing
non-card exceptions and are listed in the checker's IGNORE.

## End of a video: publish the templates

Cards built for a specific video are exactly the ones that get stranded. When a
video is finished, run:

```bash
bash scripts/check-cards.sh --publish
```

It fails on anything uncommitted or unpushed and prints the offending commits.
Once it passes, render2 serves the new cards within ~15 minutes.

## Never commit here

Generated media and test output — the house rule from `pipelines/CLAUDE.md`.
Renders belong in `~/kb-scratch/`, test temp dirs belong under the owning
flow's gitignored `.test-tmp/`. A `flow/` directory used to live here — a
historical violation from visuals-flow board tests that ran with the wrong
working directory (42 committed files, plus a phantom card type in the `/cards`
mount). It was deleted once those tests moved to their own workdir; don't
recreate it. `flow/.test-tmp/` stays gitignored as a guard against a repeat.
