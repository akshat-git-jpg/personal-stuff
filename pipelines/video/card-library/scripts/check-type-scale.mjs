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

const errors = [];
let checked = 0;

for (const card of catalog.cards ?? []) {
  if (card.placement !== 'fullframe') continue;   // overlays are subordinate by design
  checked++;
  const file = path.join(ROOT, card.slug, 'index.html');
  if (!fs.existsSync(file)) { errors.push(`${card.slug}: index.html missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const css = html.split('</style>')[0] || html;

  const heroDecl = css.match(/--hero-size:\s*(\d+)px/);
  if (!heroDecl) {
    errors.push(`${card.slug}: no --hero-size declared in :root (DESIGN.md → Typography)`);
    continue;
  }
  const hero = Number(heroDecl[1]);
  if (hero < HERO_MIN) {
    errors.push(`${card.slug}: --hero-size is ${hero}px, minimum is ${HERO_MIN}px`);
  }
  if (!/font-size:\s*var\(--hero-size\)/.test(css)) {
    errors.push(`${card.slug}: --hero-size is declared but never used as a font-size`);
  }

  // every literal font-size that is NOT the hero
  const others = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
  const nextLargest = others.length ? Math.max(...others) : 0;
  if (nextLargest > 0 && hero / nextLargest < HERO_RATIO) {
    errors.push(
      `${card.slug}: hero ${hero}px vs next-largest ${nextLargest}px = ${(hero / nextLargest).toFixed(2)}x, needs >= ${HERO_RATIO}x — the card reads flat`,
    );
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
