import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
// The owner's kickoff choices for one video (step 005): which HeyGen engine
// the avatar renders use, and how much they want to review along the way.
//
//   engine: "heygen3" (Avatar III, free unlimited — the default)
//         | "heygen4" (Avatar IV, METERED vs the monthly second-pool; setting
//           it here IS the owner's explicit authorization for this video)
//
// Express review and the intro-mode choice were removed 2026-08-07 (plan 194): every gate is real, and the intro is always the bespoke film.
//
// No run-config.json means the safe defaults: heygen3 + full review — an
// unconfigured video behaves exactly like every video before this existed.
const DEFAULTS = { engine: 'heygen3' };
const ENGINES = ['heygen3', 'heygen4'];

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  delete cfg.intro;
  delete cfg.review;
  if (!ENGINES.includes(cfg.engine)) throw new Error(`run-config.json: engine must be one of ${ENGINES.join('|')}, got "${cfg.engine}"`);
  return cfg;
}


function main() {
  const [arg, ...rest] = process.argv.slice(2);
  if (!arg) {
    console.error('usage: node lib/run-config.mjs <slug> [--engine heygen3|heygen4]');
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
    // Delivery (step 150): the video's own Drive folder (the one holding its
    // Input/Output subfolders) and which token account uploads there.
    else if (a === '--drive-folder') cfg.drive_folder = rest.shift();
    else if (a === '--drive-account') cfg.drive_account = rest.shift();
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  if (!ENGINES.includes(cfg.engine)) { console.error(`engine must be ${ENGINES.join('|')}`); process.exit(1); }
  cfg.decided_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`run-config: engine=${cfg.engine}`);
  if (cfg.engine === 'heygen4') console.error('note: heygen4 is METERED — this setting is the owner authorization for this video; check `heygen-web limits` covers the span total before submitting');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
