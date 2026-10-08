# design-systems — swappable looks for free-design recipes

A design system is the visual language a free-design recipe (today: `animate-flow`)
writes motion graphics in. The recipe's author step reads ONE design system, the
recipe's own taste file and the moment it is drawing. Nothing else.

Swapping the look of a video means pointing its `run-config.json` `designSystem` at a
different folder here. No code changes.

## What a design system is

One folder per system, named in kebab case:

```
design-systems/<name>/
  DESIGN.md        required: the system, written for an author who has never seen the channel
  tokens.json      optional: the same values as data (colours, fonts, canvas background)
  examples/        optional: a few reference frames (png/jpg) showing the look done right
```

`DESIGN.md` covers, in this order:

| Section | Says |
|---|---|
| Palette | every colour with its exact value and its job; what is banned |
| Type | font families, weights, the size scale at 1080p, tracking and leading |
| Motion language | how things enter, hold and leave; eases and durations; what never moves |
| Layout | safe area, grid, density, how much is on screen at once |
| Marks | logos, icons, images: where they come from and how they sit |
| Do / Don't | short lists, each item one line |

`tokens.json` keys the recipe reads (all optional):

| Key | Used for |
|---|---|
| `background` | the plain bed colour when a video has no screen recording |
| `colors` | named colours, mirrored from the Palette section |
| `fonts` | font family stacks |

## Rules for writing one

- Describe a **language**, not templates. No fixed layouts to fill in, no slot names,
  no "card types". The author designs each moment from scratch inside the language.
- Facts only from the brand: colours, fonts, logo rules. Taste learned from the owner's
  reviews of a recipe lives in that recipe's taste file, not here, unless the lesson is
  about the look itself (a colour, a font, a motion rule), in which case it belongs here.
- Keep it short enough to read in one pass. If a rule needs a paragraph of history, the
  history goes in the recipe's taste file with its `From:` line.

## Systems

| Folder | What it is |
|---|---|
| `default/` | The channel brand as a free-design system: warm dark ground, one orange accent, Inter. Derived 2026-10-08 from the channel brand tokens (`pipelines/video/visuals-flow/brand.json`) and the logo registry (`pipelines/video/card-library/logos/`). |

| `robonuggets-flat/` | A flat paper-and-cobalt look built from a reference video with `tools/`. |
| `tools/` | Not a system: `from-reference.mjs` builds a new system folder from a reference video. |

Other systems may sit beside these. Each owns its own folder; editing one never touches another.
