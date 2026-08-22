# intro-kit — the locked intro card set

Seven Hyperframes card templates for a video's intro: `statement`, `checklist`,
`logo-grid`, `shot-float`, `ui-mock`, `chain`, `lower-third`. The full contract
(palette, type scale, the 5 approved motion moves, the variable-duration rule)
lives in [`KIT.md`](KIT.md) — read that before touching a card.

This is a sibling of [`../card-library/`](../card-library/README.md), not a
replacement: card-library is the body card set (fixed 6s cards); this kit is
the intro-only set (variable 2.0-5.0s cards). Both share the same brand
contract, [`../card-library/DESIGN.md`](../card-library/DESIGN.md), and the
same real logo registry via the `logos` symlink.

## Render one card

```bash
npx hyperframes@latest render cards/statement -o out.mp4 --fps 30
```

Pass a duration or content override at render time — no code editing needed:

```bash
npx hyperframes@latest render cards/statement -o out.mp4 --fps 30 \
  --variables '{"duration":2.0,"text":"...","beats":[...]}'
```

`ui-mock` also takes `"state":"ok"` or `"state":"fail"` to switch its whole
palette between the accent and `#ef4444` — same file, one variable.

## The content gate

```bash
bash scripts/check.sh
```

Renders every card headless, seeks its own registered GSAP timeline, and
asserts on the RENDERED PIXELS and the RUNTIME DOM — never on source text. A
card that renders its heading and an empty stage fails here. See
`lib/check-kit.mjs` for the full check list (`E-KIT-*` codes).

## Where things live

- `cards/<slug>/index.html` — the 7 locked cards.
- `logos -> ../card-library/logos` — the real logo registry (symlink; never
  redraw a logo here). Cards that use logos each carry their own
  `cards/<slug>/logos` symlink pointing back up to this one — see CLAUDE.md
  for why.
- `shots/` — generic placeholder screenshots (dashboard/code/chat/social
  mockups) used as the DEFAULT `shot(s)` variable so a bare
  `npx hyperframes@latest render cards/shot-float` still shows real bitmap
  evidence. A real video supplies its own screenshots via `--variables`.
- `frames/<slug>.jpg` — a committed contact sheet per card (the visual
  evidence a session must look at before trusting a card).
- `KIT.md` — the locked contract. `kit.json` — the same contract, machine
  readable.

This kit is inert on its own — plan 220 builds the cut-list builder that
turns a sequence of these cards into one intro composition. Rendering a card
here in isolation is how you verify the TEMPLATE, not how a video gets built.
