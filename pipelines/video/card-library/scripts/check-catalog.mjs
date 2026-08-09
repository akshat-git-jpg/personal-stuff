import fs from 'node:fs';
import { validateVariable } from '../../visuals-flow/lib/resolve.mjs';

const ROLES = ['heading', 'sentence', 'label', 'descriptor', 'value', 'logo_slug', 'icon_name', 'free'];
const catalog = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));

let failed = false;
function err(msg) {
  console.error(msg);
  failed = true;
}

function checkSpec(spec, path) {
  if (typeof spec === 'string') {
    err(`FAIL: ${path} is still a string: "${spec}"`);
    return;
  }
  if (!spec.type) {
    err(`FAIL: ${path} missing type`);
    return;
  }
  if (spec.type === 'string') {
    if (!spec.role) err(`FAIL: ${path} missing role`);
    else if (!ROLES.includes(spec.role)) err(`FAIL: ${path} has invalid role "${spec.role}"`);
    
    if (spec.example === undefined) err(`FAIL: ${path} missing example`);
    else {
      const errs = validateVariable(path + '.example', spec.example, spec);
      if (errs.length) err(`FAIL: ${path} example failed validation:\n  ${errs.join('\n  ')}`);
    }
  }
  if (spec.type === 'object' && spec.shape) {
    for (const [k, v] of Object.entries(spec.shape)) checkSpec(v, `${path}.${k}`);
  }
  if (spec.type === 'array' && spec.item_shape) {
    for (const [k, v] of Object.entries(spec.item_shape)) {
      checkSpec(v, `${path}[].${k}`);
    }
  }
}

