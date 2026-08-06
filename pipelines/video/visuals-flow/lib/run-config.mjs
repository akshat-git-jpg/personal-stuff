import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { INTRO_MODE_NAMES } from './intro-mode-table.mjs';

// The owner's kickoff choices for one video (step 005): which HeyGen engine
// the avatar renders use, and how much they want to review along the way.
//
//   engine: "heygen3" (Avatar III, free unlimited — the default)
//         | "heygen4" (Avatar IV, METERED vs the monthly second-pool; setting
//           it here IS the owner's explicit authorization for this video)
//   review: "full"    — every owner gate stops the flow (037 card plan,
//                       080 storyboard, 120 final cut). The default.
//         | "express" — the flow runs straight to the final cut; the 037 and
//                       080 board approvals are skipped. TWO things are NEVER
//                       skipped, whatever this says: the new-card look-preview
//                       (Gemini/Flow prompts → owner verdict BEFORE building
//                       any new card, DESIGN.md checklist item 0) and the 120
//                       final-cut review itself.
//
// No run-config.json means the safe defaults: heygen3 + full review — an
// unconfigured video behaves exactly like every video before this existed.
const DEFAULTS = { engine: 'heygen3', review: 'full', intro: 'cards' };
const ENGINES = ['heygen3', 'heygen4'];
const REVIEWS = ['full', 'express'];
// Derived from lib/intro-modes.mjs's declared table so the accepted enum can
// never disagree with what a consumer can actually ask for.
const INTROS = INTRO_MODE_NAMES;

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  if (!ENGINES.includes(cfg.engine)) throw new Error(`run-config.json: engine must be one of ${ENGINES.join('|')}, got "${cfg.engine}"`);
  if (!REVIEWS.includes(cfg.review)) throw new Error(`run-config.json: review must be one of ${REVIEWS.join('|')}, got "${cfg.review}"`);
  if (!INTROS.includes(cfg.intro)) throw new Error(`run-config.json: intro must be one of ${INTROS.join('|')}, got "${cfg.intro}"`);
  return cfg;
}

// A gate calls this instead of checking `approved` directly: full review
// keeps the refusal, express waives it loudly (the note lands in the step
// output so the run ledger can quote it). The 120 final-cut gate must NEVER
// route through this — it is not waivable by design.
export function gateWaived(workdir, gateName) {
  const cfg = loadRunConfig(workdir);
  if (cfg.review !== 'express') return false;
  console.error(`note: ${gateName} approval skipped — run-config review=express (owner kickoff choice)`);
  return true;
}

function main() {
  const [arg, ...rest] = process.argv.slice(2);
  if (!arg) {
    console.error('usage: node lib/run-config.mjs <slug> [--engine heygen3|heygen4] [--review full|express] [--intro cards|film]');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const p = path.join(workdir, 'run-config.json');

  if (rest.length === 0) {
    const cfg = loadRunConfig(workdir);
    console.log(JSON.stringify(cfg, null, 2));
    if (!cfg.configured) console.error('(defaults — no run-config.json written yet)');
    return;
  }

  const cfg = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { ...DEFAULTS };
  while (rest.length) {
    const a = rest.shift();
    if (a === '--engine') cfg.engine = rest.shift();
    else if (a === '--review') cfg.review = rest.shift();
    else if (a === '--intro') cfg.intro = rest.shift();
    // Delivery (step 150): the video's own Drive folder (the one holding its
    // Input/Output subfolders) and which token account uploads there.
    else if (a === '--drive-folder') cfg.drive_folder = rest.shift();
    else if (a === '--drive-account') cfg.drive_account = rest.shift();
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  if (!ENGINES.includes(cfg.engine)) { console.error(`engine must be ${ENGINES.join('|')}`); process.exit(1); }
  if (!REVIEWS.includes(cfg.review)) { console.error(`review must be ${REVIEWS.join('|')}`); process.exit(1); }
  if (!INTROS.includes(cfg.intro)) { console.error(`intro must be ${INTROS.join('|')}`); process.exit(1); }
  cfg.decided_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`run-config: engine=${cfg.engine} review=${cfg.review} intro=${cfg.intro}`);
  if (cfg.engine === 'heygen4') console.error('note: heygen4 is METERED — this setting is the owner authorization for this video; check `heygen-web limits` covers the span total before submitting');
  if (cfg.review === 'express') console.error('note: express skips the 037/080 board approvals. The new-card look-preview (prompts to the owner before building any card) and the 120 final-cut review are NEVER skipped.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
