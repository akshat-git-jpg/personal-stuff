import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gate for the side-ready contract (DESIGN.md → "Side-ready cards"). Only the
// MECHANICAL rules are checkable here: a hardcoded 1920px canvas makes side
// rendering impossible regardless of how the card looks. Rules 2 and 4 (type
// size, nothing clips) are visual and are verified by card-qa --side + a human
// or agent looking at the sheet. This gate exists because check-cards.sh is
// content-blind — see plans/runs/LESSONS.md 2026-07-24.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));

const errors = [];
let checked = 0;

for (const card of catalog.cards ?? []) {
  if (card.placement !== 'fullframe') continue;
  if (card.side !== true) continue;
  checked++;
  const file = path.join(ROOT, card.slug, 'index.html');
  if (!fs.existsSync(file)) { errors.push(`${card.slug}: side:true but ${file} is missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');

  if (/1920px/.test(html)) {
    errors.push(`${card.slug}: side:true but the file still contains "1920px" — root and content must size relatively (DESIGN.md rule 1)`);
  }
  if (!/data-width="1920"/.test(html)) {
    errors.push(`${card.slug}: #root must keep data-width="1920" — the renderer rewrites that attribute to 1200 for side cues`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\ncheck-side: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`check-side OK — ${checked} side-capable card(s)`);
