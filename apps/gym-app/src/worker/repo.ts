// Domain operations over the spreadsheet: muscle-group tabs (the "library")
// and the append-only Workout Log tab.
//
// Strategy for the library: each mutation reads the whole tab, mutates the
// in-memory list, and writes the whole tab back. Data volumes are tiny
// (tens of rows) and this makes add / edit / delete / reorder uniform and
// reliable. Row order in the sheet IS the exercise order.

import type { Env } from "./google";
import { addTab, getTabs, valuesAppend, valuesBatchGet, valuesClear, valuesGet, valuesUpdate } from "./google";
import type { Exercise, ExerciseInput, Group, LogEntry, LogInput } from "../shared";
import { RECENT_LOG_DAYS, WORKOUT_LOG_HEADER, WORKOUT_LOG_TAB } from "../shared";

const MIXED_TAB = "Anu Gym";

/** Tabs that are not exercise libraries. */
const NON_LIBRARY = new Set([WORKOUT_LOG_TAB]);

function isMixed(tab: string): boolean {
  return tab === MIXED_TAB;
}

const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

// ---- Bootstrap: all groups + all exercises + full log in one batched read ---

export interface Bootstrap {
  groups: Group[];
  exercises: Record<string, Exercise[]>;
  log: LogEntry[]; // recent only (>= logCutoff)
  logCutoff: string; // ISO; entries older than this load lazily
}

export async function bootstrap(env: Env): Promise<Bootstrap> {
  const tabs = await getTabs(env);
  const libTabs = tabs.filter((t) => !NON_LIBRARY.has(t.title));
  const hasLog = tabs.some((t) => t.title === WORKOUT_LOG_TAB);

  const ranges = [
    ...libTabs.map((t) => `${q(t.title)}!${isMixed(t.title) ? "A2:F" : "A2:E"}`),
    ...(hasLog ? [`${q(WORKOUT_LOG_TAB)}!A2:H`] : []),
  ];
  const batches = await valuesBatchGet(env, ranges);

  const exercises: Record<string, Exercise[]> = {};
  const groups: Group[] = [];
  libTabs.forEach((t, i) => {
    const rows = batches[i] ?? [];
    const list = rows
      .map((r, idx) => rowToExercise(t.title, r, idx))
      .filter((ex) => ex.id.trim() !== "" || ex.name.trim() !== "");
    exercises[t.title] = list;
    groups.push({ tab: t.title, label: t.title, count: list.length, isMixed: isMixed(t.title) });
  });

  const cutoff = new Date(Date.now() - RECENT_LOG_DAYS * 86400000).toISOString();
  const fullLog = hasLog
    ? (batches[libTabs.length] ?? [])
        .filter((r) => (r[0] ?? "").trim() !== "")
        .map(parseLogRow)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];
  const log = fullLog.filter((e) => e.date >= cutoff);

  return { groups, exercises, log, logCutoff: cutoff };
}

// ---- Library ---------------------------------------------------------------

function rowToExercise(tab: string, row: string[], order: number): Exercise {
  if (isMixed(tab)) {
    // ID, Muscle Group, Name, Setting, Sets/Reps, Notes
    return {
      id: row[0] ?? "",
      muscleGroup: row[1] ?? "",
      name: row[2] ?? "",
      setting: row[3] ?? "",
      setsReps: row[4] ?? "",
      notes: row[5] ?? "",
      tab,
      order,
    };
  }
  // ID, Name, Setting, Sets/Reps, Notes
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    setting: row[2] ?? "",
    setsReps: row[3] ?? "",
    notes: row[4] ?? "",
    tab,
    order,
  };
}

function exerciseToRow(ex: Exercise): string[] {
  if (isMixed(ex.tab)) {
    return [ex.id, ex.muscleGroup ?? "", ex.name, ex.setting, ex.setsReps, ex.notes];
  }
  return [ex.id, ex.name, ex.setting, ex.setsReps, ex.notes];
}

const dataRange = (tab: string) => (isMixed(tab) ? `${tab}!A2:F` : `${tab}!A2:E`);

export async function readExercises(env: Env, tab: string): Promise<Exercise[]> {
  const rows = await valuesGet(env, dataRange(tab));
  return rows
    .map((r, i) => rowToExercise(tab, r, i))
    .filter((ex) => ex.id.trim() !== "" || ex.name.trim() !== "");
}

/** Persist the full ordered list back to the tab, clearing any trailing rows. */
async function writeExercises(env: Env, tab: string, list: Exercise[]): Promise<void> {
  const reindexed = list.map((ex, i) => ({ ...ex, order: i }));
  const values = reindexed.map(exerciseToRow);
  if (values.length > 0) {
    const lastCol = isMixed(tab) ? "F" : "E";
    await valuesUpdate(env, `${tab}!A2:${lastCol}${1 + values.length}`, values);
  }
  // Clear any rows that used to exist beyond the new end.
  const lastCol = isMixed(tab) ? "F" : "E";
  await valuesClear(env, `${tab}!A${2 + values.length}:${lastCol}`);
}

