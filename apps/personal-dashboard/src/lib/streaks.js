// Streak calculation and graph series for habits.
// "Soft model": missed scheduled days create a gap in history but don't wipe data.
// Current streak = consecutive SCHEDULED days (per habit.weekdays) that have a
// done=1 log, walking back from today. A missed scheduled day stops the current run.

import { todayISO, datesBetween, addDays } from './dates.js';

// Parse weekdays csv "0,1,3" → Set of numbers.
function parseWeekdays(weekdaysCsv) {
  return new Set(
    String(weekdaysCsv || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n)),
  );
}

// Is a YYYY-MM-DD string a scheduled day for this habit?
function isScheduled(ymd, weekdaySet) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  return weekdaySet.has(dow);
}

// Build a lookup: date → done (bool) from habit_logs rows.
function buildLogMap(logs) {
  const map = new Map();
  for (const log of logs) {
    map.set(log.date, log.done === 1 || log.done === true);
  }
  return map;
}

/**
 * currentStreak(habit, logs, tz) → number
 *
 * Walks back from today through all scheduled days. Counts consecutive days
 * that have a done log. Stops (and returns) at the first scheduled day that
 * is NOT done (missed). Unscheduled days are skipped silently.
 *
 * "Today" is included: if today is scheduled and already logged done, it
 * counts. If today is scheduled but not yet done, it does not break the
 * streak (we look at yesterday and earlier).
 */
export function currentStreak(habit, logs, tz) {
  const weekdays = parseWeekdays(habit.weekdays);
  const logMap = buildLogMap(logs);
  const today = todayISO(tz);

  let streak = 0;
  let cursor = today;

  // Walk backwards up to 2 years to avoid infinite loops.
  const limit = addDays(today, -730);

  while (cursor >= limit) {
    if (isScheduled(cursor, weekdays)) {
      const done = logMap.get(cursor) === true;
      if (cursor === today) {
        // Today: if done, count it. If not done yet, skip (don't break streak).
        if (done) streak += 1;
        // Either way, continue to yesterday.
      } else {
        if (!done) break; // Missed scheduled day — streak ends.
        streak += 1;
      }
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/**
 * recentConsistency(habit, logs, tz, days=14) → {scheduled, done, ratio, inconsistent}
 *
 * Looks at the last `days` days. Counts scheduled days and how many were done.
 * `inconsistent` = there were enough scheduled days to judge (>=3) and fewer
 * than half were completed. Used to flag habits you keep missing.
 */
export function recentConsistency(habit, logs, tz, days = 14) {
  const weekdays = parseWeekdays(habit.weekdays);
  const logMap = buildLogMap(logs);
  const today = todayISO(tz);
  const windowStart = addDays(today, -(days - 1));
  // Never judge days before the habit existed (start_date for fixed, else created_at).
  const habitStart = habit.start_date || (habit.created_at ? String(habit.created_at).slice(0, 10) : windowStart);
  const start = habitStart > windowStart ? habitStart : windowStart;
  let scheduled = 0;
  let done = 0;
  for (const date of datesBetween(start, today)) {
    if (!isScheduled(date, weekdays)) continue;
    // Don't penalize today if it's not done yet — only judge past days + done-today.
    if (date === today && logMap.get(date) !== true) continue;
    scheduled += 1;
    if (logMap.get(date) === true) done += 1;
  }
  const ratio = scheduled > 0 ? done / scheduled : 1;
  return { scheduled, done, ratio, inconsistent: scheduled >= 3 && ratio < 0.5 };
}

/**
 * graphSeries(habit, logs, tz, days=30) → [{date, scheduled, done}]
 *
 * Returns an entry per calendar day for the past `days` days (inclusive today).
 * Used by Chart.js to render the completion graph.
 */
export function graphSeries(habit, logs, tz, days = 30) {
  const weekdays = parseWeekdays(habit.weekdays);
  const logMap = buildLogMap(logs);
  const today = todayISO(tz);
  const start = addDays(today, -(days - 1));
  const dates = datesBetween(start, today);

  return dates.map((date) => ({
    date,
    scheduled: isScheduled(date, weekdays),
    done: logMap.get(date) === true,
  }));
}
