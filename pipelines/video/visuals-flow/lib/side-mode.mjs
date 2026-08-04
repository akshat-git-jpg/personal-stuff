// Joins resolved cues to resolved shot spans so the renderer knows which
// fullframe cards must render at side width instead of full canvas. Cues
// resolve at step 040, shots resolve at step 060, so this join can only
// happen once both exist — render (step 090) is the first place that is true.

// Returns a Set of cue ids that a `side` avatar span covers.
export function sideModeCueIds(resolvedCues, shotSpans) {
  const ids = new Set();
  const fullframes = (resolvedCues ?? []).filter((c) => c.placement === 'fullframe');
  for (const span of shotSpans ?? []) {
    if (span.mode !== 'side') continue;
    const covering = fullframes.filter((c) => span.start < c.start + c.duration && c.start < span.end);
    if (covering.length === 0) {
      throw new Error(`side span ${span.id} covers zero fullframe cues — a side host needs a card to sit beside`);
    }
    if (covering.length > 1) {
      throw new Error(`side span ${span.id} covers multiple fullframe cues (${covering.map((c) => c.id).join(', ')}) — render cannot pick one`);
    }
    ids.add(covering[0].id);
  }
  return ids;
}
