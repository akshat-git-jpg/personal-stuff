// The simple flow's inputs, resolved once so both the authoring rulebook
// (SIMPLE-PASS.md) and the pacing lint / renderer agree on where they live.
import fs from 'node:fs';
import path from 'node:path';
import { introSpan } from '../intro-modes.mjs';

// pipelines/video/card-library/ — the ONE card catalogue, shared by the intro
// and the body (owner decision 2026-08-23, decisions.md). Three levels up from
// lib/intro-kit/ (lib -> visuals-flow -> video), then into card-library/ —
// the same sibling-folder pattern lib/render.mjs uses to reach it.
//
// This replaces pipelines/video/intro-kit/, plan 219's private 7-card kit,
// deleted by plan 229. The intro no longer has a card set of its own: it picks
// from the same catalogue the cue pass picks from, and a card added for the
// body is available to the intro the moment it lands in catalog.json.
export const CARD_LIBRARY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', 'card-library');

export function loadCatalog({ root = CARD_LIBRARY_ROOT } = {}) {
  return JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
}

// The flat per-card view the cut-list lint needs: which slugs exist, which are
// overlays, and which variables each one takes. DERIVED from catalog.json on
// every call rather than stored anywhere, so the intro can never drift from
// the body catalogue — that drift is the whole reason kit.json was retired.
//
// `duration` is deliberately EXCLUDED from `optional` even on the four cards
// whose catalog entry declares it: render-simple.mjs computes it from the
// beat's own length and injects it, so a cut list carrying one would be
// silently overwritten. S4's renderer-owned-var rule says so out loud.
const RENDERER_OWNED_VARS = new Set(['duration']);

export function loadKit({ root = CARD_LIBRARY_ROOT } = {}) {
  const catalog = loadCatalog({ root });
  const cards = (catalog.cards ?? []).map((c) => {
    const specs = Object.entries(c.variables ?? {});
    const required = specs.filter(([k, s]) => s?.required && !RENDERER_OWNED_VARS.has(k)).map(([k]) => k);
    const optional = specs.filter(([k, s]) => !s?.required && !RENDERER_OWNED_VARS.has(k)).map(([k]) => k);
    // A beat card carries its on-screen words in `beats`. In the body pipeline
    // that array lives beside the variables on the cue and the resolver merges
    // it in; in a cut list the authoring step writes it straight into `vars`.
    // It is OPTIONAL, never required — a beat card used as a still plate for
    // two seconds is a legitimate intro beat.
    const isBeatCard = c.beat_source === 'beat' || c.kind === 'beat' || c.kind === 'word-sync';
    if (isBeatCard) optional.push('beats');
    return {
      slug: c.slug,
      overlay: c.placement === 'overlay',
      required,
      optional,
      beatShape: isBeatCard ? (c.beat_shape ?? {}) : null,
      maxBeats: Number.isFinite(c.max_beats) ? c.max_beats : null,
      defaultDuration: Number.isFinite(c.default_duration) ? c.default_duration : null,
    };
  });
  return { cards };
}

// transcript.json is a flat ARRAY of {text,start,end} words, not an object.
// This is the entry point SIMPLE-PASS.md tells the authoring model to use for
// every on-screen word — never type a word from memory, S7 exists to catch
// exactly that (the standalone intro POC put 4 of 5 product names wrong).
export function introWords(workdir) {
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  if (!Array.isArray(words)) throw new Error('transcript.json must be an array of words');
  const span = introSpan(workdir);
  if (!span) throw new Error('introSpan(workdir) returned null — run `run.sh <slug> segments` first');
  return words.filter((w) => w.start >= span.start && w.end <= span.end);
}

export function loadCutlist(workdir) {
  const p = path.join(workdir, 'intro-simple', 'cutlist.json');
  if (!fs.existsSync(p)) throw new Error(`missing ${p} — author the simple intro first`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
