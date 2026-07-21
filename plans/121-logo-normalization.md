<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && node scripts/check-logos.mjs && node --test scripts/normalize-logo.test.mjs
ui: true
deploy:
needs: ["Independent of 115-120"]
---

# Plan 121: Logo normalization — every registry logo becomes a uniform app-icon tile

## Summary

- **Problem statement**: `scripts/fetch-logo.mjs` downloads a Google favicon and writes it to disk untouched. Registry logos therefore range from 32×32 to 256×256, some carry alpha and some a baked-in background, and each vendor chose its own internal padding. Any card showing two logos side by side renders them at visibly different weight — measured, OpusClip's mark fills 70% of its canvas while Submagic's fills 93%×86%.
- **Goals**:
  - Normalize every logo to a 256×256 opaque tile with the mark at a fixed 72% safe area.
  - Backfill the 12 existing registry logos and make normalization automatic on fetch.
  - Add a gate so an un-normalized logo can never enter the registry.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — the bbox+ffmpeg algorithm is inlined and already proven on real files; visual output passes the render+inspect gate.
- **Done criteria** (terse — full list below): all 12 logos are 256×256 with mark ratio 0.72±0.04; `check-logos.mjs` green; a fresh fetch produces a normalized file.
- **Stop conditions** (terse — full list below): a logo whose mark cannot be detected; the `make` manual logo being overwritten.
- **Test / verification for success**: unit tests on bbox detection plus a rendered side-by-side contact sheet of all 12 normalized logos, inspected by eye.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/card-library/logos pipelines/video/card-library/scripts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

Owner review of `opusclip-tutorial` on 2026-07-21: *"it looks like opus logo is smaller than submagic. this is an issue everywhere."* It is not perception. Measured with a raw-pixel bbox scan:

```
opusclip.png    128x128  bg=rgb(14,16,21)   mark=90x90    => 70% x 70% of canvas
submagic.png    128x128  bg=rgb(255,56,0)   mark=119x110  => 93% x 86% of canvas
heygen.png       48x48   bg=rgb(0,0,0)      mark=48x48    => 100% x 100% of canvas
n8n.png          48x48   bg=rgb(0,0,0)      mark=44x24    => 92% x 50% of canvas
```

Rendered into identical boxes, Submagic's mark is ~30% larger than OpusClip's. Two further inconsistencies compound it: source canvases range 32→256px, and five logos (`opusclip`, `submagic`, `zapier`, `arcads`, `flowise`) have **no alpha**, so they carry an opaque vendor background — one a near-black tile, another a bright red block — giving them different visual weight on a dark card for a second, independent reason.

The cause is that `fetch-logo.mjs` does no processing at all. Its entire write path:

```js
const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const fileStream = fs.createWriteStream(filePath, { flags: 'w' });
await finished(Readable.fromWeb(res.body).pipe(fileStream));
registry[slug] = { domain, file: fileName, source: 'favicon' };
```

`sz=128` is a request, not a guarantee — Google returns the nearest size the site actually publishes, which is why the registry holds 32, 48, 128 and 256px files.

**Owner decision (2026-07-21): uniform app-icon tile.** Keep each brand's background colour, force every logo into an identical tile with the mark at a fixed ratio. Brand colour is preserved; size and shape become consistent.

## Current state

- `logos/registry.json` — `{ slug: { domain, file, source } }`. `source` is `favicon` or `manual`; `make` is `manual` and the fetcher already refuses to overwrite it.
- `logos/*.png` — 12 files, dimensions above. `logos/make.svg` exists but no registry entry references it.
- `visuals-flow/lib/logos-inline.mjs` reads `registry[slug].file`, base64-inlines it as a data URI under `variables.__logos`, and picks the MIME from the file extension. **This plan does not change that contract** — normalization happens on disk, so inlining is unaffected.
- No image library is installed and ImageMagick is not available. `ffmpeg` is available and is used throughout this repo.

### The proven measurement technique

