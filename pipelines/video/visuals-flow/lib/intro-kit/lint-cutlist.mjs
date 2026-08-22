// The simple-flow pacing lint (plan 220). Seven codes, S1-S7, encoding the
// ratios measured from the owner's four reference intros (2026-08-22) — see
// plan 220 and decisions.md. These numbers replace per-video taste about
// pacing; nothing here is advisory (LESSONS 2026-07-24: "making an LLM audit
// advisory means it gets ignored — port doctrine as GATES, not signals").
//
// Mirrors lib/lint-cues.mjs's report shape: `{ errors: [], warnings: [] }`.
// There are no warnings in this lint — every rule below is a hard gate.

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

// S4 — vars satisfies the card's kit.json required/optional lists exactly,
// and the beat's kind agrees with the card's own overlay flag.
function checkS4(cutlist, kit) {
  const errors = [];
  const bySlug = Object.fromEntries((kit?.cards ?? []).map((c) => [c.slug, c]));
  for (const b of cutlist.beats) {
    if (b.kind !== 'card' && b.kind !== 'overlay') continue;
    const card = bySlug[b.card];
    if (!card) {
      errors.push(`S4 unknown-card: ${b.id} references card "${b.card}", which is not in kit.json`);
      continue;
    }
    if (Boolean(card.overlay) !== (b.kind === 'overlay')) {
      errors.push(
        `S4 kind-mismatch: ${b.id} uses card "${b.card}" as kind "${b.kind}", but kit.json marks its overlay flag ` +
          `${card.overlay} — an overlay card may only be used with kind "overlay", and vice versa`,
      );
    }
    const required = card.required ?? [];
    const optional = card.optional ?? [];
    const allowed = new Set([...required, ...optional]);
    const vars = b.vars ?? {};
    const missing = required.filter((k) => !(k in vars));
    const extra = Object.keys(vars).filter((k) => !allowed.has(k));
    if (missing.length) {
      errors.push(`S4 missing-vars: ${b.id} (${b.card}) is missing required var(s): ${missing.join(', ')}`);
    }
    if (extra.length) {
      errors.push(`S4 extra-vars: ${b.id} (${b.card}) has var(s) outside required/optional: ${extra.join(', ')}`);
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

// S6 — each card beat's length is within that card's kit.json min/maxDuration.
function checkS6(cutlist, kit) {
  const errors = [];
  const bySlug = Object.fromEntries((kit?.cards ?? []).map((c) => [c.slug, c]));
  for (const b of cutlist.beats) {
    if (b.kind !== 'card' && b.kind !== 'overlay') continue;
    const card = bySlug[b.card];
    if (!card) continue; // S4 already reports an unknown card
    const dur = beatDuration(b);
    if (dur < card.minDuration - 1e-9 || dur > card.maxDuration + 1e-9) {
      errors.push(
        `S6 card-duration: ${b.id} (${b.card}) runs ${dur.toFixed(2)}s, outside its kit range ` +
          `[${card.minDuration}, ${card.maxDuration}]`,
      );
    }
  }
  return errors;
}

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

export function lintCutlist({ cutlist, kit, words }) {
  const errors = [
    ...checkS1(cutlist),
    ...checkS2(cutlist),
    ...checkS3(cutlist),
    ...checkS4(cutlist, kit),
    ...checkS5(cutlist),
    ...checkS6(cutlist, kit),
    ...checkS7(cutlist, words),
  ];
  return { errors, warnings: [] };
}
