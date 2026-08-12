import fs from 'node:fs';
import path from 'node:path';
import { loadSteps } from './steps.mjs';
import { pathToFileURL } from 'node:url';

// Renaming a step folder orphans every ledger entry filed under the old name:
// lib/run-log.mjs derives its valid keys from step slugs. Three videos carry 39
// entries between them and one of them is live, so this map is a checked
// artifact rather than a sed script (plan 199).
//
// Left = the slug as it existed after plans 194-198. Right = its 0xx-6xx home.
//
// '027-approve-intro-film-human' is deliberately NOT a key here: plan 199
// split it into three folders (140/150/160 below) in one motion rather than
// through a temporary '027a/027b/027c' name, because those temp names cannot
// pass validateStep (folder must start with "<3-digit number>-", and no
// 3-digit number makes "027a-..." satisfy that). No real ledger ever recorded
// a '027...' key, so there is nothing to migrate for it.
//
// '037-approve-card-plan-human' IS a key here, though the plan that authored
// this map filed it under RETIRED_SLUGS as "gate removed (plan 195)". Plan 195
// removed the APPROVAL GATE (its step.json now carries `gate: null`), not the
// step: the folder still exists, still declares the `card-plan` verb, and
// still produces card-plan.json for 038/240 to consume — and both real
// finished-video ledgers carry a live '037-approve-card-plan-human' entry.
// Treating it as retired would be wrong: RETIRED_SLUGS is for a step whose
// FOLDER is gone (like 050, folded into 070/330 by plan 196). 037 gets a real
// destination instead, slotted at 235 — between cue review (230) and card
// build (240), exactly where it sits in the current pipeline order.
export const SLUG_MIGRATION = {
  // 0xx intake
  '005-configure-run-human':              '010-configure-run-human',
  '010-transcribe-run':                   '020-transcribe-run',
  '012-clean-transcript-llm':             '030-clean-transcript-llm',
  '015-map-segments-run':                 '040-split-narration-demo-run',
  '020-choose-concept-llm':               '050-choose-concept-llm',
  // 1xx intro film
  '026-propose-intro-idea-llm':           '110-propose-intro-idea-llm',
  '028-approve-intro-idea-human':         '120-approve-intro-idea-human',
  '025-author-intro-film-llm':            '130-author-intro-screenplay-llm',
  // 2xx card plan
  '030-pick-or-propose-graphics-llm':     '210-author-body-cues-llm',
  '035-pick-or-propose-intro-outro-llm':  '220-author-conclusion-cues-llm',
  '036-review-cue-plan-run':              '230-review-cue-plan-run',
  '037-approve-card-plan-human':          '235-build-card-plan-run',
  '038-build-cards-llm-and-review-human': '240-build-cards-llm',
  // 3xx storyboard
  '040-sync-graphics-run':                '310-sync-graphics-run',
  '060-place-avatar-llm':                 '320-place-avatar-llm',
  '070-review-storyboard-run':            '330-review-storyboard-run',
  '080-approve-storyboard-human':         '340-approve-storyboard-human',
  // 4xx render
  '090-render-graphics-run':              '410-render-graphics-run',
  '102-propose-avatar-human':             '420-propose-avatar-human',
  '100-render-avatar-run':                '430-render-avatar-run',
  '108-rerender-intro-film-run':          '440-rerender-intro-film-run',
  '105-plan-sound-run':                   '450-plan-sound-run',
  '107-mix-audio-run':                    '460-mix-audio-run',
  // 5xx cut
  '110-build-video-run':                  '510-assemble-video-run',
  '115-review-cut-run':                   '520-review-cut-run',
  '120-approve-final-cut-human':          '530-approve-final-cut-human',
  // 6xx deliver and learn
  '140-davinci-export-run':               '610-davinci-export-run',
  '150-deliver-drive-run':                '620-deliver-drive-run',
  '130-learn-from-feedback-opus':         '630-learn-from-feedback-opus',
};

// Steps deleted earlier in the batch. A ledger entry under one of these is
// HISTORY, not an orphan — it records work that really happened on a step that
// no longer exists. Keep the entry, prefix it so it can never be mistaken for a
// live step, and say why.
export const RETIRED_SLUGS = {
  '050-review-graphics-llm':        'retired/050-review-graphics-llm',        // folded into 330 (plan 196)
};

