import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// HeyGen credit guard: snapshot the account meters before a batch, re-read them
// once every clip has downloaded, and fail loudly if a free batch cost anything.
// The after-read must wait for downloads: Avatar IV bills at render COMPLETION,
// so a submit-time check always reads "free".

export const METER_FILE = 'heygen-meter.json';

export function readUsage(bin, pre, { run = spawnSync, cwd } = {}) {
  const res = run(bin, [...pre, 'usage'], { encoding: 'utf8', cwd });
  if (res.status !== 0) throw new Error(`heygen-web usage failed: ${(res.stderr || res.stdout || '').trim().slice(-300)}`);
  const snap = JSON.parse(res.stdout);
  if (snap.seconds_consumed === undefined && snap.credits === undefined) throw new Error('heygen-web usage returned no meters');
  return snap;
}

// Same meters heygen-web's own diffUsage treats as spend.
export function meterDelta(before, after) {
  const k = (key) => (after[key] ?? 0) - (before[key] ?? 0);
  const delta = {
    credits: k('credits'),
    seconds_consumed: k('seconds_consumed'),
    ai_image_credits: k('ai_image_credits'),
    ai_video_credits: k('ai_video_credits'),
    ai_concept_credits: k('ai_concept_credits'),
    plan_remain: k('plan_remain'),
    addon_remain: k('addon_remain'),
  };
  const spent = delta.credits !== 0 || delta.seconds_consumed !== 0 || delta.plan_remain !== 0 || delta.addon_remain !== 0
    || delta.ai_image_credits < 0 || delta.ai_video_credits < 0 || delta.ai_concept_credits < 0;
  return { spent, delta };
}

export function loadMeter(workdir) {
  const p = path.join(workdir, METER_FILE);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

export function saveMeter(workdir, m) {
  fs.writeFileSync(path.join(workdir, METER_FILE), JSON.stringify(m, null, 2) + '\n');
}

// Verdict once the batch is complete. `metered` batches (heygen4) are expected to spend.
export function meterVerdict(meter, after) {
  const { spent, delta } = meterDelta(meter.before, after);
  if (meter.metered) return { status: 'metered', spent, delta };
  return { status: spent ? 'SPENT' : 'verified-free', spent, delta };
}
