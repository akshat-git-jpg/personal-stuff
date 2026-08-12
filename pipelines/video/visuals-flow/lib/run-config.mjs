import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';
// The owner's kickoff choices for one video (step 005).
//
// `engine` lived here until plan 197 (2026-08-07): it pre-authorised metered
// HeyGen spend at step 005, twenty steps before shots.json exists, against a
// number nobody had computed. That decision now belongs to the avatar spend
// gate (lib/avatar-plan.mjs, step 102), which asks against the REAL clip
// count and is a hard gate rather than a kickoff flag — see
// requireAvatarPlanApproved(). `engine` is stripped below even if an old
// run-config.json still has it, so nothing downstream can read it back out.
//
// Express review and the intro-mode choice were removed 2026-08-07 (plan 194): every gate is real, and the intro is always the bespoke film.
//
// No run-config.json means the safe defaults — an unconfigured video behaves
// exactly like every video before either of these existed.
const DEFAULTS = {};

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  delete cfg.intro;
  delete cfg.review;
  delete cfg.engine;
  return cfg;
}


function main() {
  const [arg, ...rest] = process.argv.slice(2);
  if (!arg) {
    console.error('usage: node lib/run-config.mjs <slug> [--drive-folder <id>] [--drive-account <email>]');
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
    // Delivery (step 150): the video's own Drive folder (the one holding its
    // Input/Output subfolders) and which token account uploads there.
    if (a === '--drive-folder') cfg.drive_folder = rest.shift();
    else if (a === '--drive-account') cfg.drive_account = rest.shift();
    else { console.error(`unknown argument: ${a}`); process.exit(1); }
  }
  cfg.decided_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  console.log('run-config: saved');
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
