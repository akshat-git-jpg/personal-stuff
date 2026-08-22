// The simple-flow pacing lint (plan 220). Seven codes, S1-S7, encoding the
// ratios measured from the owner's four reference intros (2026-08-22) — see
// plan 220 and decisions.md. These numbers replace per-video taste about
// pacing; nothing here is advisory (LESSONS 2026-07-24: "making an LLM audit
// advisory means it gets ignored — port doctrine as GATES, not signals").
//
// Mirrors lib/lint-cues.mjs's report shape: `{ errors: [], warnings: [] }`.
// There are no warnings in this lint — every rule below is a hard gate. What
// the CLI additionally prints as `NOTICE` lines (plan 229) are NOT rules and
// never touch the exit code: they flag a body card running far shorter than
// the length it was designed for, so the owner knows where to look in the
// first render. Body cards hard-code their motion schedule in absolute
// seconds; only the four cards ported from the old intro kit scale to a
// `duration` variable.
//
// fs/path/resolveWorkdir/pathToFileURL are only used by the CLI guard at the
// bottom (the `intro-simple-lint` verb) — lintCutlist() itself is pure.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkdir } from '../workdir.mjs';
import { loadKit, loadCutlist } from './inputs.mjs';

// The three thresholds are module constants so the mutation recipe
// (plans/220-vf-intro-simple-flow.md) can reach them by name.
export const AVATAR_MAX_SHARE = 0.55; // S1
export const AVATAR_MAX_HOLD = 5.0; // S2, seconds
export const CUT_MIN = 1.5; // S3, seconds
export const CUT_MAX = 4.0; // S3, seconds

const EPS = 0.01;

function beatDuration(b) {
  return b.t_end - b.t_start;
}

// avatar-full time: `overlay` beats count as avatar time because the
// presenter is still on screen underneath the card (KIT.md, lower-third).
function isAvatarTime(b) {
  return b.kind === 'avatar' || b.kind === 'overlay';
}