Background detection and bbox scanning were validated on the real files using ffmpeg to dump raw pixels plus a JS scan. Reuse exactly this approach — do not add an npm image dependency.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Logo gate | `cd pipelines/video/card-library && node scripts/check-logos.mjs` | `logos ok` |
| Unit tests | `cd pipelines/video/card-library && node --test scripts/normalize-logo.test.mjs` | exit 0 |
| Normalize one | `cd pipelines/video/card-library && node scripts/normalize-logo.mjs opusclip` | writes 256×256 |
| Backfill all | `cd pipelines/video/card-library && node scripts/normalize-all-logos.mjs` | 12 normalized |
| Check a file | `sips -g pixelWidth -g pixelHeight logos/opusclip.png` | 256 × 256 |
| Card structure gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/card-library/scripts/normalize-logo.mjs` (new)
- `pipelines/video/card-library/scripts/normalize-logo.test.mjs` (new)
- `pipelines/video/card-library/scripts/normalize-all-logos.mjs` (new)
- `pipelines/video/card-library/scripts/check-logos.mjs` (new)
- `pipelines/video/card-library/scripts/fetch-logo.mjs` (call the normalizer)
- `pipelines/video/card-library/logos/*.png` + `registry.json`
- `pipelines/video/card-library/DESIGN.md` (logo tile rule)
- `pipelines/video/card-library/package.json` (script entries)

**Out of scope**:
- `visuals-flow/lib/logos-inline.mjs` — the data-URI contract is unchanged. Editing it means the approach diverged.
- Any card's logo CSS. Cards get consistent inputs here; card-side sizing is plan 122.
- `logos/make.svg` — unreferenced. Leave it.
- Fetching any new logo.

## Git workflow

- Branch: `advisor/121-logo-normalization`
- Commit per step. Message style: `fix(card-library): normalize logos to a uniform tile`. No AI footers. Do NOT push.

## Steps

### Step 1: Write the normalizer

Create `scripts/normalize-logo.mjs`. Constants:

```js
const CANVAS = 256;        // output tile is always 256x256
const MARK_RATIO = 0.72;   // the mark occupies 72% of the tile's longest side
const MARK_MAX = Math.round(CANVAS * MARK_RATIO); // 184
const DARK_LUMA = 0.25;    // below this the tile needs a hairline border on dark cards
```

Core detection — this is the proven algorithm, write it as given:

```js
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// Dump raw RGBA and find the bounding box of the actual mark. Two cases:
//  - source has alpha  -> the mark is any pixel with alpha > 16
//  - source is opaque  -> the mark is any pixel differing from the corner
//    colour (favicons with a baked background are uniform at the corners)
export function markBBox(pngPath, tmpRaw) {
  execFileSync('ffmpeg', ['-v', 'error', '-i', pngPath, '-f', 'rawvideo', '-pix_fmt', 'rgba', tmpRaw, '-y']);
  const b = fs.readFileSync(tmpRaw);
  const n = Math.round(Math.sqrt(b.length / 4));
  const W = n, H = n;                     // favicons are square; assert below
  if (W * H * 4 !== b.length) throw new Error(`${pngPath}: not square (${b.length} bytes)`);
  const at = (x, y) => b.subarray((y * W + x) * 4, (y * W + x) * 4 + 4);
  const corner = at(0, 0);
  const hasAlpha = (() => { for (let i = 3; i < b.length; i += 4) if (b[i] < 250) return true; return false; })();
  const isMark = (p) => hasAlpha
    ? p[3] > 16
    : (Math.abs(p[0] - corner[0]) + Math.abs(p[1] - corner[1]) + Math.abs(p[2] - corner[2])) > 40;

  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isMark(at(x, y))) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error(`${pngPath}: no mark detected`);
  return { W, H, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, hasAlpha, bg: [corner[0], corner[1], corner[2]] };
}
```

Then rebuild the tile with ffmpeg. For an opaque source keep the vendor background; for an alpha source use the shared neutral surface `#12151C`, so alpha logos are consistent with each other:

```js
const NEUTRAL = [0x12, 0x15, 0x1c];
const bg = box.hasAlpha ? NEUTRAL : box.bg;
const hex = '0x' + bg.map(v => v.toString(16).padStart(2, '0')).join('');
execFileSync('ffmpeg', ['-v', 'error', '-i', src,
  '-vf', `crop=${box.w}:${box.h}:${box.x}:${box.y},` +
         `scale=w=${MARK_MAX}:h=${MARK_MAX}:force_original_aspect_ratio=decrease,` +
         `pad=${CANVAS}:${CANVAS}:(ow-iw)/2:(oh-ih)/2:color=${hex}`,
  '-frames:v', '1', out, '-y']);
```

Luminance for the `dark` flag: `L = (0.2126*r + 0.7152*g + 0.0722*b) / 255`.

Registry entry gains four fields, preserving `domain`/`file`/`source`:

```json
"opusclip": {
  "domain": "opus.pro", "file": "opusclip.png", "source": "favicon",
  "normalized": true, "bg": "#0e1015", "dark": true, "mark_ratio": 0.72
}
```

**Verify**: `cd pipelines/video/card-library && node scripts/normalize-logo.mjs opusclip && sips -g pixelWidth -g pixelHeight logos/opusclip.png | tail -2` -> `256` and `256`

### Step 2: Backfill all 12

`scripts/normalize-all-logos.mjs` iterates the registry, normalizes every entry with a `file`, and prints a before/after table. It must be **idempotent** — re-running on an already-normalized file must produce the same output, because the mark bbox of a normalized tile re-detects to the same 72%.

`make` is `source: manual`. Normalize its geometry like the rest — the fetcher's manual guard protects it from being *re-downloaded*, not from being tidied. Do not delete or replace its artwork.

**Verify**: `cd pipelines/video/card-library && node scripts/normalize-all-logos.mjs && node scripts/normalize-all-logos.mjs && node scripts/check-logos.mjs` -> `logos ok` after a double run (idempotence)

### Step 3: Look at them

Build a contact sheet of all 12 normalized tiles at equal size on a dark background:

```
cd pipelines/video/card-library/logos
ffmpeg -v error -pattern_type glob -i '*.png' -filter_complex "scale=128:128,tile=6x2:padding=12:color=0x101014" -frames:v 1 /tmp/logos.png -y
```

Open `/tmp/logos.png` and check:
- [ ] Every mark occupies visibly the same fraction of its tile.
- [ ] No mark is clipped at any edge.
- [ ] Dark-tiled logos (`opusclip`) are still distinguishable against the dark sheet.

This is the render+inspect gate (`plans/runs/LESSONS.md` 2026-07-19) — "the script ran" is not evidence. Attach `/tmp/logos.png` to the PR (`ui: true`).

**Verify**: `/tmp/logos.png` satisfies all three checks.

### Step 4: Normalize on fetch

In `scripts/fetch-logo.mjs`, after the download stream finishes and before the registry write, call the normalizer on the downloaded file and merge its metadata into the registry entry. A normalization failure must **fail the fetch loudly** (non-zero exit, keep the raw file for inspection) rather than silently registering an un-normalized logo.

**Verify**: `cd pipelines/video/card-library && node scripts/fetch-logo.mjs vercel vercel.com && sips -g pixelWidth logos/vercel.png | tail -1 && node scripts/check-logos.mjs` -> `256`, `logos ok`. Then remove the test logo and its registry entry before committing.

### Step 5: The gate

`scripts/check-logos.mjs` fails (exit 1) when any registry entry with a `file`:
- is missing `normalized: true`,
- is not exactly 256×256,
- has a detected mark ratio outside `0.72 ± 0.04`,
- references a file that does not exist.

Add `"check-logos": "node scripts/check-logos.mjs"` to `package.json`, and call it from `scripts/check-cards.sh` so the existing card gate covers logos too.

**Verify**: `cd pipelines/video/card-library && node scripts/check-logos.mjs && bash scripts/check-cards.sh` -> `logos ok`, exit 0

### Step 6: Tests and docs

`scripts/normalize-logo.test.mjs`:
1. Synthesize a 64×64 PNG (via ffmpeg `color` source + `drawbox`) with a known off-centre mark; assert `markBBox` returns that box.
2. An alpha PNG: assert alpha-based detection wins over corner detection.
3. Idempotence: normalize twice, assert byte-identical output.
4. A fully uniform image throws `no mark detected` rather than returning a zero box.

`DESIGN.md` — add a "Logo tiles" rule: logos arrive as 256×256 opaque tiles with the mark at 72%; cards must render them square with a consistent border-radius and must **not** apply their own trimming, rescaling to a different safe area, or `saturate()`/`brightness()` filters that alter apparent weight. When `registry[slug].dark` is true, cards add a 1px `rgba(255,255,255,0.10)` inset border so the tile separates from a dark background.

**Verify**: `cd pipelines/video/card-library && node --test scripts/normalize-logo.test.mjs` -> exit 0

## Test plan

Unit tests over synthesized fixtures (no network, no committed binary fixtures). The 12-logo contact sheet in Step 3 is the visual acceptance evidence and is attached to the PR.

## Done criteria

- [ ] `cd pipelines/video/card-library && node scripts/check-logos.mjs` prints `logos ok`
- [ ] `node --test scripts/normalize-logo.test.mjs` exits 0
- [ ] All 12 registry logos are 256×256 with `normalized: true`, `bg`, `dark`, `mark_ratio`
- [ ] Running `normalize-all-logos.mjs` twice produces no diff on the second run
- [ ] `bash scripts/check-cards.sh` exits 0 and now includes the logo gate
- [ ] Contact sheet attached to the PR showing consistent mark sizes
- [ ] `scripts/fetch-logo.mjs` normalizes automatically; the test logo is removed before commit
- [ ] `git diff --stat 18488a2..HEAD` touches only the in-scope list

## STOP conditions

- **A logo's mark cannot be detected** (uniform image, or a gradient background defeating corner detection). Stop and report which slug; do not lower the threshold until it passes, because that silently crops real artwork.
- **A normalized logo looks worse than the original** in the Step 3 sheet — e.g. a wordmark like `n8n` (92%×50%) becoming illegible when scaled to a 184px square safe area. Stop and report; wide wordmarks may need a `fit: "width"` registry override rather than a forced square.
- **`make`'s artwork changes.** Its geometry may be normalized; its pixels must not be re-downloaded.
- **You are tempted to add `sharp` or another image dependency.** ffmpeg plus the inlined scan is the approach; an npm image library is a different plan.

## Maintenance notes

- `MARK_RATIO = 0.72` is the single knob controlling apparent logo size across every card. Changing it requires re-running the backfill and re-inspecting the contact sheet.
- Normalization is destructive — it overwrites the fetched file. If provenance ever matters, keep the raw download alongside as `<slug>.raw.png`; today it is not kept, deliberately, to avoid doubling the committed binaries.
- The `dark` flag exists so cards can compensate; it is only useful if cards honour the DESIGN.md border rule. Plan 122 applies it in the cards that show logos.
- Wide wordmarks are the known weak spot of a square safe area. If a second one appears after `n8n`, add the `fit` override rather than special-casing.
