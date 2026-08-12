import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { ZONE_PARTS } from './zone-constants.mjs';
import { pathToFileURL } from 'node:url';

// The whole video's card plan gets approved in one place, before anything is
// built or rendered (owner 2026-07-30). This replaces the zone-only 070 gate:
// the build-vs-reuse call is the same call for a body card and an intro card,
// and splitting it across two gates meant the body half was never made at all.
//
// It reads cues.json, NOT resolved.json. That is the whole point. A cue naming
// a card that does not exist yet cannot appear in resolved.json — resolve
// refuses unknown cards and writes nothing — so the old zone plan could only
// ever report `new` for a card that had already been hand-built, and its
// "NEW — to build" chip was dead for the case it existed to serve.
export const PLAN_PARTS = ['intro', 'body', 'conclusion'];

// Which section a cue belongs to. Zone passes (035) stamp a `zone` field;
// the body pass (030) does not. No times exist at this stage, so the cue's own
// declaration is the only signal — W19 cross-checks it against the measured
// span later, once resolve has run.
export function partOf(cue, workdir) {
  const zone = cue?.zone;
  const validZones = ZONE_PARTS;
  return validZones.includes(zone) ? zone : 'body';
}

// A proposed card carries a structured spec (`propose`). Older cues put a
// one-line note in `fix`, which the audit also uses for its own purposes —
// accept it as a fallback so a pre-2026-07-30 workdir still renders a plan.
function proposalOf(cue) {
  if (cue?.propose && typeof cue.propose === 'object') return cue.propose;
  if (typeof cue?.fix === 'string' && cue.fix.trim()) return { does: cue.fix.trim() };
  return null;
}

// The 037 gate used to hold this invariant: any change to the plan invalidated
// the owner's approval, so a card that landed AFTER approval could not reach
// render unseen (steps/038's summary states it outright). Plan 195 deleted that
// gate, so the reset moves to the gate that survives — the 080 storyboard.
// Deleting the reset instead of moving it is the silent-failure case: a card
// gets built, lands, and renders with nobody ever having looked at it.
export function resetStoryboardApproval(workdir, reason) {
  const touched = [];
  for (const name of ['cues.json', 'shots.json']) {
    const p = path.join(workdir, name);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data.approved !== true) continue;
    data.approved = false;
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    touched.push(name);
  }
  if (touched.length) {
    console.error(`storyboard approval reset (${touched.join(', ')}): ${reason}`);
  }
  return touched;
}

export function buildCardPlan({ workdir, structure, cues, catalogCards }) {
  const bySlug = new Map((catalogCards ?? []).map((c) => [c.slug, c]));
  const activeZones = ZONE_PARTS;
  const activePlanParts = PLAN_PARTS.filter((p) => p === 'body' || activeZones.includes(p));
  const byPart = new Map(activePlanParts.map((p) => [p, []]));

  for (const cue of cues ?? []) {
    const cat = bySlug.get(cue.card);
    const part = partOf(cue, workdir);
    if (!byPart.has(part)) continue;
    byPart.get(part).push({
      id: cue.id,
      card: cue.card ?? null,
      status: cat ? 'existing' : 'new',
      // Cues rarely declare placement — it is a property of the card, and the
      // resolver reads it from the catalog. Fullframe-vs-overlay is one of the
      // things the owner is judging here, so fall back to the catalog rather
      // than showing a shrug. A proposed card carries it on `propose`.
      placement: cue.placement ?? cat?.placement ?? cue.propose?.placement ?? null,
      // Carried so the board can tell a card that is ACTUALLY over its
      // repetition cap from one that simply appears a lot. E3 caps only
      // non-structural fullframe cards, so without this the overview flagged
      // every overlay and every section card as "hot" the moment it passed 3 —
      // 14 lower-thirds and 8 section cards lit up red while the linter
      // reported zero errors.
      structural: cat?.structural === true,
      // Anchors, not timestamps — this gate runs before resolve puts the plan
      // on a clock, and "which clause does this card land on" is the question
      // being asked here anyway.
      anchor: cue.anchor ?? null,
      flagged: cue.flagged === true,
      proposal: proposalOf(cue),
    });
  }

  return activePlanParts.map((part) => {
    const span = (structure ?? []).find((s) => s.part === part);
    return {
      part,
      ...(span ? { start: span.start, end: span.end } : {}),
      items: byPart.get(part),
    };
  }).filter((s) => s.items.length > 0);
}

