/**
 * slug.ts
 * Deterministic video slug from a title. Pure, no deps, no API call.
 * Minted ONCE at card creation and frozen — see
 * docs/specs/2026-08-25-video-identity-design.md.
 *
 * NOT the same as worker/affiliate.ts normalizeToolName (tool names have no
 * stop-word removal and no length cap).
 */

const STOP = new Set([
  "a","an","the","and","or","but","so","to","of","for","from",
  "you","your","i","me","my","we","our","it","its",
  "is","are","was","be","been","this","that","these","those",
  "have","has","had","do","does","did","dont","wont","cant",
  "will","just","very","really",
]);

const MAX = 40;

/** Deterministic slug, or "" when the title has no usable characters. */
export function slugify(title: string): string {
  let s = title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/['\u2019]/g, "")                          // don't -> dont, not don-t
    .replace(/[^a-z0-9]+/g, "-")                        // everything else -> dash
    .replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (s.length > MAX) {
    // A word containing a digit is never dropped: 2026, 7, v2 carry meaning.
    s = s.split("-").filter((w) => /\d/.test(w) || !STOP.has(w)).join("-");
  }
  if (s.length > MAX) {
    const cut = s.lastIndexOf("-", MAX);
    s = cut > 0 ? s.slice(0, cut) : s.slice(0, MAX);
  }
  return s;
}

/**
 * The slug actually stored on a card: unique, and never empty.
 * `taken` is every slug already in use.
 */
export function mintSlug(title: string, taken: Set<string>, cardId: string): string {
  const base = slugify(title) || `video-${cardId}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
