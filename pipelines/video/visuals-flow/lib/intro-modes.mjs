import fs from 'node:fs';
import path from 'node:path';
import { loadRunConfig } from './run-config.mjs';
import { INTRO_MODES, INTRO_MODE_NAMES } from './intro-mode-table.mjs';

// The capability every consumer actually needs is "does the active intro flow
// own the intro span?", but it used to be spelled as an identity check against
// ONE flow (is the mode "film"?). Three sites asked that question
// (zone-constants' zonePartsFor, and lint-cues' E13 suppression and E23
// activation), so a third flow meant widening all three and the old
// predicate. Asked as a capability, a third flow changes only the table in
// lib/intro-mode-table.mjs.
//
// The table itself lives in that leaf module rather than here to break the
// import cycle: this file calls loadRunConfig from lib/run-config.mjs, and
// run-config.mjs derives its accepted enum from the table — both import it
// from the leaf instead of from each other.
export { INTRO_MODES, INTRO_MODE_NAMES };

export function introModeFor(workdir) {
  const name = loadRunConfig(workdir).intro;
  const mode = INTRO_MODES[name];
  if (!mode) throw new Error(`E-INTRO unknown intro mode "${name}" — declare it in lib/intro-modes.mjs`);
  return { name, ...mode };
}

// THE capability query. Every consumer asks this, never "is the mode film?".
export function ownsIntroSpan(workdir) {
  return introModeFor(workdir).ownsIntroSpan;
}

// The span the active intro flow owns, or null when it owns nothing.
export function introSpanFor(workdir) {
  const mode = introModeFor(workdir);
  if (!mode.ownsIntroSpan) return null;
  if (mode.spanFrom !== 'segments.structure.intro') {
    throw new Error(`E-INTRO mode "${mode.name}" declares spanFrom "${mode.spanFrom}", which has no reader`);
  }
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
