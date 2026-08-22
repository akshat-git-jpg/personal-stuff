import fs from 'node:fs';
import path from 'node:path';

// Two questions about a video's intro, and nothing else:
//   introSpan(workdir) — WHERE is the intro? (measured, from segments.json)
//   introMode(workdir) — WHICH flow builds it? (simple | complex, from run-config)
//
// History: between 2026-08-07 (plan 194) and 2026-08-22 there was only one flow,
// the bespoke film, so this module held introSpan() alone. The owner restored the
// choice on 2026-08-22 — see decisions.md. The legacy `intro: "cards" | "film"`
// key is NOT what came back; `introMode: simple | complex` is a new vocabulary
// over two flows that both exist. See lib/run-config.mjs.
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


import { loadRunConfig } from './run-config.mjs';

// WHICH intro flow this video runs. `introSpan()` above answers WHERE the intro is;
// this answers HOW it gets built. Both flows own the same span and both produce
// intro-film/out/intro.mp4, so every consumer downstream of the render is
// mode-blind by construction.
export function introMode(workdir) {
  return loadRunConfig(workdir).introMode;
}