function normWord(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

// S1 — avatar share of the whole span must be <= AVATAR_MAX_SHARE.
function checkS1(cutlist) {
  const errors = [];
  const total = cutlist.span.end - cutlist.span.start;
  if (!(total > 0)) return errors;
  const avatarTotal = cutlist.beats.filter(isAvatarTime).reduce((sum, b) => sum + beatDuration(b), 0);
  const share = avatarTotal / total;
  if (share > AVATAR_MAX_SHARE + 1e-9) {
    errors.push(
      `S1 avatar-share: avatar share ${share.toFixed(2)} exceeds ${AVATAR_MAX_SHARE} ` +
        `(${avatarTotal.toFixed(1)}s avatar+overlay of ${total.toFixed(1)}s total)`,
    );
  }
  return errors;
}

// S2 — no single avatar-alone beat longer than AVATAR_MAX_HOLD.
function checkS2(cutlist) {
  const errors = [];
  for (const b of cutlist.beats) {
    if (b.kind !== 'avatar') continue;
    const dur = beatDuration(b);
    if (dur > AVATAR_MAX_HOLD + 1e-9) {
      errors.push(`S2 avatar-hold: ${b.id} holds the avatar alone for ${dur.toFixed(1)}s (max ${AVATAR_MAX_HOLD}s)`);
    }
  }
  return errors;
}

// S3 — every beat's length must be within [CUT_MIN, CUT_MAX].
function checkS3(cutlist) {
  const errors = [];
  for (const b of cutlist.beats) {
    const dur = beatDuration(b);
    if (dur < CUT_MIN - 1e-9 || dur > CUT_MAX + 1e-9) {
      errors.push(`S3 cut-length: ${b.id} runs ${dur.toFixed(2)}s, outside [${CUT_MIN}, ${CUT_MAX}]`);
    }
  }
  return errors;
}

// S4 — vars satisfies the card's catalog.json contract, and the beat's kind
// agrees with the card's own placement. Five sub-rules, each with its own
// suffix so a failure names what is wrong:
//   unknown-card       the slug is not in catalog.json
//   kind-mismatch      an overlay-placement card used as kind "card", or vice versa
//   missing-vars       a required variable is absent
//   extra-vars         a variable outside required + optional
//   renderer-owned-var `duration`, which render-simple.mjs computes and injects
// plus two beat-array rules for beat cards: bad-beat (an element failing the
// catalog's beat_shape) and too-many-beats (over max_beats).
function checkS4(cutlist, kit) {
  const errors = [];
  const bySlug = Object.fromEntries((kit?.cards ?? []).map((c) => [c.slug, c]));
  for (const b of cutlist.beats) {
    if (b.kind !== 'card' && b.kind !== 'overlay') continue;
    const card = bySlug[b.card];
    if (!card) {
      errors.push(
        `S4 unknown-card: ${b.id} references card "${b.card}", which is not in card-library/catalog.json — ` +
          'the intro and the body draw from the same catalogue, so a slug is "<type>/<card>", never a bare name',
      );
      continue;
    }
    if (Boolean(card.overlay) !== (b.kind === 'overlay')) {
      errors.push(
        `S4 kind-mismatch: ${b.id} uses card "${b.card}" as kind "${b.kind}", but its catalog placement is ` +
          `${card.overlay ? 'overlay' : 'fullframe'} — an overlay card may only be used with kind "overlay", and vice versa`,
      );
    }
    const allowed = new Set([...card.required, ...card.optional]);
    const vars = b.vars ?? {};
    const missing = card.required.filter((k) => !(k in vars));
    const ownedByRenderer = Object.keys(vars).filter((k) => k === 'duration');
    const extra = Object.keys(vars).filter((k) => !allowed.has(k) && k !== 'duration');
    if (missing.length) {
      errors.push(`S4 missing-vars: ${b.id} (${b.card}) is missing required var(s): ${missing.join(', ')}`);
    }
    if (ownedByRenderer.length) {
      errors.push(
        `S4 renderer-owned-var: ${b.id} (${b.card}) sets "duration" — render-simple.mjs computes it from ` +
          't_end - t_start and injects it, so a value here is silently overwritten. Change the beat length instead.',
      );
    }
    if (extra.length) {
      errors.push(`S4 extra-vars: ${b.id} (${b.card}) has var(s) outside required/optional: ${extra.join(', ')}`);
    }
    // Beat arrays. `at` is the cut list's own addition — the body pipeline's
    // resolver computes each reveal time from the transcript, while a cut list
    // authors it directly (rebased to the beat's own start), so it is allowed
    // on every element and is not part of any card's beat_shape.
    const beatsArr = vars.beats;
    if (Array.isArray(beatsArr) && beatsArr.length) {
      if (!card.beatShape) {
        errors.push(`S4 bad-beat: ${b.id} (${b.card}) supplies beats, but that card is not a beat card in catalog.json`);
      } else {
        if (card.maxBeats !== null && beatsArr.length > card.maxBeats) {
          errors.push(
            `S4 too-many-beats: ${b.id} (${b.card}) has ${beatsArr.length} beats, over its catalog max_beats of ${card.maxBeats}`,
          );
        }
        const shapeKeys = new Set([...Object.keys(card.beatShape), 'at']);
        for (const [i, el] of beatsArr.entries()) {
          if (!el || typeof el !== 'object' || Array.isArray(el)) {
            errors.push(`S4 bad-beat: ${b.id} (${b.card}) beats[${i}] is not an object`);
            continue;
          }
          for (const [k, spec] of Object.entries(card.beatShape)) {
            if (spec?.required && !(k in el)) {
              errors.push(`S4 bad-beat: ${b.id} (${b.card}) beats[${i}] is missing required key "${k}"`);
            }
          }
          for (const k of Object.keys(el)) {
            if (!shapeKeys.has(k)) {
              errors.push(`S4 bad-beat: ${b.id} (${b.card}) beats[${i}] has key "${k}" outside the card's beat_shape`);
            }
          }
        }
      }
    }
  }
  return errors;
}

// S5 — beats tile the span exactly: sorted, contiguous to within 0.01s, the
// first beat starts at span.start, the last ends at span.end.
function checkS5(cutlist) {
  const errors = [];
  const beats = [...cutlist.beats].sort((a, b) => a.t_start - b.t_start);
  if (!beats.length) return errors;

  const first = beats[0];
  if (Math.abs(first.t_start - cutlist.span.start) > EPS) {
    errors.push(`S5 tiling: first beat ${first.id} starts at ${first.t_start}, but the span starts at ${cutlist.span.start}`);
  }
  for (let i = 1; i < beats.length; i++) {
    const prev = beats[i - 1];
    const curr = beats[i];
    const gap = curr.t_start - prev.t_end;
    if (Math.abs(gap) > EPS) {
      errors.push(
        `S5 tiling: ${prev.id} ends at ${prev.t_end.toFixed(2)}, ${curr.id} starts at ${curr.t_start.toFixed(2)} ` +
          `(${gap > 0 ? 'gap' : 'overlap'} of ${Math.abs(gap).toFixed(2)}s)`,
      );
    }
  }
  const last = beats[beats.length - 1];
  if (Math.abs(last.t_end - cutlist.span.end) > EPS) {
    errors.push(`S5 tiling: last beat ${last.id} ends at ${last.t_end}, but the span ends at ${cutlist.span.end}`);
  }
  return errors;
}

// S6 was RETIRED by plan 229. It gated each card beat against a per-card
// minDuration/maxDuration that only ever existed in intro-kit/kit.json; the
// body catalogue has a single `default_duration` and no range. S3 already
// gates every beat at [CUT_MIN, CUT_MAX] = 1.5-4.0s, which is a tighter bound
// than any kit range was. The number is not reused: a future rule gets S8.

// S7 — every word in a card's vars.beats[] word list must appear, in order,
// among the transcript words spoken during that beat's own [t_start, t_end]
// window. The transcript is the source of truth, never the model's memory
// (the standalone intro POC put 4 of 5 product names wrong on screen).
function checkS7(cutlist, words) {
  const errors = [];
  const all = Array.isArray(words) ? words : [];
  for (const b of cutlist.beats) {
    const listed = b.vars?.beats;
    if (!Array.isArray(listed) || listed.length === 0) continue;

    const inWindow = all
      .filter((w) => w.start >= b.t_start - EPS && w.start < b.t_end + EPS)
      .map((w) => normWord(w.text));

    let cursor = 0;
    for (const item of listed) {
      const target = tokenize(item.text).map(normWord);
      if (target.length === 0) continue;
      let found = -1;
      for (let i = cursor; i <= inWindow.length - target.length; i++) {
        if (target.every((t, j) => inWindow[i + j] === t)) {
          found = i;
          break;
        }
      }
      if (found === -1) {
        errors.push(
          `S7 word-mismatch: ${b.id} claims the word "${item.text}" is spoken in [${b.t_start.toFixed(1)}, ${b.t_end.toFixed(1)}]s, ` +
            'but transcript.json has no such word there — never type a word from memory, use introWords()',
        );
        break;
      }
      cursor = found + target.length;
    }
  }
  return errors;
}

// NOT a rule — see the file header. Body cards hard-code their motion in
// absolute seconds against a catalog `default_duration` of 4-15s, while an
// intro beat runs 1.5-4.0s, so a body card in an intro plays its entry and is
// then cut off mid-idle. The owner accepted that (2026-08-23) rather than
// retrofitting every body card up front; these notices are how they find out
// WHICH cards actually look wrong in the first render.
export const TRUNCATION_RATIO = 0.6;

export function truncationNotices({ cutlist, kit }) {
  const bySlug = Object.fromEntries((kit?.cards ?? []).map((c) => [c.slug, c]));
  const out = [];
  for (const b of cutlist.beats ?? []) {
    if (b.kind !== 'card' && b.kind !== 'overlay') continue;
    const card = bySlug[b.card];
    if (!card || card.defaultDuration === null) continue;
    const dur = beatDuration(b);
    if (dur < card.defaultDuration * TRUNCATION_RATIO) {
      out.push(
        `NOTICE truncation: ${b.id} (${b.card}) runs ${dur.toFixed(2)}s against a card designed for ` +
          `${card.defaultDuration}s — watch this one in the render; its motion may be cut off mid-way`,
      );
    }
  }
  return out;
}

export function lintCutlist({ cutlist, kit, words }) {
  const errors = [
    ...checkS1(cutlist),
    ...checkS2(cutlist),
    ...checkS3(cutlist),
    ...checkS4(cutlist, kit),
    ...checkS5(cutlist),
    ...checkS7(cutlist, words),
  ];
  return { errors, warnings: [] };
}

// The `intro-simple-lint` helper verb (steps/_verbs.json): the cheap check
// before a render — prints the S1-S7 report against a real workdir's cut
// list without rendering anything.
function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-kit/lint-cutlist.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(slug);
  const cutlist = loadCutlist(workdir);
  const kit = loadKit();
  const transcriptPath = path.join(workdir, 'transcript.json');
  const words = fs.existsSync(transcriptPath) ? JSON.parse(fs.readFileSync(transcriptPath, 'utf8')) : [];

  const { errors } = lintCutlist({ cutlist, kit, words });
  if (errors.length) {
    for (const e of errors) console.error(e);
    console.error(`${errors.length} pacing lint error(s)`);
    process.exit(1);
  }
  for (const n of truncationNotices({ cutlist, kit })) console.log(n);
  console.log('intro-simple pacing lint: 0 errors (S1-S7)');
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
