// W18 zone-still — the only zone rule that has to look at PIXELS.
//
// The other three zone rules (W15/W16/W17, in lib/lint-cues.mjs) read
// resolved.json and cost nothing. This one measures the footage itself, because
// the defect it catches is invisible in the cue plan: test-03's intro had cards
// placed at a perfectly reasonable cadence AND 20 consecutive seconds where
// nothing on screen moved, because the screen recording underneath was parked
// on a static page and no card was covering that stretch.
//
// Method: ffmpeg's `freezedetect` over the zone span, minus the stretches where
// something is guaranteed to be moving anyway — a fullframe card is on screen,
// or an avatar-full clip has replaced the base. What is left is footage the
// viewer is actually watching, and a long still run there is the defect.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ZONE_CONSTANTS } from './zone-constants.mjs';

const ZONE_STILL_MAX = ZONE_CONSTANTS.ZONE_STILL_MAX.value;
const ZONE_STILL_DELTA = ZONE_CONSTANTS.ZONE_STILL_DELTA.value;

// Merge [start,end] intervals so covered-time maths never double-counts an
// overlap (a card sitting under an avatar span, say).
export function mergeIntervals(intervals) {
  const sorted = [...intervals].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([...iv]);
  }
  return out;
}

// Subtract `covered` from [start,end], returning the uncovered remainder.
export function subtractIntervals(start, end, covered) {
  const out = [];
  let cursor = start;
  for (const [cs, ce] of mergeIntervals(covered)) {
    if (ce <= start || cs >= end) continue;
    if (cs > cursor) out.push([cursor, Math.min(cs, end)]);
    cursor = Math.max(cursor, ce);
    if (cursor >= end) break;
  }
  if (cursor < end) out.push([cursor, end]);
  return out.filter(([s, e]) => e - s > 0.01);
}

// Parse ffmpeg freezedetect output into [start,end] pairs. freeze_start and
// freeze_end arrive on separate lines; an unterminated freeze runs to `until`.
export function parseFreezeLog(stderr, until) {
  const freezes = [];
  let open = null;
  for (const line of String(stderr).split('\n')) {
    const s = line.match(/freeze_start:\s*([0-9.]+)/);
    if (s) { open = parseFloat(s[1]); continue; }
    const e = line.match(/freeze_end:\s*([0-9.]+)/);
    if (e && open !== null) { freezes.push([open, parseFloat(e[1])]); open = null; }
  }
  if (open !== null) freezes.push([open, until]);
  return freezes;
}

// Runs left of the zone once card/avatar coverage is removed, longer than max.
export function stillRuns({ zoneStart, zoneEnd, freezes, covered, max = ZONE_STILL_MAX }) {
  const visible = subtractIntervals(zoneStart, zoneEnd, covered);
  const runs = [];
  for (const [fs_, fe] of mergeIntervals(freezes)) {
    for (const [vs, ve] of visible) {
      const s = Math.max(fs_, vs);
      const e = Math.min(fe, ve);
      if (e - s > max) runs.push([+s.toFixed(2), +e.toFixed(2)]);
    }
  }
  return runs;
}

export function probeFreezes(file, { start, duration, delta = ZONE_STILL_DELTA, max = ZONE_STILL_MAX, run = spawnSync } = {}) {
  const res = run('ffmpeg', [
    '-v', 'info',
    '-ss', String(start), '-t', String(duration),
    '-i', file,
    // `d` slightly under the cap so a run that only just exceeds it is still
    // reported rather than rounded away by the detector's own window.
    '-vf', `freezedetect=n=${delta}:d=${Math.max(1, max - 1)}`,
    '-map', '0:v:0', '-f', 'null', '-',
  ], { encoding: 'utf8' });
  // Times in the log are relative to the seek point.
  return parseFreezeLog(res.stderr ?? '', duration).map(([s, e]) => [s + start, e + start]);
}

// Returns { warnings, checked }. `checked` is false when there is nothing to
// measure (base:"none" has no footage at all), so callers can tell "clean" from
// "not applicable" instead of reporting a silent pass.
export function checkZoneStillness({ workdir, structure, resolved, avatarSpans = [], footage = null, probe = probeFreezes }) {
  const warnings = [];
  if (!footage || !fs.existsSync(footage)) return { warnings, checked: false };

  const zones = (structure ?? []).filter((p) => p.part !== 'body');
  if (!zones.length) return { warnings, checked: false };

  for (const zone of zones) {
    const covered = [
      ...resolved
        .filter((r) => r.placement === 'fullframe')
        .map((r) => [r.start, r.start + r.duration]),
      ...avatarSpans,
    ];
    const freezes = probe(footage, { start: zone.start, duration: zone.end - zone.start });
    for (const [s, e] of stillRuns({ zoneStart: zone.start, zoneEnd: zone.end, freezes, covered })) {
      warnings.push(
        `W18 zone-still: the ${zone.part} shows ${(e - s).toFixed(1)}s of static frame from ${s.toFixed(1)}s to ${e.toFixed(1)}s (max ${ZONE_STILL_MAX}s) — no card, no avatar, and the footage is not moving`,
      );
    }
  }
  return { warnings, checked: true };
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/stillness.mjs <slug-or-path>');
    process.exit(1);
  }
  // Imported lazily so the pure helpers above stay testable without a workdir.
  return import('./workdir.mjs').then(async ({ resolveWorkdir }) => {
    const { avatarFullSpans } = await import('./lint-cues.mjs');
    const workdir = resolveWorkdir(slug);
    const read = (f) => {
      const p = path.join(workdir, f);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    };
    const segments = read('segments.json');
    const resolvedFile = read('resolved.json');
    const screen = path.join(workdir, 'screen.mp4');
    const { warnings, checked } = checkZoneStillness({
      workdir,
      structure: segments?.structure ?? [],
      resolved: resolvedFile?.resolved ?? [],
      avatarSpans: avatarFullSpans(read('avatar-jobs.json')),
      footage: fs.existsSync(screen) ? screen : null,
    });
    if (!checked) {
      console.log('W18 zone-still: not applicable (no footage or no measured zones)');
      return;
    }
    for (const w of warnings) console.warn(w);
    console.log(warnings.length ? `${warnings.length} warning(s)` : 'W18 zone-still: clean');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
