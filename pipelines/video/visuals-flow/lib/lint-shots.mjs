import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { planSegments } from './assemble.mjs';
import { SHOT_CONSTANTS as SC } from './shot-constants.mjs';
import { introSpan } from './intro-modes.mjs';

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
const INTRO_HOST_BY = SC.INTRO_HOST.value;

// Raised 2.5→6 / 5→8 with SLIVER_GRAPHIC (owner final-v1:3, 2026-07-31):
// screen time under 6s shows nothing meaningful. Graphic-adjacent slivers are
// auto-absorbed at assembly; between two avatars nothing can absorb, so the
// plan itself must change — hence the hard error.
const MIN_SCREEN_ERROR = 6;
const MIN_SCREEN_WARN = 8;

                                    //     presence mid-video, not just the U-curve ends)

export function lintShots({ shotsResolved, resolvedCues, words, catalog, filmSpan = null }) {
  const errors = [];
  const warnings = [];
  if (!words || words.length === 0) return { errors, warnings };
  const T = words[words.length - 1].end;

  // E8 intro-host: the host must be ON SCREEN by INTRO_HOST_BY seconds.
  //
  // This rule existed in shot-constants (and therefore in the shot-pass prompt)
  // since 2026-08-01 with NOTHING enforcing it — the model was asked and simply
  // not checked, which is the "advisory doctrine gets ignored" failure recorded
  // in plans/runs/LESSONS.md (2026-07-24). It also expressed the bound as "before
  // the intro ends", so on an 86.7s intro the host could land at 0:59 and pass.
  // The owner rejected exactly that on 2026-08-02. Hence: an absolute second
  // mark, and a real gate.
  //
  // A SIDE span counts as on-screen because the host is beside the card, not
  // hidden behind it — that is the shape the rule actively prefers.
  //
  // Scoped to plans that HAVE spans. An empty shot plan is neutral by an
  // existing tested invariant ("empty spans array → no errors, no warnings"),
  // and a plan with no host at all is a different defect from a host that is
  // merely late — firing here would redefine someone else's contract to suit
  // this rule.
  {
    // When the bespoke intro film owns the opening, vf2 places no avatar span
    // there — the host is INSIDE the film. Measuring from t=0 then demands a
    // span in a region vf2 deliberately does not touch, so E8 fired on every
    // film-owned video and blocked the shot pass outright.
    //
    // The rule is not waived, it is re-anchored: the owner's reason for E8
    // ("I don't want to put a hard rule that avatar should be the first thing,
    // but it should be in the starting") applies just as much to the body's
    // opening as to the video's. The deadline becomes 15s into the BODY.
    const deadline = filmSpan ? filmSpan.end + INTRO_HOST_BY : INTRO_HOST_BY;
    const anchor = filmSpan ? `${deadline.toFixed(1)}s (${INTRO_HOST_BY}s into the body — the intro film owns 0–${filmSpan.end.toFixed(1)}s)` : `${INTRO_HOST_BY}s`;

    const spans = [...(shotsResolved?.spans ?? [])].sort((a, b) => a.start - b.start);
    const onScreenBy = spans.find((s) => s.start <= deadline);
    if (spans.length > 0 && !onScreenBy) {
      const first = spans[0];
      const detail = `first host span ${first.id} starts at ${first.start.toFixed(1)}s`;
      const msg =
        `E8 intro-host: the host must be on screen by ${anchor} — ${detail}. ` +
        `Put a side-mode span over the opening card, or start a full-screen span at or before ${deadline.toFixed(1)}s ` +
        `(an opening motion graphic before the host is fine; a late host is not).`;
      // A per-video waiver exists ONLY so a cut planned before this gate can
      // still ship. It must carry a reason, and it is reported as a warning
      // every run rather than passing silently — an escape hatch nobody sees is
      // how a gate quietly stops being a gate (LESSONS 2026-07-21).
      const waiver = shotsResolved?.intro_host_waived;
      if (typeof waiver === 'string' && waiver.trim()) {
        warnings.push(`W8 intro-host-waived: ${msg} WAIVED: ${waiver.trim()}`);
      } else {
        errors.push(msg);
      }
    }
  }

  // E7 sentence-cut: a full-screen host span must start on a sentence START
  // and end on a sentence END — a mid-sentence camera cut reads as a jump and
  // "looks very weird" (owner final-v1:4, 2026-07-31; was only a "prefer" in
  // the rulebook, so s03 shipped anchored mid-sentence). Sentence edges come
  // from transcript punctuation; the video edges count as boundaries too.
  {
    const TOL = 0.35;
    const BREATH = 0.12;
    const wordText = (w) => w.text ?? w.word ?? '';
    // Each sentence start carries the silence before it: a start with no
    // audible gap cuts flush against the previous word and still READS as
    // mid-sentence (owner final-v1:4 — s03 sat on a legal sentence start whose
    // preceding word ended the same instant).
    // t=0 is a legal start: resolve-shots snaps a span beginning within
    // SNAP_EDGE of the video edge to exactly 0, which can sit BEFORE the
    // first word's start (s00, 2026-07-31).
    const sentenceStarts = [{ t: 0, gap: Infinity }, { t: words[0].start, gap: Infinity }];
    const sentenceEnds = [T];
    for (let i = 0; i < words.length - 1; i++) {
      if (/[.!?]["')\]]?$/.test(wordText(words[i]).trim())) {
        sentenceEnds.push(words[i].end);
        sentenceStarts.push({ t: words[i + 1].start, gap: +(words[i + 1].start - words[i].end).toFixed(3) });
      }
    }
    for (const s of shotsResolved.spans ?? []) {
      const hit = sentenceStarts.find((x) => Math.abs(x.t - s.start) <= TOL);
      if (!hit) {
        errors.push(`E7 sentence-cut: span ${s.id} starts at ${s.start.toFixed(2)}s, mid-sentence — a full-screen host span must start where a sentence starts`);
      } else if (hit.gap < BREATH) {
        warnings.push(`W7 flush-cut: span ${s.id} starts at a sentence start with only ${hit.gap.toFixed(2)}s of silence before it — the cut reads as mid-sentence; prefer the neighbouring sentence with a real breath before it`);
      }
      if (!sentenceEnds.some((t) => Math.abs(t - s.end) <= TOL)) {
        errors.push(`E7 sentence-cut: span ${s.id} ends at ${s.end.toFixed(2)}s, mid-sentence — a full-screen host span must end where a sentence ends`);
      }
    }
  }
  const spans = [...(shotsResolved.spans ?? [])].sort((a, b) => a.start - b.start);

  // E5 orphan-screen / W5 short-screen
  try {
    const avatarJobs = spans.map(s => ({ purpose: 'avatar-full', id: s.id, start: s.start, end: s.end }));
    const baseSegments = planSegments({ resolved: resolvedCues || [], avatarJobs, total: T, filmSpan });
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
        if (s.mode === 'panel') {
          errors.push(`E2 fullframe-collision: panel span ${s.id} (${s.start.toFixed(1)}–${s.end.toFixed(1)}s) overlaps fullframe cue ${c.id} — panels belong over screen/demo footage`);
        } else if (s.mode !== 'side') {
          errors.push(`E2 fullframe-collision: ${s.id} (${s.start.toFixed(1)}–${s.end.toFixed(1)}s) overlaps fullframe cue ${c.id} (${c.start.toFixed(1)}–${cEnd.toFixed(1)}s)`);
        }
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
  const fullSpans = spans.filter((s) => s.mode !== 'panel');
  const total = fullSpans.reduce((sum, s) => sum + s.duration, 0);
  if (total > AVATAR_FULL_CAP) {
    errors.push(`E4 budget-cap: ${total.toFixed(0)}s total full-screen avatar exceeds cap ${AVATAR_FULL_CAP}s`);
  }
  const target = AVATAR_FULL_TARGET * (T / 1800);
  if (fullSpans.length && total < target * 0.5) {
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

  // E6 side-coverage
  const sideSpans = spans.filter(s => s.mode === 'side');
  for (const s of sideSpans) {
    const overlappingCues = fullframes.filter(c => s.start < c.start + c.duration && c.start < s.end);
    if (overlappingCues.length === 0) {
      errors.push(`E6 side-coverage: side span ${s.id} has no covering cue`);
    } else if (overlappingCues.length > 1) {
      errors.push(`E6 side-coverage: side span ${s.id} crosses two cues`);
    } else {
      const c = overlappingCues[0];
      // Resolved cues carry the slug in `card`, not `slug` — this gate had
      // never fired before side mode's first production use (2026-07-31), so
      // the wrong field sat here reporting "card undefined" for every span.
      const cardDef = catalog?.cards?.find(card => card.slug === c.card);
      if (!cardDef?.side) {
        errors.push(`E6 side-coverage: side span ${s.id} covering card ${c.card} is not side-capable (catalog "side" is not true)`);
      } else {
        const cEnd = c.start + c.duration;
        if (s.start < c.start || s.end > cEnd) {
          warnings.push(`W6 side-outlives: side span ${s.id} outlives its covering cue`);
        }
      }
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
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));

  const { errors, warnings } = lintShots({ shotsResolved, resolvedCues: resolvedFile.resolved, words, catalog, filmSpan: introSpan(workdir) });
  for (const w of warnings) console.log(w);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