// Feedback given AT the 037 gate. Until 2026-07-29 the (then zone-only) gate
// was binary — it carried `approved: true|false` and nothing else — so
// rejecting a proposed card recorded no reason anywhere and the same card came
// back on the next video.
//
// The key encodes which rulebook owns the lesson, because that routing is the
// owner's explicit instruction (2026-07-29): intro and conclusion have their
// own rules, guidelines and execution, and a zone lesson must never edit the
// body's rulebook or the reverse.
//   intro/conclusion -> `zone-<part>:<n>` -> steps/035-.../RULEBOOK.md
//   body             -> `card-body:<n>`   -> steps/030-.../RULEBOOK.md
// Both are distinct from the storyboard's cue-keyed items (`c05`) and the
// Final Cut's `final-*` ones, so feedback-status counts them without collision.
export function feedbackKeyPrefix(part) {
  return part === 'body' ? 'card-body:' : `zone-${part}:`;
}

export function appendCardPlanFeedback(fb, part, item) {
  if (!PLAN_PARTS.includes(part)) throw new Error(`unknown plan part: ${part}`);
  const out = { ...(fb ?? {}) };
  out.items = { ...(out.items ?? {}) };
  const prefix = feedbackKeyPrefix(part);
  const next = Object.keys(out.items)
    .filter((k) => k.startsWith(prefix))
    .reduce((max, k) => Math.max(max, parseInt(k.slice(prefix.length), 10) || 0), 0) + 1;
  out.items[`${prefix}${next}`] = {
    ...(part === 'body' ? { part: 'body' } : { zone: part }),
    text: String(item?.text ?? '').trim(),
    added: new Date().toISOString().slice(0, 10),
    ...(item?.cue ? { context: { cue: item.cue, card: item.card ?? null } } : {}),
  };
  out.updated = new Date().toISOString().slice(0, 10);
  return out;
}

export function summarize(sections) {
  const items = sections.flatMap((s) => s.items);
  return {
    cues: items.length,
    existing: items.filter((i) => i.status === 'existing').length,
    toBuild: items.filter((i) => i.status === 'new').length,
    flagged: items.filter((i) => i.flagged).length,
  };
}

// The text view the owner scans before opening the board. Reads only what the
// plan already holds — no new state to keep in sync.
export function renderOutline(sections) {
  const lines = [];
  for (const s of sections) {
    const span = s.start != null ? `  ${fmt(s.start)}–${fmt(s.end)}` : '';
    lines.push(`${s.part.toUpperCase()}${span}   ${s.items.length} cues`);
    for (const i of s.items) {
      const mark = i.status === 'new' ? 'NEW ' : '    ';
      const flag = i.flagged ? ' [FLAGGED]' : '';
      const place = (i.placement ?? '?').padEnd(11);
      lines.push(`  ${mark}${i.id}  ${place}${i.card ?? '(none)'}${flag}`);
      if (i.anchor) lines.push(`          @ "${i.anchor}"`);
      if (i.proposal?.does) lines.push(`          → ${i.proposal.does}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function fmt(t) {
  const s = Math.max(0, Math.round(t ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function main() {
  const arg = process.argv[2];
  if (!arg) { console.error('usage: node lib/card-plan.mjs <slug-or-path> [--outline]'); process.exit(1); }
  const workdir = resolveWorkdir(arg);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(workdir, f), 'utf8'));

  // `structure` is optional: it only labels the zone spans in the printout. A
  // video with no measured zones still has a body card plan to approve, and
  // the old zone-only gate hard-erroring here is why one never got made.
  let structure = null;
  const segPath = path.join(workdir, 'segments.json');
  if (fs.existsSync(segPath)) structure = JSON.parse(fs.readFileSync(segPath, 'utf8')).structure ?? null;

  const cuesFile = read('cues.json');
  const catalogPath = path.resolve(import.meta.dirname, '..', '..', 'card-library', 'catalog.json');
  const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const catalogCards = cat.cards ?? cat;

  const sections = buildCardPlan({ workdir, structure, cues: cuesFile.cues, catalogCards });

  const outPath = path.join(workdir, 'card-plan.json');
  const prev = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  const changed = JSON.stringify(prev.sections ?? null) !== JSON.stringify(sections);
  const out = {
    video: path.basename(workdir),
    sections,
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  if (changed) resetStoryboardApproval(workdir, 'the card plan changed — re-approve the storyboard');

  if (process.argv.includes('--outline')) console.log(renderOutline(sections));
  const s = summarize(sections);
  console.log(`card plan: ${s.cues} cues across ${sections.length} section${sections.length === 1 ? '' : 's'} — ${s.existing} existing, ${s.toBuild} to build, ${s.flagged} flagged`);
  console.log(`card plan -> ${outPath}${changed ? '  (storyboard approval reset)' : ''}`);
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
