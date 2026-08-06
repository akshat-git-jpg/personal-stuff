import fs from 'node:fs';
import path from 'node:path';
import { loadRunConfig } from './run-config.mjs';

// Every intro flow the pipeline supports, declared. Adding a flow is a row here
// plus its own step folders — NOT a hunt through consumers.
//
// Why this exists: the capability every consumer actually needs is "does the
// active intro flow own the intro span?", but it used to be spelled
// `introOwnedByFilm(workdir)` — an identity check against ONE flow. Three sites
// asked that question (zone-constants' zonePartsFor, and lint-cues' E13
// suppression and E23 activation), so a third flow meant widening all three and
// the predicate. Asked as a capability, a third flow changes only this table.
//
//   ownsIntroSpan  the flow renders the intro itself, so the cue passes must
//                  stand down over the intro span: zones drop "intro", E13
//                  (open-cover) is suppressed, E23 (link-scrim) is enabled.
//   spanFrom       where the owned span comes from, or null when it owns nothing.
export const INTRO_MODES = {
  cards: {
    label: 'catalog cards',
    ownsIntroSpan: false,
    spanFrom: null,
  },
  film: {
    label: 'bespoke intro film',
    ownsIntroSpan: true,
    spanFrom: 'segments.structure.intro',
  },
};

export const INTRO_MODE_NAMES = Object.keys(INTRO_MODES);

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
