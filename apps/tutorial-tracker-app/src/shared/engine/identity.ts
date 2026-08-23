// ===========================================================================
// IDENTITY — catching two accounts for one human.
//
// Email is the primary key for a person, so a single mistyped letter creates a
// SECOND person who looks identical in every list. That is not a cosmetic
// problem: their work splits in two. Half the videos answer to one address and
// half to the other, each account sees only its own half, and the board shows
// the same name twice with different roles — which reads as a bug in the
// system rather than a typo in an address.
//
// Nothing warned about it, so this module is the warning. It never decides; it
// reports why two records look like one person and lets the admin confirm.
// ===========================================================================

export interface Person { name: string; email: string; }

export type DuplicateReason = "same-address" | "typo" | "same-name";

export interface DuplicateMatch {
  /** The existing person this candidate collides with. */
  person: Person;
  reason: DuplicateReason;
  /** Plain-language explanation, shown as-is to the admin. */
  detail: string;
}

const clean = (s: string) => (s || "").trim().toLowerCase();

/** The address a mail provider actually delivers to.
 *  Gmail ignores dots and anything after a "+", so three spellings of one
 *  inbox can occupy three rows here while being one human. */
export function canonicalEmail(email: string): string {
  const e = clean(email);
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Levenshtein distance, abandoned once it exceeds `cap` (cheap early exit). */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > cap) return cap + 1;
    prev = row;
  }
  return prev[b.length];
}

/** How many single-letter slips count as "probably the same address". Two lets
 *  a swapped pair through; three starts matching genuinely different names. */
const TYPO_LIMIT = 2;

/**
 * Existing people who are probably the SAME human as `candidate`.
 *
 * Ordered strongest first, so the caller can lead with the clearest reason.
 * An exact email match is NOT a duplicate — that is the same record being
 * edited, which is the normal way to add a role in another system.
 */
export function findDuplicates(candidate: Person, existing: Person[]): DuplicateMatch[] {
  const email = clean(candidate.email);
  const canon = canonicalEmail(candidate.email);
  const name = clean(candidate.name);
  const localOf = (e: string) => canonicalEmail(e).split("@")[0];
  const out: DuplicateMatch[] = [];

  for (const p of existing) {
    if (clean(p.email) === email) continue;   // the same record — editing, not duplicating

    if (canonicalEmail(p.email) === canon) {
      out.push({
        person: p, reason: "same-address",
        detail: `${p.email} is the same inbox — mail providers ignore dots and "+" tags.`,
      });
      continue;
    }

    const d = editDistance(localOf(candidate.email), localOf(p.email), TYPO_LIMIT + 1);
    if (d > 0 && d <= TYPO_LIMIT) {
      out.push({
        person: p, reason: "typo",
        detail: `${p.email} differs by ${d} character${d === 1 ? "" : "s"} — one of the two is probably a typo.`,
      });
      continue;
    }

    if (name && clean(p.name) === name) {
      out.push({
        person: p, reason: "same-name",
        detail: `${p.name} already exists on ${p.email}. Same person, or two people sharing a name?`,
      });
    }
  }

  const rank: Record<DuplicateReason, number> = { "same-address": 0, typo: 1, "same-name": 2 };
  return out.sort((a, b) => rank[a.reason] - rank[b.reason]);
}
