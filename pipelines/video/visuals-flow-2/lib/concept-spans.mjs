import fs from 'node:fs';
import path from 'node:path';
import { findPhrase, normWord } from './resolve.mjs';

// Register spans drive the whip-reg transitions in lib/effects/whip.mjs.
//
// This lived inline in effects-plan.mjs only. assemble.mjs built its own ctx
// WITHOUT conceptSpans, so it re-planned the effect list, found no whip-reg-*
// entries, and discarded the ones effects.json had asked for — printing
// "ignoring effects.json instance with unknown id: whip-reg-30.7". Every
// register transition was planned and then silently dropped, on every video
// (found 2026-07-25 on test-03; previously misread as a stale leftover).
// Shared here so the two callers cannot drift apart again.
export function loadConceptSpans(workdir, words) {
  const conceptPath = path.join(workdir, 'concept.json');
  if (!fs.existsSync(conceptPath)) return [];

  const conceptData = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);

  const spans = [];
  let cursor = 0;
  for (const reg of conceptData.registers || []) {
    const from = findPhrase(W, reg.from_anchor, cursor);
    if (from.err) continue;
    const to = findPhrase(W, reg.to_anchor, from.idx);
    if (to.err) continue;
    spans.push({ register: reg.register, start: from.start, end: to.start + 1.0 });
    cursor = to.idx + to.len;
  }
  return spans;
}
