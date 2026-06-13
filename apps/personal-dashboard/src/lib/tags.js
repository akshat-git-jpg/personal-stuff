/**
 * Tags helpers.
 *
 * Tags are stored as comma-separated lowercase slugs, e.g. "work,bank,health".
 * Empty string means no tags.
 */

/**
 * normalizeTags(input) → clean comma-separated string of unique lowercase tags.
 * Accepts a string ("Work, Bank") or an array.
 * Keeps chars [a-z0-9-]; spaces within a token become hyphens. Drops empties.
 */
export function normalizeTags(input) {
  if (!input) return '';
  const raw = Array.isArray(input) ? input.join(',') : String(input);
  const parts = raw
    .split(',')
    .map((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')       // spaces → hyphens
        .replace(/[^a-z0-9-]/g, '') // drop non-slug chars
        .replace(/-+/g, '-')        // collapse repeated hyphens
        .replace(/^-|-$/g, ''),     // trim leading/trailing hyphens
    )
    .filter(Boolean);

  // Deduplicate while preserving order of first occurrence.
  const seen = new Set();
  const unique = [];
  for (const t of parts) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  return unique.join(',');
}

/**
 * getAllTags(db) → sorted array of distinct tags used across all four tables.
 */
export function getAllTags(db) {
  const tables = ['todos', 'habits', 'remembers', 'notes'];
  const tagSet = new Set();

  for (const table of tables) {
    const rows = db.prepare(`SELECT tags FROM ${table} WHERE tags != ''`).all();
    for (const row of rows) {
      for (const t of row.tags.split(',')) {
        const s = t.trim();
        if (s) tagSet.add(s);
      }
    }
  }

  return [...tagSet].sort();
}
