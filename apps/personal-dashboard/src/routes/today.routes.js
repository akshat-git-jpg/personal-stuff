import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { getTimezone } from '../config.js';
import { todayISO, weekdayInTz, isOverdue } from '../lib/dates.js';
import { currentStreak, recentConsistency } from '../lib/streaks.js';

// A to-do is "stale" if it's been open and untouched for STALE_DAYS+ days.
const STALE_DAYS = 4;
function daysSince(iso, today) {
  if (!iso) return 0;
  const a = Date.parse(String(iso).slice(0, 10));
  const b = Date.parse(today);
  return Math.max(0, Math.round((b - a) / 86400000));
}
import { getTodayEvents } from '../lib/googleCalendar.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const tz = getTimezone();

  // No carryover: overdue and no-deadline todos already surface here every day,
  // and keeping their original deadline is what lets us flag them as "slipping".
  const today = todayISO(tz);
  const todayWeekday = weekdayInTz(tz); // 0=Sun..6=Sat

  // Random remember.
  const remember = db.prepare('SELECT * FROM remembers WHERE active = 1 ORDER BY RANDOM() LIMIT 1').get() || null;

  // Top 3 todos (starred, not done).
  const top3 = db.prepare('SELECT * FROM todos WHERE is_top3 = 1 AND done = 0 ORDER BY deadline ASC LIMIT 3').all();

  // Calendar events for today.
  let calendarEvents = [];
  try {
    calendarEvents = await getTodayEvents(tz);
  } catch {
    calendarEvents = [];
  }

  // Todos to show on Today: due today/overdue, PLUS no-deadline todos (which
  // surface every day until done). Dated ones first, then the date-less ones.
  const todosDue = db
    .prepare(
      `SELECT * FROM todos
       WHERE done = 0 AND (deadline IS NULL OR deadline <= @today)
       ORDER BY (deadline IS NULL), deadline ASC`,
    )
    .all({ today })
    .map((t) => {
      const overdue = isOverdue(t.deadline, tz);
      const age = daysSince(t.created_at, today);
      const stale = !overdue && age >= STALE_DAYS; // pending a long while
      return { ...t, slipping: overdue, stale, age_days: age };
    });

  // Habits scheduled for today's weekday (not archived).
  const allHabits = db.prepare('SELECT * FROM habits WHERE archived = 0').all();
  const habitsToday = allHabits
    .filter((h) => {
      const days = String(h.weekdays)
        .split(',')
        .map((s) => parseInt(s.trim(), 10));
      return days.includes(todayWeekday);
    })
    .map((h) => {
      const logs = db.prepare('SELECT * FROM habit_logs WHERE habit_id = ?').all(h.id);
      const streak = currentStreak(h, logs, tz);
      const cons = recentConsistency(h, logs, tz);
      const doneLog = db
        .prepare('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ? AND done = 1')
        .get(h.id, today);
      return { ...h, current_streak: streak, done_today: !!doneLog, inconsistent: cons.inconsistent };
    });

  // Count of items done today.
  const doneTodayCount = db
    .prepare(`SELECT COUNT(*) as c FROM todos WHERE done = 1 AND completed_at >= ?`)
    .get(`${today}T00:00:00`).c;

  res.json({
    remember,
    top3,
    calendarEvents,
    todosDue,
    habitsToday,
    doneTodayCount,
  });
});

export default router;
