import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { planSegments } from './assemble.mjs';
import { SHOT_CONSTANTS as SC } from './shot-constants.mjs';

// Budget + shape rules for full-screen avatar spans. Seeded from
// tutorial-pipeline-2's 060 rulebook knobs (U-curve, ~5:00 total cap from the
// HeyGen 4 limit); the cap is enforced in BOTH engine modes so a test-mode
// plan is production-shaped by construction. 2026-07-20 Youri recalibration:
// rhythm adopted, totals kept for cost. Values live in lib/shot-constants.mjs;
// the prompt is generated from them.
const AVATAR_FULL_CAP = SC.AVATAR_FULL_CAP.value;
const AVATAR_FULL_TARGET = SC.AVATAR_FULL_TARGET.value;
const SPAN_MIN = SC.SPAN_MIN.value;
const SPAN_MAX_MID = SC.SPAN_MAX_MID.value;
const SPAN_MAX_ZONE = SC.SPAN_MAX_ZONE.value;
const FRONT_ZONE = SC.FRONT_ZONE.value;
const BACK_ZONE = SC.BACK_ZONE.value;
const GAP_AVATAR_MAX = SC.GAP_AVATAR_MAX.value;

const MIN_SCREEN_ERROR = 2.5;
const MIN_SCREEN_WARN = 5;

                                    //     presence mid-video, not just the U-curve ends)

export function lintShots({ shotsResolved, resolvedCues, words }) {
  const errors = [];
  const warnings = [];
  if (!words || words.length === 0) return { errors, warnings };
  const T = words[words.length - 1].end;
  const spans = [...(shotsResolved.spans ?? [])].sort((a, b) => a.start - b.start);

  // E5 orphan-screen / W5 short-screen
  try {
    const avatarJobs = spans.map(s => ({ kind: 'avatar-full', id: s.id, start: s.start, end: s.end }));
    const baseSegments = planSegments({ resolved: resolvedCues || [], avatarJobs, total: T });
    for (let i = 0; i < baseSegments.length; i++) {
      const seg = baseSegments[i];
      if (seg.kind !== 'screen') continue;
      const dur = seg.end - seg.start;
      const prev = i > 0 ? baseSegments[i-1] : null;
      const next = i < baseSegments.length - 1 ? baseSegments[i+1] : null;
      
      if (dur < MIN_SCREEN_ERROR && prev && prev.kind === 'avatar' && next && next.kind === 'avatar') {
        errors.push(`E5 orphan-screen: ${dur.toFixed(1)}s of screen between ${prev.id} and ${next.id} — extend a span or drop it on the board`);
      } else if (dur < MIN_SCREEN_WARN) {
        warnings.push(`W5 short-screen: ${dur.toFixed(1)}s of screen (segment ${seg.id}) is short — consider absorbing or extending it`);
      }
    }
  } catch (err) {
    // ignore overlap errors here, E2 handles it
  }

  // E1 span-overlap
  for (let i = 1; i < spans.length; i++) {
    if (spans[i].start < spans[i - 1].end) {
      errors.push(`E1 span-overlap: ${spans[i].id} starts at ${spans[i].start.toFixed(1)}s before ${spans[i - 1].id} ends (${spans[i - 1].end.toFixed(1)}s)`);
    }
  }

  // E2 fullframe-collision — a fullframe card would fully cover the paid
  // full-screen avatar; overlays are allowed by design (design doc 2026-07-18).
  const fullframes = (resolvedCues ?? []).filter((c) => c.placement === 'fullframe');
  for (const s of spans) {
    for (const c of fullframes) {
      const cEnd = c.start + c.duration;
      if (s.start < cEnd && c.start < s.end) {
        errors.push(`E2 fullframe-collision: ${s.id} (${s.start.toFixed(1)}–${s.end.toFixed(1)}s) overlaps fullframe cue ${c.id} (${c.start.toFixed(1)}–${cEnd.toFixed(1)}s)`);
      }
    }
  }

  // E3 span-min / W1 span-max
  for (const s of spans) {
    if (s.duration < SPAN_MIN) errors.push(`E3 span-min: ${s.id} is ${s.duration.toFixed(1)}s (minimum ${SPAN_MIN}s)`);
    const inZone = s.start <= T * FRONT_ZONE || s.end >= T * (1 - BACK_ZONE);
    const maxWarn = inZone ? SPAN_MAX_ZONE : SPAN_MAX_MID;
    if (s.duration > maxWarn) {
      warnings.push(`W1 span-max: ${s.id} is ${s.duration.toFixed(1)}s (target under ${maxWarn}s for ${inZone ? 'an intro/outro' : 'a mid-video'} span — Youri bridges run 10–30s)`);
    }
  }

  // E4 budget-cap / W2 budget-target
  const total = spans.reduce((sum, s) => sum + s.duration, 0);
  if (total > AVATAR_FULL_CAP) {
    errors.push(`E4 budget-cap: ${total.toFixed(0)}s total full-screen avatar exceeds cap ${AVATAR_FULL_CAP}s`);
  }
  const target = AVATAR_FULL_TARGET * (T / 1800);
  if (spans.length && total < target * 0.5) {
    warnings.push(`W2 budget-target: ${total.toFixed(0)}s total is under half the scaled target (~${target.toFixed(0)}s for a ${(T / 60).toFixed(1)}min video) — don't be stingy relative to the target`);
  }

  // W3 u-curve — front-load and back-load expectations
  if (spans.length) {
    if (!spans.some((s) => s.start <= T * FRONT_ZONE)) {
      warnings.push(`W3 u-curve: no span starts in the first ${(FRONT_ZONE * 100).toFixed(0)}% of the video — the open should be host-heavy`);
    }
    if (!spans.some((s) => s.end >= T * (1 - BACK_ZONE))) {
      warnings.push(`W3 u-curve: no span reaches the last ${(BACK_ZONE * 100).toFixed(0)}% of the video — land on the host`);
    }
  }

  // W4 span-cadence — no stretch without the host longer than GAP_AVATAR_MAX
  // between consecutive spans (start/end coverage is W3's job).
  for (let i = 1; i < spans.length; i++) {
    const gap = spans[i].start - spans[i - 1].end;
    if (gap > GAP_AVATAR_MAX) {
      warnings.push(`W4 span-cadence: ${gap.toFixed(0)}s without full-screen host between ${spans[i - 1].id} and ${spans[i].id} (max ${GAP_AVATAR_MAX}s) — add a short mid-video host beat`);
    }
  }

  return { errors, warnings };
}


async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/lint-shots.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const shotsResolved = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.resolved.json'), 'utf8'));
  const resolvedFile = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));

  const { errors, warnings } = lintShots({ shotsResolved, resolvedCues: resolvedFile.resolved, words });
  for (const w of warnings) console.log(w);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
