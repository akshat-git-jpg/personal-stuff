/**
 * lanes.js — side-by-side column packing for overlapping blocks.
 *
 * The first cut of Dayboard drew every block at the same left edge, so two events
 * that genuinely overlap simply covered each other. On the owner's real calendar
 * that is not an edge case: he keeps a "plan" layer (Health / Work / Daily chores /
 * Buffer) alongside a "detail" layer (the primary calendar), and the two are offset
 * by an hour or more, so a normal day has six or seven real collisions.
 *
 * So: cluster blocks into groups of transitively-overlapping events, and inside each
 * group give every block the leftmost column that is free at its start time. A group
 * of one keeps the full width — one busy hour must never shrink the whole day.
 *
 * Loaded as a plain script (the app has no build step); the IIFE also hands itself to
 * `globalThis` so the vitest suite can import this exact file.
 */
(function (root) {
  'use strict';

  /** Half-open, matching the Worker: events that merely touch do NOT overlap. */
  function overlaps(a, b) {
    return a.startMin < b.endMin && b.startMin < a.endMin;
  }

  /**
   * Returns a copy of each block with `lane` (0-based column) and `lanes` (how many
   * columns its group needs). Input order does not matter.
   */
  function assignLanes(blocks) {
    const sorted = [...blocks].sort(
      (a, b) =>
        a.startMin - b.startMin ||
        b.endMin - a.endMin ||
        String(a.id).localeCompare(String(b.id)),
    );

    const out = [];
    let group = [];
    let groupEnd = -1;

    function flush() {
      if (group.length === 0) return;
      // laneEnds[i] = when the last block placed in column i finishes.
      const laneEnds = [];
      for (const item of group) {
        let lane = laneEnds.findIndex((end) => end <= item.startMin);
        if (lane === -1) {
          lane = laneEnds.length;
          laneEnds.push(0);
        }
        laneEnds[lane] = item.endMin;
        item.lane = lane;
      }
      for (const item of group) item.lanes = laneEnds.length;
      out.push(...group);
      group = [];
      groupEnd = -1;
    }

    for (const b of sorted) {
      // A block that starts at or after everything so far begins a fresh group.
      if (group.length > 0 && b.startMin >= groupEnd) flush();
      group.push({ ...b });
      groupEnd = Math.max(groupEnd, b.endMin);
    }
    flush();

    return out;
  }

  root.assignLanes = assignLanes;
  root.lanesOverlap = overlaps;
})(typeof globalThis !== 'undefined' ? globalThis : this);