for (const card of catalog.cards) {
  for (const [k, spec] of Object.entries(card.variables ?? {})) {
    checkSpec(spec, `${card.slug}.variables.${k}`);
  }
  for (const [k, spec] of Object.entries(card.beat_shape ?? {})) {
    checkSpec(spec, `${card.slug}.beat_shape.${k}`);
  }
  if (card.register !== undefined) {
    if (!Array.isArray(card.register)) err(`FAIL: ${card.slug}.register must be an array`);
    else if (!card.register.every(r => r === 'dark' || r === 'light')) err(`FAIL: ${card.slug}.register must be array subset of ["dark","light"]`);
  }
  if (card.marker !== undefined && typeof card.marker !== 'boolean') err(`FAIL: ${card.slug}.marker must be boolean`);
  if (card.intent !== undefined) {
    if (typeof card.intent !== 'string') err(`FAIL: ${card.slug}.intent must be string`);
    else if (card.intent.includes('\n')) err(`FAIL: ${card.slug}.intent must be one line`);
  }
  if (card.anti_intent !== undefined) {
    if (typeof card.anti_intent !== 'string') err(`FAIL: ${card.slug}.anti_intent must be string`);
    else if (card.anti_intent.includes('\n')) err(`FAIL: ${card.slug}.anti_intent must be one line`);
  }
  if (card.variants !== undefined) {
    if (!Array.isArray(card.variants)) err(`FAIL: ${card.slug}.variants must be an array`);
    else if (!card.variants.every(v => typeof v === 'string')) err(`FAIL: ${card.slug}.variants must be array of strings`);
  }
  if (card.continuity !== undefined && typeof card.continuity !== 'boolean') err(`FAIL: ${card.slug}.continuity must be boolean`);
  // A beat/word-sync card MUST declare max_beats / max_reveal_chars.
  // visuals-flow's synthCalibrationVars reads `max_beats ?? 0`, so a card
  // without it silently synthesizes ZERO beats — the calibrate page renders an
  // empty card and board.test.mjs fails, in a package this gate does not run.
  // That is how `enacted/bad-clip-montage` landed green here and left main red
  // (2026-07-28).
  if (card.kind === 'beat' || card.kind === 'word-sync') {
    if (typeof card.max_beats !== 'number' || card.max_beats < 1) {
      err(`FAIL: ${card.slug}.max_beats must be a number >= 1 on a ${card.kind} card — visuals-flow synthesizes 0 beats without it`);
    }
    // "transcript" landed with plan 177 (PR #135, 2026-08-02): the resolver
    // derives beat times from the transcript instead of the cue author writing
    // them, reading the item list named by `beat_items`
    // (visuals-flow/lib/transcript-beats.mjs:4). The plan added the catalog
    // entry and the resolver but never taught THIS validator the new value, so
    // `tool-icon/roster-pop` landed on main failing check-cards while the
    // plan's own gate stayed green — its test_cmd ran only inside
    // visuals-flow, and the catalog it edited lives here. Same shape as
    // LESSONS 2026-07-21.
    if (!['beat', 'variables', 'transcript'].includes(card.beat_source)) {
      err(`FAIL: ${card.slug}.beat_source must be "beat", "variables" or "transcript"`);
    } else if (card.beat_source === 'transcript') {
      if (!card.beat_items) err(`FAIL: ${card.slug} has beat_source "transcript" but missing beat_items`);
      else if (!card.variables || !card.variables[card.beat_items] || card.variables[card.beat_items].type !== 'array') {
        err(`FAIL: ${card.slug} beat_items "${card.beat_items}" must exist in variables with type "array"`);
      }
      // Beats are derived, so the card still needs a beat_shape to describe what
      // each derived beat carries, and a reveal budget to size it against.
      if (!card.beat_shape) err(`FAIL: ${card.slug} has beat_source "transcript" but missing beat_shape`);
      if (typeof card.max_reveal_chars !== 'number' || card.max_reveal_chars < 1) {
        err(`FAIL: ${card.slug}.max_reveal_chars must be a number >= 1 for beat_source "transcript"`);
      }
    } else if (card.beat_source === 'beat') {
      if (!card.beat_shape) err(`FAIL: ${card.slug} has beat_source "beat" but missing beat_shape`);
      if (typeof card.max_reveal_chars !== 'number' || card.max_reveal_chars < 1) {
        err(`FAIL: ${card.slug}.max_reveal_chars must be a number >= 1 for beat_source "beat"`);
      }
    } else if (card.beat_source === 'variables') {
      if (!card.beat_var) err(`FAIL: ${card.slug} has beat_source "variables" but missing beat_var`);
      else if (!card.variables || !card.variables[card.beat_var] || card.variables[card.beat_var].type !== 'array') {
        err(`FAIL: ${card.slug} beat_var "${card.beat_var}" must exist in variables with type "array"`);
      }
      if (card.beat_shape !== undefined) err(`FAIL: ${card.slug} has beat_source "variables" but declares beat_shape`);
      if (card.max_reveal_chars !== undefined) err(`FAIL: ${card.slug} has beat_source "variables" but declares max_reveal_chars`);
    }
  } else {
    for (const key of ['beat_source', 'beat_shape', 'max_reveal_chars', 'max_beats']) {
      if (card[key] !== undefined) {
        err(`FAIL: ${card.slug} declares ${key} but kind is "${card.kind}" — only beat/word-sync cards reveal over time`);
      }
    }
  }
  if (card.placement === 'fullframe') {
    if (typeof card.side !== 'boolean') {
      err(`FAIL: ${card.slug}.side must be a boolean (true = renders correctly at 1200x1080; false = needs full canvas). This key is REQUIRED on fullframe cards so the decision is deliberate.`);
    }
  } else if (card.side !== undefined) {
    err(`FAIL: ${card.slug}.side only applies to fullframe cards`);
  }

  // beat_align (2026-08-07): where in its anchor phrase a reveal lands. Default
  // "start" suits a beat that MIRRORS the words as they are spoken; "end" suits
  // one that draws a CONCLUSION about them, which otherwise states the point
  // before the presenter finishes making it (owner c28). Validated here because
  // a typo silently falls back to "start" and the defect is invisible in data —
  // only a frame shows it.
  if (card.beat_align !== undefined) {
    if (!['start', 'end'].includes(card.beat_align)) {
      err(`FAIL: ${card.slug}.beat_align must be "start" or "end" (got ${JSON.stringify(card.beat_align)}) — a typo silently reverts to "start"`);
    }
    if (card.kind !== 'beat') {
      err(`FAIL: ${card.slug} declares beat_align but kind is "${card.kind}" — only beat cards place reveals`);
    }
  }

  // spoken_var (2026-08-07): names the variable whose text the presenter says
  // out loud, so visuals-flow can pace the animation and the exposure off the
  // transcript instead of off `default_duration`. A card that animates copy over
  // its clip length WITHOUT this drifts out of sync with the voice, which is
  // what prompt-typing did (owner c04/c16/c24).
  if (card.spoken_var !== undefined) {
    if (typeof card.spoken_var !== 'string' || !card.spoken_var) {
      err(`FAIL: ${card.slug}.spoken_var must be a non-empty variable name`);
    } else if (!card.variables || !card.variables[card.spoken_var]) {
      err(`FAIL: ${card.slug} spoken_var "${card.spoken_var}" is not a declared variable`);
    } else if (card.variables[card.spoken_var].type !== 'string') {
      err(`FAIL: ${card.slug} spoken_var "${card.spoken_var}" must be a string variable`);
    }
  }
}

if (failed) process.exit(1);
console.log('catalog ok');
