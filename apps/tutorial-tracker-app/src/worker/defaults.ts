// ===========================================================================
// ASSIGNMENT DEFAULTS — admin-configured default people per (category,
// subcategory) combination. Stored in D1 (`assignment_defaults`), independent of
// the card DATA_BACKEND (TRACKER_DB is always bound). When a card is created — or
// "Apply defaults" is clicked — blank assignee/reviewer fields are filled from the
// matching set: the exact (category, subcategory) combination wins; otherwise the
// category-level default (subcategory = '') applies.
// ===========================================================================

export interface DefaultRow { pipeline_id: string; category: string; subcategory: string; col: string; email: string; }

const norm = (s: string) => (s ?? "").trim();

/** Configured default rows for ONE system (the Team-tab editor, per video type). */
export async function loadDefaults(db: D1Database, pipelineId: string): Promise<DefaultRow[]> {
  const { results } = await db
    .prepare(`SELECT pipeline_id, category, subcategory, col, email FROM assignment_defaults WHERE pipeline_id = ? ORDER BY category, subcategory, col`)
    .bind(norm(pipelineId))
    .all<DefaultRow>();
  return results ?? [];
}

/** Replace the FULL default set for one (system, category, subcategory) scope.
 *  `subcategory = ''` means "applies to the whole category". Empty emails drop the col. */
export async function setDefaults(db: D1Database, pipelineId: string, category: string, subcategory: string, assignments: Record<string, string>): Promise<void> {
  const pid = norm(pipelineId), cat = norm(category), sub = norm(subcategory);
  const stmts: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM assignment_defaults WHERE pipeline_id = ? AND category = ? AND subcategory = ?`).bind(pid, cat, sub),
  ];
  for (const [col, email] of Object.entries(assignments)) {
    const e = norm(email);
    if (!e) continue;
    stmts.push(db.prepare(`INSERT INTO assignment_defaults (pipeline_id, category, subcategory, col, email) VALUES (?, ?, ?, ?, ?)`).bind(pid, cat, sub, col, e));
  }
  await db.batch(stmts);
}

export async function deleteDefaults(db: D1Database, pipelineId: string, category: string, subcategory: string): Promise<void> {
  await db.prepare(`DELETE FROM assignment_defaults WHERE pipeline_id = ? AND category = ? AND subcategory = ?`)
    .bind(norm(pipelineId), norm(category), norm(subcategory)).run();
}

/** Merged defaults for a card's (system, category, subcategory): category-level
 *  (subcategory='') applied first, then the exact combination overrides. col → email. */
export async function resolveDefaults(db: D1Database, pipelineId: string, category: string, subcategory: string): Promise<Record<string, string>> {
  const pid = norm(pipelineId), cat = norm(category), sub = norm(subcategory);
  if (!cat) return {};
  const { results } = await db
    .prepare(`SELECT subcategory, col, email FROM assignment_defaults WHERE pipeline_id = ? AND category = ? AND (subcategory = '' OR subcategory = ?)`)
    .bind(pid, cat, sub)
    .all<{ subcategory: string; col: string; email: string }>();
  const out: Record<string, string> = {};
  for (const r of results ?? []) if (r.subcategory === "") out[r.col] = r.email;          // category-level
  for (const r of results ?? []) if (sub !== "" && r.subcategory === sub) out[r.col] = r.email; // combo overrides
  return out;
}
