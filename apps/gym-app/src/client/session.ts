import type { LogEntry } from "../shared";

export interface SessionExercise {
  exerciseId: string;
  exercise: string;
  muscleGroup: string;
  sets: LogEntry[]; // ordered by set number / time
  firstAt: number; // ms of first set (defines order in the session)
  topWeight: number;
}

export interface Session {
  day: string; // YYYY-MM-DD
  start: string; // ISO of first set
  end: string; // ISO of last set
  durationMin: number;
  setCount: number;
  exercises: SessionExercise[]; // in the order performed
}

export const dayKey = (iso: string) => iso.slice(0, 10);
export const todayKey = () => new Date().toISOString().slice(0, 10);

/** Group the flat log into per-day sessions, ordered most-recent-day first.
 *  Within a day, exercises are ordered by when they were first logged. */
export function buildSessions(log: LogEntry[]): Session[] {
  const byDay = new Map<string, LogEntry[]>();
  for (const e of log) {
    if (!e.date) continue;
    const k = dayKey(e.date);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }

  const sessions: Session[] = [];
  for (const [day, entries] of byDay) {
    const times = entries.map((e) => +new Date(e.date));
    const start = Math.min(...times);
    const end = Math.max(...times);

    const byEx = new Map<string, SessionExercise>();
    for (const e of entries) {
      let ex = byEx.get(e.exerciseId);
      if (!ex) {
        ex = {
          exerciseId: e.exerciseId,
          exercise: e.exercise,
          muscleGroup: e.muscleGroup,
          sets: [],
          firstAt: +new Date(e.date),
          topWeight: 0,
        };
        byEx.set(e.exerciseId, ex);
      }
      ex.sets.push(e);
      ex.firstAt = Math.min(ex.firstAt, +new Date(e.date));
      ex.topWeight = Math.max(ex.topWeight, e.weight);
    }

    const exercises = [...byEx.values()].sort((a, b) => a.firstAt - b.firstAt);
    for (const ex of exercises) {
      ex.sets.sort((a, b) => a.setNo - b.setNo || (a.date < b.date ? -1 : 1));
    }

    sessions.push({
      day,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      durationMin: Math.max(0, Math.round((end - start) / 60000)),
      setCount: entries.length,
      exercises,
    });
  }

  return sessions.sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function fmtDuration(min: number): string {
  if (min < 1) return "—";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export function fmtSessionDate(iso: string): string {
  const d = new Date(iso);
  const today = todayKey();
  const k = dayKey(iso);
  if (k === today) return "Today";
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (k === y) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