/** Next ID for a tab: reuse the alpha prefix of existing IDs, bump the max number. */
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
      ? "ANU"
      : tab.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || "X";
  }
  const width = isMixed(tab) ? 2 : 2;
  return `${prefix}${String(maxNum + 1).padStart(width, "0")}`;
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
  list.push(ex);
  await writeExercises(env, tab, list);
  return ex;
}

export async function updateExercise(
  env: Env,
  tab: string,
  id: string,
  input: ExerciseInput,
): Promise<Exercise> {
  const list = await readExercises(env, tab);
  const idx = list.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error(`exercise ${id} not found in ${tab}`);
  const ex = list[idx];
  ex.name = input.name?.trim() ?? ex.name;
  ex.setting = input.setting?.trim() ?? ex.setting;
  ex.setsReps = input.setsReps?.trim() ?? ex.setsReps;
  ex.notes = input.notes?.trim() ?? ex.notes;
  if (isMixed(tab) && input.muscleGroup !== undefined) {
    ex.muscleGroup = input.muscleGroup.trim();
  }
  await writeExercises(env, tab, list);
  return ex;
}

export async function deleteExercise(env: Env, tab: string, id: string): Promise<void> {
  const list = await readExercises(env, tab);
  const next = list.filter((e) => e.id !== id);
  await writeExercises(env, tab, next);
}

/** Reorder by supplying the full list of ids in their new order. */
export async function reorderExercises(
  env: Env,
  tab: string,
  orderedIds: string[],
): Promise<Exercise[]> {
  const list = await readExercises(env, tab);
  const byId = new Map(list.map((e) => [e.id, e]));
  const next: Exercise[] = [];
  for (const id of orderedIds) {
    const e = byId.get(id);
    if (e) {
      next.push(e);
      byId.delete(id);
    }
  }
  // Any ids not mentioned keep their relative order at the end.
  for (const e of list) if (byId.has(e.id)) next.push(e);
  await writeExercises(env, tab, next);
  return next.map((e, i) => ({ ...e, order: i }));
}

// ---- Workout Log -----------------------------------------------------------

async function ensureLogTab(env: Env): Promise<void> {
  const tabs = await getTabs(env);
  if (tabs.some((t) => t.title === WORKOUT_LOG_TAB)) return;
  await addTab(env, WORKOUT_LOG_TAB);
  await valuesUpdate(env, `${WORKOUT_LOG_TAB}!A1:H1`, [WORKOUT_LOG_HEADER]);
}

export async function appendLog(env: Env, input: LogInput, dateIso: string): Promise<LogEntry> {
  await ensureLogTab(env);
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
  await valuesAppend(env, `${WORKOUT_LOG_TAB}!A:H`, [
    [
      entry.date,
      entry.exerciseId,
      entry.exercise,
      entry.muscleGroup,
      entry.setNo,
      entry.weight,
      entry.reps,
      entry.notes,
    ],
  ]);
  return entry;
}

function parseLogRow(row: string[]): LogEntry {
  return {
    date: row[0] ?? "",
    exerciseId: row[1] ?? "",
    exercise: row[2] ?? "",
    muscleGroup: row[3] ?? "",
    setNo: Number(row[4] ?? 0),
    weight: Number(row[5] ?? 0),
    reps: Number(row[6] ?? 0),
    notes: row[7] ?? "",
  };
}

export async function readLog(env: Env, exerciseId?: string): Promise<LogEntry[]> {
  const tabs = await getTabs(env);
  if (!tabs.some((t) => t.title === WORKOUT_LOG_TAB)) return [];
  const rows = await valuesGet(env, `${WORKOUT_LOG_TAB}!A2:H`);
  let entries = rows.filter((r) => (r[0] ?? "").trim() !== "").map(parseLogRow);
  if (exerciseId) entries = entries.filter((e) => e.exerciseId === exerciseId);
  // Most recent first.
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries;
}

/** Rewrite the whole log tab from rows, clearing any trailing leftover rows. */
async function writeLogRows(env: Env, rows: string[][]): Promise<void> {
  if (rows.length > 0) {
    await valuesUpdate(env, `${WORKOUT_LOG_TAB}!A2:H${1 + rows.length}`, rows);
  }
  await valuesClear(env, `${WORKOUT_LOG_TAB}!A${2 + rows.length}:H`);
}

/** Edit a logged set, keyed by its ISO date. */
export async function updateLog(
  env: Env,
  date: string,
  patch: { weight?: number; reps?: number; notes?: string },
): Promise<void> {
  const rows = (await valuesGet(env, `${WORKOUT_LOG_TAB}!A2:H`)).filter(
    (r) => (r[0] ?? "").trim() !== "",
  );
  const next = rows.map((r) => {
    if (r[0] !== date) return r;
    const row = [...r];
    if (patch.weight !== undefined) row[5] = String(patch.weight);
    if (patch.reps !== undefined) row[6] = String(patch.reps);
    if (patch.notes !== undefined) row[7] = patch.notes;
    return row;
  });
  await writeLogRows(env, next);
}

/** Delete a logged set, keyed by its ISO date. */
export async function deleteLog(env: Env, date: string): Promise<void> {
  const rows = (await valuesGet(env, `${WORKOUT_LOG_TAB}!A2:H`)).filter(
    (r) => (r[0] ?? "").trim() !== "" && r[0] !== date,
  );
  await writeLogRows(env, rows);
}
