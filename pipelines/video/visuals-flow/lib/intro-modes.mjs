import fs from 'node:fs';
import path from 'node:path';

// The intro is ALWAYS the bespoke intro film (owner decision 2026-08-07:
// "i want film only.., basically intro is bespook"). There is no mode to pick,
// so there is no capability query any more — this module answers the one
// question that survives the choice: WHERE is the intro?
//
// This replaced lib/intro-mode-table.mjs + ownsIntroSpan(). That table existed
// so a third intro flow would be one row instead of a hunt through consumers,
// which was right while `cards` and `film` both existed. With `cards` gone the
// table had a single row and every `if (ownsIntroSpan(...))` had a dead false
// branch — untested code that reads as coverage. The realistic next bespoke
// part (a conclusion film) would need its own span helper, not this one.
//
// Returns null when segments.json has not been written yet, or carries no
// intro part. Callers treat null as "not measured yet", never as "no film".
export function introSpan(workdir) {
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