export function migrateLedger(ledger, { steps = null } = {}) {
  // A key passes through untouched when it already names a LIVE step folder.
  //
  // This used to test only the map's own right-hand destinations, which made a
  // silent orphan of every folder plan 199 created fresh rather than renamed —
  // 140-review-intro-frames-run, 150-approve-intro-film-human and
  // 160-render-intro-film-run, the intro-film trio, are in no rename pair and so
  // matched nothing. Nothing tripped while no ledger had reached those steps;
  // the first real run to record one (consistent-ai-influencer's 150 approval,
  // 2026-08-07) turned the gate red on a ledger that was entirely correct.
  // The map exists to RENAME old slugs. A key already naming a step needs no
  // rename, whether or not it was ever the right-hand side of one.
  const live = new Set((steps ?? loadSteps()).map((s) => s.slug));
  const out = { ...ledger, steps: {} };
  const unmapped = [];
  for (const [key, value] of Object.entries(ledger.steps ?? {})) {
    if (live.has(key) || key.startsWith('retired/')) {
      out.steps[key] = value;
      continue;
    }
    const next = SLUG_MIGRATION[key] ?? RETIRED_SLUGS[key];
    if (!next) { unmapped.push(key); continue; }
    out.steps[next] = value;
  }
  return { ledger: out, unmapped };
}

// Every RIGHT-hand slug must be a real step folder, and nothing may be dropped.
export function checkMigration({ steps = null, ledgers = [] } = {}) {
  const errors = [];
  const live = steps ?? loadSteps();
  const known = new Set(live.map((s) => s.slug));
  for (const [from, to] of Object.entries(SLUG_MIGRATION)) {
    if (!known.has(to)) {
      errors.push(`LEDGER-KEY-ORPHANED: ${from} maps to ${to}, which is not a step folder`);
    }
  }
  for (const { video, ledger } of ledgers) {
    const { ledger: next, unmapped } = migrateLedger(ledger, { steps: live });
    for (const key of unmapped) {
      errors.push(`LEDGER-KEY-ORPHANED: ${video}'s ledger has "${key}", which the migration map does not cover — that video's history would stop resolving to a step`);
    }
    const before = Object.keys(ledger.steps ?? {}).length;
    const after = Object.keys(next.steps).length;
    if (before !== after) {
      errors.push(`LEDGER-KEY-ORPHANED: ${video} had ${before} entries and would have ${after} — the migration must never lose one`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function loadRealLedgers() {
  const dir = path.resolve(import.meta.dirname, '..', 'videos');
  return fs.readdirSync(dir)
    .map((video) => ({ video, p: path.join(dir, video, 'run-log.json') }))
    .filter(({ p }) => fs.existsSync(p))
    .map(({ video, p }) => ({ video, p, ledger: JSON.parse(fs.readFileSync(p, 'utf8')) }));
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode !== '--dry-run' && mode !== '--apply') {
    console.error(
      'Usage:\n' +
        '  node lib/ledger-migration.mjs --dry-run   report only, writes nothing\n' +
        '  node lib/ledger-migration.mjs --apply     rewrite the three ledgers (backs up first)',
    );
    process.exit(1);
  }

  const entries = loadRealLedgers();
  const check = checkMigration({ ledgers: entries.map(({ video, ledger }) => ({ video, ledger })) });
  if (!check.ok) {
    console.error(check.errors.join('\n'));
    process.exit(1);
  }

  for (const { video, p, ledger } of entries) {
    const { ledger: next } = migrateLedger(ledger);
    const before = Object.keys(ledger.steps ?? {}).length;
    const after = Object.keys(next.steps).length;
    console.log(`${video}: ${before} -> ${after} entries`);
    if (mode === '--apply') {
      fs.copyFileSync(p, `${p}.bak`);
      fs.writeFileSync(p, JSON.stringify(next, null, 2) + '\n');
    }
  }
  if (mode === '--apply') console.log('applied — .bak files written alongside each run-log.json');
}
