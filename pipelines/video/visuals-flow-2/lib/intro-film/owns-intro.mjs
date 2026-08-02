import { loadRunConfig } from '../run-config.mjs';

// The SINGLE source of truth for "the bespoke film owns the intro span".
// Five surfaces stand down on this; if any of them tests run-config directly
// instead, they drift apart and the failure is silent wrong output, not a
// crash. That is the same shape as the 2026-08-01 link-CTA inversion, where a
// rule folded into one rulebook never reached the pass that actually authored
// the thing it governed.
export function introOwnedByFilm(workdir) {
  return loadRunConfig(workdir).intro === 'film';
}
