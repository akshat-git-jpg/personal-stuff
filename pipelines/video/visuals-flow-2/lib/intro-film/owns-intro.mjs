import fs from 'node:fs';
import path from 'node:path';
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

// The span the film owns, or null when it owns nothing. Derived here rather
// than inline at each call site for the same reason the predicate is: assemble
// computed it privately, so lint-shots could not see it and E8 kept demanding a
// host inside a span vf2 does not place avatars in. A rule that cannot see the
// film is a rule that fires on every film-owned video.
export function filmSpanFor(workdir) {
  if (!introOwnedByFilm(workdir)) return null;
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
