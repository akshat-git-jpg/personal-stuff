// Recurrence logic: given a completed recurring todo, compute the next instance.
// recur_rule values: "daily" | "weekly" | "monthly" | "every:N" (N days).

import { addDays, addMonths, todayISO } from './dates.js';

/**
 * nextInstance(todo, tz) → object | null
 *
 * Returns field values for the next todo to INSERT (everything except id/created_at).
 * Uses the todo's deadline as the base for the next occurrence. Falls back to
 * today if deadline is null.
 *
 * Returns null if recur_rule is falsy.
 */
export function nextInstance(todo, tz) {
  if (!todo.recur_rule) return null;

  const rule = todo.recur_rule.trim().toLowerCase();
  const base = todo.deadline ? String(todo.deadline).slice(0, 10) : todayISO(tz || 'UTC');

  let nextDeadline;

  if (rule === 'daily') {
    nextDeadline = addDays(base, 1);
  } else if (rule === 'weekly') {
    nextDeadline = addDays(base, 7);
  } else if (rule === 'monthly') {
    nextDeadline = addMonths(base, 1);
  } else if (rule.startsWith('every:')) {
    const n = parseInt(rule.slice(6), 10);
    if (!isNaN(n) && n > 0) {
      nextDeadline = addDays(base, n);
    }
  }

  if (!nextDeadline) return null;

  return {
    title: todo.title,
    notes: todo.notes || null,
    deadline: nextDeadline,
    time_start: todo.time_start || null,
    time_end: todo.time_end || null,
    area: todo.area || null,
    priority: todo.priority || null,
    is_top3: 0,
    done: 0,
    completed_at: null,
    recur_rule: todo.recur_rule,
    carried_from: null,
    created_at: new Date().toISOString(),
  };
}
