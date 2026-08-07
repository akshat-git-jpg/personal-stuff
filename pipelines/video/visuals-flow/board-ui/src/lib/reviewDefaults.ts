// Cards that arrive on the Storyboard ALREADY ticked (owner 2026-08-07).
//
// These are the routine overlays — a lower-third, a stat pill, a tip banner.
// They are the same device every time, their copy is right there in the tile
// header, and there is nothing to judge frame by frame. Leaving 27 of them
// unticked buries the handful of cards that actually need a decision.
//
// ADD A CARD HERE and it defaults to reviewed everywhere; nothing else to
// change. Removing one puts it back in the queue.
//
// This is a DEFAULT, not a verdict. Unticking one is remembered per video (see
// reviewed.ts's opt-out set), so a card you deliberately reopened stays open
// across reloads.
export const AUTO_REVIEWED_CARDS: readonly string[] = [
  'overlay/lower-third',
  'overlay/stat-hit',
  'overlay/tip-banner',
];

export function isAutoReviewed(card: string | null | undefined, list: readonly string[] = AUTO_REVIEWED_CARDS): boolean {
  return !!card && list.includes(card);
}

// The single rule for "is this tile ticked", so the checkbox, the counter and
// the tile body can never disagree:
//   an explicit untick always wins → then an explicit tick → then the default.
export function effectiveReviewed(
  args: { rid: string; card?: string | null; reviewed: Set<string>; unreviewed: Set<string>; list?: readonly string[] },
): boolean {
  const { rid, card, reviewed, unreviewed, list } = args;
  if (unreviewed.has(rid)) return false;
  if (reviewed.has(rid)) return true;
  return isAutoReviewed(card, list ?? AUTO_REVIEWED_CARDS);
}
