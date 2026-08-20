// Domain operations over the D1 database (replaces the Google Sheet backend).
//
// The /api surface this serves is FROZEN — it must stay byte-identical to the
// sheet-backed version, so `tab` remains the group key and Exercise.order
// remains the zero-based position inside a tab.

import type { Env } from "./google";
import type { Exercise, ExerciseInput, Group, LogEntry, LogInput } from "../shared";
import { RECENT_LOG_DAYS } from "../shared";

/** Tabs that carry a per-row Muscle Group column (one tab, many muscle groups). */
const MIXED_TABS = new Set(["Anu Gym", "Home Gym"]);

function isMixed(tab: string): boolean {
  return MIXED_TABS.has(tab);
}

interface ExRow {
  id: string;
  tab: string;
  name: string;
  setting: string;
  sets_reps: string;
  notes: string;
  muscle_group: string | null;
  position: number;
}

function toExercise(r: ExRow): Exercise {
  const ex: Exercise = {
    id: r.id,
    name: r.name,
    setting: r.setting,
    setsReps: r.sets_reps,
    notes: r.notes,
    tab: r.tab,
    order: r.position,
  };
  // muscleGroup stays undefined for single-group tabs — the client relies on it.
  if (isMixed(r.tab)) ex.muscleGroup = r.muscle_group ?? "";
  return ex;
}

interface LogRow {
  ts: string;
  exercise_id: string;
  exercise: string;
  muscle_group: string;
  set_no: number;
  weight: number;
  reps: number;
  notes: string;
}

const toLogEntry = (r: LogRow): LogEntry => ({
  date: r.ts,
  exerciseId: r.exercise_id,
  exercise: r.exercise,
  muscleGroup: r.muscle_group,
  setNo: r.set_no,
  weight: r.weight,
  reps: r.reps,
  notes: r.notes,
});

// ---- Bootstrap -------------------------------------------------------------

export interface Bootstrap {
  groups: Group[];
  exercises: Record<string, Exercise[]>;
  log: LogEntry[];
  logCutoff: string;
}

export async function bootstrap(env: Env): Promise<Bootstrap> {
  const cutoff = new Date(Date.now() - RECENT_LOG_DAYS * 86400000).toISOString();
  const [tabs, exs, logs] = await env.DB.batch<any>([
    env.DB.prepare("SELECT name, is_mixed FROM tab ORDER BY position, name"),
    env.DB.prepare("SELECT * FROM exercise ORDER BY tab, position"),
    env.DB.prepare("SELECT * FROM log WHERE ts >= ? ORDER BY ts DESC").bind(cutoff),
  ]);

  const exercises: Record<string, Exercise[]> = {};
  const groups: Group[] = [];
  for (const t of tabs.results as { name: string; is_mixed: number }[]) {
    exercises[t.name] = [];
    groups.push({ tab: t.name, label: t.name, count: 0, isMixed: !!t.is_mixed });
  }
  for (const r of exs.results as ExRow[]) {
    (exercises[r.tab] ??= []).push(toExercise(r));
  }
  for (const g of groups) g.count = (exercises[g.tab] ?? []).length;

  return {
    groups,
    exercises,
    log: (logs.results as LogRow[]).map(toLogEntry),
    logCutoff: cutoff,
  };
}

// ---- Library ---------------------------------------------------------------

export async function readExercises(env: Env, tab: string): Promise<Exercise[]> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM exercise WHERE tab = ? ORDER BY position",
  )
    .bind(tab)
    .all<ExRow>();
  return results.map(toExercise);
}

/** Next ID for a tab: reuse the alpha prefix of existing IDs, bump the max number.
 *  Behaviour preserved verbatim from the sheet implementation. */
