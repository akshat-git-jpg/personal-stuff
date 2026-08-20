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
    /* A side span must cover its host cue for the WHOLE cue, not merely overlap
       it. The renderer lays the card out at side width for its full duration —
       that decision is per-cue, it cannot change halfway — so any part of the
       cue the span does not reach renders as a reserved third with nothing in
       it. Owner, 2026-08-20, at 34:59: "why is Avatar missing on this black
       screen? Earlier, the avatar was clearly showing, but here it's not
       appearing."
       s15 ended at 2098.79 against a card running to 2100.85: two seconds of
       black band, and every gate passed, because nothing compared the two
       durations. The span's own note read "ends inside the card so the split
       never outlives the graphic" — the author had reasoned about one direction
       of the mismatch and not the other.
       0.05s of slack absorbs snapping; anything more is the defect. */
    const host = covering[0];
    const hostEnd = host.start + host.duration;
    if (span.start > host.start + 0.05 || span.end < hostEnd - 0.05) {
      throw new Error(
        `side span ${span.id} (${span.start.toFixed(2)}-${span.end.toFixed(2)}s) does not cover `
        + `all of ${host.id} (${host.start.toFixed(2)}-${hostEnd.toFixed(2)}s). The card renders at `
        + `side width for its full duration, so the uncovered part becomes a black band where the `
        + `presenter should be. Extend the span to the cue, or shorten the cue to the span.`);
    }
    ids.add(host.id);
  }
  return ids;
}
