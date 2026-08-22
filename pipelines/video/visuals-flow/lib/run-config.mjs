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

// The two intro flows. `simple` (plans 218-220) drives a locked kit of cards from a
// cut list; `complex` is the bespoke intro film (steps 110-160) that was the only
// flow between 2026-08-07 and 2026-08-22. Default is `simple` (owner, 2026-08-22):
// the fast path is the one you get without asking for it.
//
// This is NOT the legacy `intro: "cards" | "film"` key that plan 194 deleted. That
// vocabulary named a card flow that no longer exists, so a stale `intro` on an old
// video is still stripped below — honouring it would select a missing flow.
export const INTRO_MODES = ['simple', 'complex'];
export const DEFAULT_INTRO_MODE = 'simple';

const DEFAULTS = { introMode: DEFAULT_INTRO_MODE };

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  delete cfg.intro;
  delete cfg.review;
  delete cfg.engine;
  // An unrecognised introMode is a typo, not a third flow. Falling back silently
  // would run the default flow while run-config.json claims something else.
  if (!INTRO_MODES.includes(cfg.introMode)) {
    throw new Error(
      `run-config.json has introMode "${cfg.introMode}" — must be one of: ${INTRO_MODES.join(' | ')}`
    );
  }
  return cfg;
}


function main() {
  const [arg, ...rest] = process.argv.slice(2);
  if (!arg) {
    console.error('usage: node lib/run-config.mjs <slug> [--intro simple|complex] [--drive-folder <id>] [--drive-account <email>]');
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
    if (a === '--intro') {
      const v = rest.shift();
      if (!INTRO_MODES.includes(v)) {
        console.error(`--intro must be one of: ${INTRO_MODES.join(' | ')} (got "${v}")`);
        process.exit(1);
      }
      cfg.introMode = v;
    }
    else if (a === '--drive-folder') cfg.drive_folder = rest.shift();
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