function nextId(tab: string, existing: Exercise[]): string {
  let prefix = "";
  let maxNum = 0;
  for (const ex of existing) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(ex.id.trim());
    if (m) {
      prefix = m[1];
      const n = parseInt(m[2], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  if (!prefix) {
    prefix = isMixed(tab)
      ? tab === "Home Gym"
        ? "HOME"
        : "ANU"
      : tab.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "X";
  }
  return `${prefix}${String(maxNum + 1).padStart(2, "0")}`;
}

export async function addExercise(
  env: Env,
  tab: string,
  input: ExerciseInput,
): Promise<Exercise> {
  const list = await readExercises(env, tab);
  const ex: Exercise = {
    id: nextId(tab, list),
    name: input.name.trim(),
    setting: input.setting?.trim() ?? "",
    setsReps: input.setsReps?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    muscleGroup: isMixed(tab) ? input.muscleGroup?.trim() ?? "" : undefined,
    tab,
    order: list.length,
  };
  await env.DB.prepare(
    "INSERT INTO exercise (id, tab, name, setting, sets_reps, notes, muscle_group, position)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      ex.id,
      tab,
      ex.name,
      ex.setting,
      ex.setsReps,
      ex.notes,
      ex.muscleGroup ?? null,
      ex.order,
    )
    .run();
  return ex;
}

export async function updateExercise(
  env: Env,
  tab: string,
  id: string,
  input: ExerciseInput,
): Promise<Exercise> {
  const row = await env.DB.prepare("SELECT * FROM exercise WHERE id = ? AND tab = ?")
    .bind(id, tab)
    .first<ExRow>();
  if (!row) throw new Error(`exercise ${id} not found in ${tab}`);
  const ex = toExercise(row);
  // Only provided fields are patched — same as the sheet implementation.
  ex.name = input.name?.trim() ?? ex.name;
  ex.setting = input.setting?.trim() ?? ex.setting;
  ex.setsReps = input.setsReps?.trim() ?? ex.setsReps;
  ex.notes = input.notes?.trim() ?? ex.notes;
  if (isMixed(tab) && input.muscleGroup !== undefined) {
    ex.muscleGroup = input.muscleGroup.trim();
  }
  await env.DB.prepare(
    "UPDATE exercise SET name = ?, setting = ?, sets_reps = ?, notes = ?, muscle_group = ?" +
      " WHERE id = ? AND tab = ?",
  )
    .bind(ex.name, ex.setting, ex.setsReps, ex.notes, ex.muscleGroup ?? null, id, tab)
    .run();
  return ex;
}

export async function deleteExercise(env: Env, tab: string, id: string): Promise<void> {
  await env.DB.prepare("DELETE FROM exercise WHERE id = ? AND tab = ?").bind(id, tab).run();
  // Close the gap so positions stay 0..n-1.
  const list = await readExercises(env, tab);
  await reindex(env, tab, list.map((e) => e.id));
}

async function reindex(env: Env, tab: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  await env.DB.batch(
    orderedIds.map((id, i) =>
      env.DB.prepare("UPDATE exercise SET position = ? WHERE id = ? AND tab = ?").bind(i, id, tab),
    ),
  );
}

/** Reorder by supplying the full list of ids in their new order. Ids not
 *  mentioned keep their relative order at the end. */
export async function reorderExercises(
  env: Env,
  tab: string,
  orderedIds: string[],
): Promise<Exercise[]> {
  const list = await readExercises(env, tab);
  const known = new Set(list.map((e) => e.id));
  const next = orderedIds.filter((id) => known.has(id));
  const seen = new Set(next);
  for (const e of list) if (!seen.has(e.id)) next.push(e.id);
  await reindex(env, tab, next);
  return readExercises(env, tab);
}

// ---- Workout log -----------------------------------------------------------

export async function appendLog(env: Env, input: LogInput, dateIso: string): Promise<LogEntry> {
  const entry: LogEntry = {
    date: input.date || dateIso,
    exerciseId: input.exerciseId,
    exercise: input.exercise,
    muscleGroup: input.muscleGroup,
    setNo: input.setNo,
    weight: input.weight,
    reps: input.reps,
    notes: input.notes?.trim() ?? "",
  };
  await env.DB.prepare(
    "INSERT INTO log (ts, exercise_id, exercise, muscle_group, set_no, weight, reps, notes)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      entry.date,
      entry.exerciseId,
      entry.exercise,
      entry.muscleGroup,
      entry.setNo,
      entry.weight,
      entry.reps,
      entry.notes,
    )
    .run();
  return entry;
}

export async function readLog(env: Env, exerciseId?: string): Promise<LogEntry[]> {
  const stmt = exerciseId
    ? env.DB.prepare("SELECT * FROM log WHERE exercise_id = ? ORDER BY ts DESC").bind(exerciseId)
    : env.DB.prepare("SELECT * FROM log ORDER BY ts DESC");
  const { results } = await stmt.all<LogRow>();
  return results.map(toLogEntry);
}

/** Edit a logged set, keyed by its ISO timestamp (the client's row key).
 *  Scoped through `id` so a duplicate timestamp can only ever touch ONE row —
 *  the sheet version rewrote every matching row. */
export async function updateLog(
  env: Env,
  date: string,
  patch: { weight?: number; reps?: number; notes?: string },
): Promise<void> {
  await env.DB.prepare(
    "UPDATE log SET weight = COALESCE(?, weight), reps = COALESCE(?, reps)," +
      " notes = COALESCE(?, notes)" +
      " WHERE id = (SELECT id FROM log WHERE ts = ? ORDER BY id LIMIT 1)",
  )
    .bind(patch.weight ?? null, patch.reps ?? null, patch.notes ?? null, date)
    .run();
}

export async function deleteLog(env: Env, date: string): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM log WHERE id = (SELECT id FROM log WHERE ts = ? ORDER BY id LIMIT 1)",
  )
    .bind(date)
    .run();
}
