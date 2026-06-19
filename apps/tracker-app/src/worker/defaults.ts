// ===========================================================================
// ASSIGNMENT DEFAULTS — admin-configured default people per (category,
// subcategory) combination. Stored in D1 (`assignment_defaults`), independent of
// the card DATA_BACKEND (TRACKER_DB is always bound). When a card is created — or
// "Apply defaults" is clicked — blank assignee/reviewer fields are filled from the
// matching set: the exact (category, subcategory) combination wins; otherwise the
// category-level default (subcategory = '') applies.
// ===========================================================================

export interface DefaultRow { category: string; subcategory: string; col: string; email: string; }

const norm = (s: string) => (s ?? "").trim();

/** All configured default rows (for the Team-tab editor). */
export async function loadDefaults(db: D1Database): Promise<DefaultRow[]> {
  const { results } = await db
    .prepare(`SELECT category, subcategory, col, email FROM assignment_defaults ORDER BY category, subcategory, col`)
    .all<DefaultRow>();
  return results ?? [];
}

/** Replace the FULL default set for one (category, subcategory) scope.
 *  `subcategory = ''` means "applies to the whole category". Empty emails drop the col. */
export async function setDefaults(db: D1Database, category: string, subcategory: string, assignments: Record<string, string>): Promise<void> {
  const cat = norm(category), sub = norm(subcategory);
  const stmts: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM assignment_defaults WHERE category = ? AND subcategory = ?`).bind(cat, sub),
  ];
  for (const [col, email] of Object.entries(assignments)) {
    const e = norm(email);
    if (!e) continue;
    stmts.push(db.prepare(`INSERT INTO assignment_defaults (category, subcategory, col, email) VALUES (?, ?, ?, ?)`).bind(cat, sub, col, e));
  }
  await db.batch(stmts);
}

export async function deleteDefaults(db: D1Database, category: string, subcategory: string): Promise<void> {
  await db.prepare(`DELETE FROM assignment_defaults WHERE category = ? AND subcategory = ?`).bind(norm(category), norm(subcategory)).run();
}

/** Merged defaults for a card's (category, subcategory): category-level (subcategory='')
 *  applied first, then the exact combination overrides. Returns col → email. */
export async function resolveDefaults(db: D1Database, category: string, subcategory: string): Promise<Record<string, string>> {
  const cat = norm(category), sub = norm(subcategory);
  if (!cat) return {};
  const { results } = await db
    .prepare(`SELECT subcategory, col, email FROM assignment_defaults WHERE category = ? AND (subcategory = '' OR subcategory = ?)`)
    .bind(cat, sub)
    .all<{ subcategory: string; col: string; email: string }>();
  const out: Record<string, string> = {};
  for (const r of results ?? []) if (r.subcategory === "") out[r.col] = r.email;          // category-level
  for (const r of results ?? []) if (sub !== "" && r.subcategory === sub) out[r.col] = r.email; // combo overrides
  return out;
}
