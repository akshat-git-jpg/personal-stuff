# Template catalog

The growing library of pin layouts. Each is niche-agnostic (brand/colors/fonts come from the
niche `config.json`). To add one, clone an inspiration into `<name>.html` and add a row here.

Common data fields (all templates): `title`, `handle`, `palette` ([c1,c2,c3]), `headlineFont`,
`bodyFont`. Most also take `subtitle` and/or `badge`.

| Template | Use for | Key data fields | Imagery |
|---|---|---|---|
| `listicle` | "N things" lists, tips roundups | `title`, `subtitle`/`badge`, `items[]` (5–8), `handle` | CSS gradient (default) or dark photo via `background` |
| `photo-bar` | one hero dish / "this recipe" | `title`, `subtitle` (kicker), `badge`, `handle` | real food photo — `background:{type:"stock"|"ai"|"image"}` |
| `free-guide` | lead magnet / "free plan/download" | `title`, `subtitle`, `badge`, `cta`, `handle` | CSS gradient (clean) |
| `recipe-card` | single shareable recipe w/ stats | `title`, `badge`, `cta`, `meta[]` (chips), `handle` | food photo via `background` or color block |
| `weekly-grid` | multi-cell plan/calendar (7-day meal plan) | `brandName`, `logo`, `taglineHtml`, `columns[4]`, `days[]` (each `{label, cells[4]:{name, img?}}`), `tips[]` ({icon,label}), `footerCta`, `footerNote`, `tipsCaption`, `cellSource` ("stock"\|"ai"), optional brand colors `teal`/`gold`/`coral`/`cream`, `imgStyle` | ONE image PER cell. render.mjs pre-fetches to `<postdir>/cells/` (batched, cached, embedded as data URIs). **`cellSource` defaults to "stock" when `PEXELS_API_KEY` is set (fast/reliable for many cells), else "ai"** (Pollinations — slow/flaky past ~10 cells). Stock falls back to AI per cell. Or set each `cell.img` to supply your own. |
| `elegant-checklist` | timeframe/grouped checklist on a LIGHT base (wedding/planner niches) | `eyebrow` (small-caps), `title`, `scriptWord` (italic accent), `groups[]` (each `{label, items[]}`, flows into 2 columns), `handle`, `cta`, `palette` [accent1, accent2, base], `headlineFont`, `bodyFont` | No images — pure type on a cream base. Big serif headline + one accent (palette[0]/[1]); base = palette[2] (cream). Built for the locked light/elegant theme (NOT dark). Grows taller as groups are added. |

## Aspect / size
All render at width **1000px**. Standard pins are 1500 tall (2:3). Infographic-style
(`weekly-grid`) is taller — Pinterest allows long pins. Output is rendered @2x for crispness.

## Backdrop sources (orthogonal to layout — any layout can use any source)
- `{"type":"css"}` — palette gradient. Free, on-brand.
- `{"type":"stock","query":"..."}` — Pexels (needs free `PEXELS_API_KEY`).
- `{"type":"ai","prompt":"..."}` — Pollinations, keyless. Slow at scale; avoid for many cells.
- `{"type":"image","url":"..."}` — a specific URL or local path you supply.
