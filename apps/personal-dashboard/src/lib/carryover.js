// Carryover: roll incomplete past-due (non-recurring) todos forward to today.
// Idempotent: records `carryover_last_run` in the app config row and skips
// if already run today.

import { todayISO } from './dates.js';
import { getConfig, updateConfig } from '../config.js';

/**
 * runCarryover(db, tz)
 *
 * Finds todos where:
 *   - done = 0
 *   - deadline is not null and < today (overdue)
 *   - recur_rule is null (recurring todos get their own next-instance logic)
 *
 * Sets deadline = today and carried_from = original deadline (if not already set).
 * Records today in carryover_last_run so subsequent calls in the same day are no-ops.
 */
export function runCarryover(db, tz) {
  const today = todayISO(tz);
  const cfg = getConfig();

  // Already ran today — skip.
  if (cfg.carryover_last_run === today) return;

  const rows = db
    .prepare(
      `SELECT id, deadline, carried_from
       FROM todos
       WHERE done = 0
         AND deadline IS NOT NULL
         AND deadline < ?
         AND recur_rule IS NULL`,
    )
    .all(today);

  const stmt = db.prepare(
    `UPDATE todos
     SET deadline = ?, carried_from = ?
     WHERE id = ?`,
  );

  const runAll = db.transaction(() => {
    for (const row of rows) {
      const originalDate = row.carried_from || String(row.deadline).slice(0, 10);
      stmt.run(today, originalDate, row.id);
    }
  });

  runAll();
  updateConfig({ carryover_last_run: today });
}
