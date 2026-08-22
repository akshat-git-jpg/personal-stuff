// The shape check for intro-simple/cutlist.json — types and required keys
// ONLY, never pacing. Pacing is lint-cutlist.mjs's job; a cutlist that fails
// its own shape must say so in a plain sentence before the pacing lint ever
// runs against it (a malformed file crashing three levels deep inside a
// duration-share calculation is a debugging session, not a defect report).
//
// See plan 220's "The cut list" section — this schema is the contract, and
// the authoring model writes ONLY this file, never HTML.

export const KINDS = ['avatar', 'card', 'overlay'];

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

export function validateShape(cutlist) {
  const errors = [];

  if (!cutlist || typeof cutlist !== 'object' || Array.isArray(cutlist)) {
    return ['cutlist must be an object'];
  }

  if (typeof cutlist.video !== 'string' || !cutlist.video.trim()) {
    errors.push('video must be a non-empty string');
  }
  if (cutlist.mode !== 'simple') {
    errors.push(`mode must be "simple", got ${JSON.stringify(cutlist.mode)}`);
  }
  if (!cutlist.span || typeof cutlist.span !== 'object'
      || !isFiniteNumber(cutlist.span.start) || !isFiniteNumber(cutlist.span.end)) {
    errors.push('span.start and span.end must be numbers');
  }
  if (typeof cutlist.approved !== 'boolean') {
    errors.push('approved must be a boolean — the authoring step never writes true itself');
  }

  if (!Array.isArray(cutlist.beats) || cutlist.beats.length === 0) {
    errors.push('beats must be a non-empty array');
    return errors; // nothing below is checkable without a beats array
  }

  const seenIds = new Set();
  for (const b of cutlist.beats) {
    const label = (b && typeof b.id === 'string' && b.id) ? b.id : JSON.stringify(b);
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      errors.push(`beat is not an object: ${label}`);
      continue;
    }
    if (typeof b.id !== 'string' || !b.id.trim()) {
      errors.push(`beat missing a string id: ${JSON.stringify(b)}`);
    } else if (seenIds.has(b.id)) {
      errors.push(`duplicate beat id "${b.id}"`);
    } else {
      seenIds.add(b.id);
    }
    if (!KINDS.includes(b.kind)) {
      errors.push(`${label}: kind must be one of ${KINDS.join('|')}, got ${JSON.stringify(b.kind)}`);
    }
    if (!isFiniteNumber(b.t_start) || !isFiniteNumber(b.t_end) || !(b.t_end > b.t_start)) {
      errors.push(`${label}: t_start/t_end must be numbers with t_end > t_start`);
    }
    if (b.kind === 'card' || b.kind === 'overlay') {
      if (typeof b.card !== 'string' || !b.card.trim()) {
        errors.push(`${label}: "card" is required when kind is "${b.kind}"`);
      }
      if (b.vars !== undefined && (typeof b.vars !== 'object' || Array.isArray(b.vars) || b.vars === null)) {
        errors.push(`${label}: vars must be an object`);
      }
    }
  }

  return errors;
}
