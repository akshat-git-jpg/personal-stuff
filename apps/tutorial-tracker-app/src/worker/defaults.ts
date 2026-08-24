// ===========================================================================
// ASSIGNMENT DEFAULTS — the default person for each role, per SYSTEM.
//
// This used to be keyed by (category, subcategory) as well, with a precedence
// rule: the exact combination won, otherwise the category-level set applied.
// Categories are gone (nobody filled them in), so a system now has exactly ONE
// default set: pick Standard or Tut 2, say who does each role, done.
//
// Rows are still stored in `assignment_defaults`, whose category/subcategory
// columns remain in the schema — no migration needed, and nothing reads them.
// New writes leave them blank. Rows written under the old model are COLLAPSED on
// read: for each column the first row wins (see `collapse`). The Team panel then
// shows that single resulting set, so a wrong pick is visible and one edit fixes
// it for good.
// ===========================================================================

export interface DefaultRow { pipeline_id: string; col: string; email: string; }

const norm = (s: string) => (s ?? "").trim();

/** One row per column. Deterministic: the query orders by category, subcategory,
 *  col, so "first wins" is stable rather than whatever the DB felt like. */
function collapse(rows: { col: string; email: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const col = norm(r.col), email = norm(r.email);
    if (!col || !email) continue;
    if (!out.has(col)) out.set(col, email);
  }
  return out;
}

/** The default set for ONE system — at most one row per column. */
export async function loadDefaults(db: D1Database, pipelineId: string): Promise<DefaultRow[]> {
  const pid = norm(pipelineId);
  const { results } = await db
    .prepare(`SELECT col, email FROM assignment_defaults WHERE pipeline_id = ? ORDER BY category, subcategory, col`)
    .bind(pid)
    .all<{ col: string; email: string }>();
  return [...collapse(results ?? [])].map(([col, email]) => ({ pipeline_id: pid, col, email }));
}

/** Replace the FULL default set for one system. Empty emails drop the column. */
export async function setDefaults(db: D1Database, pipelineId: string, assignments: Record<string, string>): Promise<void> {
  const pid = norm(pipelineId);
  const stmts: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM assignment_defaults WHERE pipeline_id = ?`).bind(pid),
  ];
  for (const [col, email] of Object.entries(assignments)) {
    const e = norm(email);
    if (!e) continue;
    // category/subcategory stay in the table but are no longer part of the key.
    stmts.push(db.prepare(`INSERT INTO assignment_defaults (pipeline_id, category, subcategory, col, email) VALUES (?, '', '', ?, ?)`).bind(pid, col, e));
  }
  await db.batch(stmts);
}

/** Clear a system's defaults entirely. */
export async function deleteDefaults(db: D1Database, pipelineId: string): Promise<void> {
  await db.prepare(`DELETE FROM assignment_defaults WHERE pipeline_id = ?`).bind(norm(pipelineId)).run();
}

/** col → email for a new card in this system. */
export async function resolveDefaults(db: D1Database, pipelineId: string): Promise<Record<string, string>> {
  return Object.fromEntries(collapse((await loadDefaults(db, norm(pipelineId))).map((r) => ({ col: r.col, email: r.email }))));
}
