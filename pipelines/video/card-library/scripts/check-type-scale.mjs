import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gate for the type-scale contract (DESIGN.md → "Typography"). A naive
// "largest declared font-size" check is wrong — cards carry hidden fallback
// glyphs at large sizes (enacted/fill-gauge's .tile .fallback at 68px), which a
// max() would mistake for the hero. So the card NAMES its hero via --hero-size
// and the gate measures everything else against it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));

const HERO_MIN = 120;        // px on a 1080-tall canvas = 11.1% of frame height
const HERO_RATIO = 2.5;      // hero must be >= 2.5x the next-largest text
const PROSE_MIN = 60;        // floor for a card whose hero is a whole sentence

// Hero SCALE is calibrated for a SHORT hero — a title, a section name, a number.
// Applied blind it breaks three card shapes, which is what the 2026-07-26 owner
// review caught (four cards, one bug). A card declares its shape in catalog.json
// via `hero_shape`; absent means "short" and nothing changes:
//
//   short  (default) — 120px floor + 2.5x ratio. Most of the library.
//   prose            — the hero is a whole sentence. 120px ran three lines
//                      edge-to-edge with no margin, and clipped descenders under
//                      an accent plate. Floor drops to 60px; the ratio is moot
//                      because the sentence is the only text on the card.
//   none             — the card has no hero at all: parallel lists (no item
//                      outranks another) and dense tables (the DATA is the point;
//                      promoting the heading inverts the hierarchy). Exempt from
//                      --hero-size, the floor, and the ratio.
//
// Contrast, accent and em-tracking are NOT shape-dependent and apply to every card.
const HERO_SHAPES = new Set(['short', 'prose', 'none']);

const errors = [];
let checked = 0;

for (const card of catalog.cards ?? []) {
  if (card.placement !== 'fullframe') continue;   // overlays are subordinate by design
  checked++;
  const file = path.join(ROOT, card.slug, 'index.html');
  if (!fs.existsSync(file)) { errors.push(`${card.slug}: index.html missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  // Strip CSS comments first. A card that documents WHY it has no hero writes
  // "--hero-size" in prose, and every check here would otherwise read that
  // comment as a live declaration.
  const css = (html.split('</style>')[0] || html).replace(/\/\*[\s\S]*?\*\//g, '');

  const shape = card.hero_shape ?? 'short';
  if (!HERO_SHAPES.has(shape)) {
    errors.push(`${card.slug}: hero_shape "${shape}" is not one of ${[...HERO_SHAPES].join(', ')}`);
    continue;
  }

  if (shape === 'none') {
    // No hero to measure. Guard the opt-out so it cannot be used to smuggle a
    // hero back in past the floor: a "none" card must not declare --hero-size.
    if (/--hero-size:/.test(css)) {
      errors.push(`${card.slug}: hero_shape is "none" but --hero-size is declared — pick one`);
    }
  } else {
    const heroDecl = css.match(/--hero-size:\s*(\d+)px/);
    if (!heroDecl) {
      errors.push(`${card.slug}: no --hero-size declared in :root (DESIGN.md → Typography)`);
      continue;
    }
    const hero = Number(heroDecl[1]);
    const floor = shape === 'prose' ? PROSE_MIN : HERO_MIN;
    if (hero < floor) {
      errors.push(`${card.slug}: --hero-size is ${hero}px, minimum for hero_shape "${shape}" is ${floor}px`);
    }
    if (!/font-size:\s*var\(--hero-size\)/.test(css)) {
      errors.push(`${card.slug}: --hero-size is declared but never used as a font-size`);
    }

    // The ratio is a SHORT-hero rule. On a prose card the sentence is the only
    // text there is, so "2.5x the next-largest" measures nothing.
    if (shape === 'short') {
      // every literal font-size that is NOT the hero
      const others = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
      const nextLargest = others.length ? Math.max(...others) : 0;
      if (nextLargest > 0 && hero / nextLargest < HERO_RATIO) {
        errors.push(
          `${card.slug}: hero ${hero}px vs next-largest ${nextLargest}px = ${(hero / nextLargest).toFixed(2)}x, needs >= ${HERO_RATIO}x — the card reads flat`,
        );
      }
    }
  }

  if (!/color:\s*var\(--accent\)/.test(css)) {
    errors.push(`${card.slug}: no text element uses color: var(--accent) — every fullframe card accents one word or label`);
  }

  // Tracking must be em-based on large type: a fixed -1.5px reads as tight at
  // 40px and as nothing at 160px, so a px value silently stops working the
  // moment the hero grows. This is the rule the pre-2026-07-25 library missed.
  if (!/letter-spacing:\s*-0?\.\d+em/.test(css)) {
    errors.push(`${card.slug}: no em-based negative letter-spacing found — hero type needs letter-spacing: -0.035em, not a px value`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\ncheck-type-scale: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`check-type-scale OK — ${checked} fullframe card(s)`);
