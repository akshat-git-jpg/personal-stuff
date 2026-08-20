import type { Env } from "./google";
import { getTabs, addTab, valuesUpdate, valuesClear } from "./google";

const MIRROR_PREFIX = "Mirror: ";

function mirrorTab(name: string): string {
  const t = `${MIRROR_PREFIX}${name}`;
  // Belt and braces: the original tabs are the rollback copy and must stay frozen.
  if (!t.startsWith(MIRROR_PREFIX)) throw new Error("refusing to write a non-mirror tab");
  return t;
}

export async function mirrorToSheet(env: Env): Promise<void> {
  const meta = await getTabs(env);
  const existing = new Set(meta.map((m) => m.title));

  const [tabsRes, exRes, logRes] = await env.DB.batch<any>([
    env.DB.prepare("SELECT name, is_mixed FROM tab ORDER BY position, name"),
    env.DB.prepare("SELECT * FROM exercise ORDER BY tab, position"),
    env.DB.prepare("SELECT * FROM log ORDER BY ts DESC"),
  ]);

  const tabs = tabsRes.results;
  const exs = exRes.results;
  const logs = logRes.results;

  for (const t of tabs) {
    const tName = mirrorTab(t.name);
    if (!existing.has(tName)) {
      await addTab(env, tName);
      existing.add(tName);
    }
    const mixed = !!t.is_mixed;
    const tabExs = exs.filter((e: any) => e.tab === t.name);
    
    // Header
    const rows = mixed
      ? [["ID", "Muscle Group", "Name", "Setting", "Sets/Reps", "Notes"]]
      : [["ID", "Name", "Setting", "Sets/Reps", "Notes"]];
      
    for (const ex of tabExs) {
      if (mixed) {
        rows.push([ex.id, ex.muscle_group ?? "", ex.name, ex.setting, ex.sets_reps, ex.notes]);
      } else {
        rows.push([ex.id, ex.name, ex.setting, ex.sets_reps, ex.notes]);
      }
    }
    
    await valuesUpdate(env, `'${tName}'!A1`, rows);
    
    // Clear tail
    const oldMeta = meta.find((m) => m.title === tName);
    if (oldMeta && oldMeta.rowCount > rows.length) {
      const clearRange = `'${tName}'!A${rows.length + 1}:Z`;
      await valuesClear(env, clearRange);
    }
  }

  const logTabName = mirrorTab("Workout Log");
  if (!existing.has(logTabName)) {
    await addTab(env, logTabName);
    existing.add(logTabName);
  }
  const logRows = [["Date", "Exercise ID", "Exercise", "Muscle Group", "Set", "Weight", "Reps", "Notes"]];
  for (const l of logs) {
    logRows.push([l.ts, l.exercise_id, l.exercise, l.muscle_group, String(l.set_no), String(l.weight), String(l.reps), l.notes]);
  }
  await valuesUpdate(env, `'${logTabName}'!A1`, logRows);
  const logMeta = meta.find((m) => m.title === logTabName);
  if (logMeta && logMeta.rowCount > logRows.length) {
    const clearRange = `'${logTabName}'!A${logRows.length + 1}:Z`;
    await valuesClear(env, clearRange);
  }
}
