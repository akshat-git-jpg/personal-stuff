// Two questions the Storyboard has to answer about every card, both of which
// it used to get wrong:
//
//   1. Does this card EXIST yet? The Card Plan tab was the only place that said
//      so, and plan 195 deleted the tab without moving the marker — so a card
//      nobody has built looked exactly like one that ships today, on the very
//      screen where the owner decides whether to build it.
//   2. Is this card OVER its repetition cap? The chip used a flat `n > 3` with
//      no idea what the linter caps, which lit up 14 lower-thirds, 13
//      tip-banners, 8 structural section cards and 5 score pills in red on a
//      plan the linter passed with zero errors.
//
// Both live here as pure functions so they can be tested — the marker vanished
// once already and nothing caught it.

export interface PlanItem {
  id: string;
  card: string | null;
  status?: string;
  placement?: string | null;
  structural?: boolean;
  proposal?: unknown;
}

export interface CardMeta {
  placement: string | null;
  structural: boolean;
  isNew: boolean;
}

export interface PlanIndex {
  byId: Record<string, PlanItem>;
  byCard: Map<string, CardMeta>;
  newCards: string[];
}

export function buildPlanIndex(cardPlan: { sections?: { items?: PlanItem[] }[] } | null | undefined): PlanIndex {
  const byId: Record<string, PlanItem> = {};
  const byCard = new Map<string, CardMeta>();
  for (const sec of cardPlan?.sections ?? []) {
    for (const it of sec.items ?? []) {
      if (it?.id) byId[it.id] = it;
      if (it?.card) {
        byCard.set(it.card, {
          placement: it.placement ?? null,
          structural: it.structural === true,
          isNew: it.status === 'new',
        });
      }
    }
  }
  const newCards = [...byCard.entries()].filter(([, m]) => m.isNew).map(([c]) => c);
  return { byId, byCard, newCards };
}

// Mirrors the linter, and ONLY the linter: E3 caps non-structural fullframe
// cards at 3; E2 caps overlay/stat-hit at 3. Overlays and structural section
// cards carry no cap, so repetition there is not a finding.
export const CAP = 3;

export function isOverCap(card: string, n: number, byCard: Map<string, CardMeta>): boolean {
  if (card === 'overlay/stat-hit') return n > CAP;
  const m = byCard.get(card);
  if (!m) return false; // no card plan yet — say nothing rather than guess
  return m.placement === 'fullframe' && !m.structural && n > CAP;
}

export function isNewCard(card: string, byCard: Map<string, CardMeta>): boolean {
  return byCard.get(card)?.isNew === true;
}
