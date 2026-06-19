import type {
  Owner, Scoreboard, OwnerScore, Task, TaskInput, TaskPatch,
  TaskStatus, Template, TemplateInput,
} from "../shared";
import { OWNERS } from "../shared";
import { daysBetween, nowIso, todayIST } from "./dates";

type Row = Record<string, unknown>;

export function rowToTask(r: Row): Task {
  return {
    id: Number(r.id),
    title: String(r.title),
    owner: r.owner as Owner,
    eta: (r.eta as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    status: r.status as TaskStatus,
    sortOrder: Number(r.sort_order),
    templateId: r.template_id == null ? null : Number(r.template_id),
    periodKey: (r.period_key as string | null) ?? null,
    createdAt: String(r.created_at),
    completedAt: (r.completed_at as string | null) ?? null,
  };
}

export function rowToTemplate(r: Row): Template {
  return {
    id: Number(r.id),
    title: String(r.title),
    owner: r.owner as Owner,
    notes: (r.notes as string | null) ?? null,
    cadence: r.cadence as Template["cadence"],
    dueDay: Number(r.due_day),
    active: Number(r.active) === 1,
    createdAt: String(r.created_at),
  };
}

export async function listTasks(db: D1Database): Promise<Task[]> {
  const { results } = await db
    .prepare("SELECT * FROM tasks ORDER BY sort_order ASC, id ASC")
    .all();
  return (results as Row[]).map(rowToTask);
}

async function getTask(db: D1Database, id: number): Promise<Task> {
  const row = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first();
  if (!row) throw new Error(`task ${id} not found`);
  return rowToTask(row as Row);
}

/** Default ordering key: ascending = soonest deadline first. A dated task's key
 *  is its day-number (earlier deadline -> smaller -> higher in the list). A
 *  no-deadline task is a legitimate, non-urgent item, so it sinks below every
 *  dated task (large key) rather than floating to the top. Manual drags
 *  overwrite sort_order with a 1..N sequence, which then wins. */
const NO_DEADLINE_KEY = 9_999_999;
export function etaSortKey(eta: string | null): number {
  if (!eta) return NO_DEADLINE_KEY;
  return Math.round(Date.parse(`${eta}T12:00:00Z`) / 86_400_000);
}

export async function createTask(db: D1Database, input: TaskInput): Promise<Task> {
  const sortOrder = etaSortKey(input.eta ?? null);
  const res = await db
    .prepare(
      `INSERT INTO tasks (title, owner, eta, notes, status, sort_order, created_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
    )
    .bind(input.title, input.owner, input.eta ?? null, input.notes ?? null, sortOrder, nowIso())
    .run();
  return getTask(db, Number(res.meta.last_row_id));
}

export async function patchTask(db: D1Database, id: number, patch: TaskPatch): Promise<Task> {
  const cur = await getTask(db, id);
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (patch.title !== undefined) { sets.push("title = ?"); vals.push(patch.title); }
  if (patch.owner !== undefined) { sets.push("owner = ?"); vals.push(patch.owner); }
  if (patch.eta !== undefined) {
    sets.push("eta = ?"); vals.push(patch.eta);
    sets.push("sort_order = ?"); vals.push(etaSortKey(patch.eta ?? null));
  }
  if (patch.notes !== undefined) { sets.push("notes = ?"); vals.push(patch.notes); }
  if (patch.status !== undefined && patch.status !== cur.status) {
    sets.push("status = ?"); vals.push(patch.status);
    if (patch.status === "done") { sets.push("completed_at = ?"); vals.push(nowIso()); }
    else { sets.push("completed_at = NULL"); }
  }
  if (sets.length === 0) return cur;

  vals.push(id);
  await db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return getTask(db, id);
}

export async function deleteTask(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
}

/** Persist a new top-to-bottom order for one (owner, status) lane. */
export async function reorderTasks(
  db: D1Database, owner: Owner, status: TaskStatus, orderedIds: number[],
): Promise<void> {
  const stmts = orderedIds.map((id, i) =>
    db.prepare("UPDATE tasks SET sort_order = ? WHERE id = ? AND owner = ? AND status = ?")
      .bind(i + 1, id, owner, status),
  );
  if (stmts.length) await db.batch(stmts);
}

export async function listTemplates(db: D1Database): Promise<Template[]> {
  const { results } = await db
    .prepare("SELECT * FROM recurring_templates ORDER BY id ASC")
    .all();
  return (results as Row[]).map(rowToTemplate);
}

async function getTemplate(db: D1Database, id: number): Promise<Template> {
  const row = await db.prepare("SELECT * FROM recurring_templates WHERE id = ?").bind(id).first();
  if (!row) throw new Error(`template ${id} not found`);
  return rowToTemplate(row as Row);
}

export async function createTemplate(db: D1Database, input: TemplateInput): Promise<Template> {
  const res = await db
    .prepare(
      `INSERT INTO recurring_templates (title, owner, notes, cadence, due_day, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.title, input.owner, input.notes ?? null, input.cadence, input.dueDay,
      input.active === false ? 0 : 1, nowIso(),
    )
    .run();
  return getTemplate(db, Number(res.meta.last_row_id));
}

export async function patchTemplate(
  db: D1Database, id: number, patch: Partial<TemplateInput>,
): Promise<Template> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.title !== undefined) { sets.push("title = ?"); vals.push(patch.title); }
  if (patch.owner !== undefined) { sets.push("owner = ?"); vals.push(patch.owner); }
  if (patch.notes !== undefined) { sets.push("notes = ?"); vals.push(patch.notes); }
  if (patch.cadence !== undefined) { sets.push("cadence = ?"); vals.push(patch.cadence); }
  if (patch.dueDay !== undefined) { sets.push("due_day = ?"); vals.push(patch.dueDay); }
  if (patch.active !== undefined) { sets.push("active = ?"); vals.push(patch.active ? 1 : 0); }
  if (sets.length) {
    vals.push(id);
    await db.prepare(`UPDATE recurring_templates SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  }
  return getTemplate(db, id);
}

export async function deleteTemplate(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM recurring_templates WHERE id = ?").bind(id).run();
}

function emptyScore(owner: Owner): OwnerScore {
  return { owner, scored: 0, onTime: 0, late: 0, avgDaysLate: 0, noEta: 0, onTimePct: null };
}

/** Score over done tasks. A done task with no eta is "noEta" (untracked). */
export async function computeScoreboard(db: D1Database): Promise<Scoreboard> {
  const { results } = await db
    .prepare("SELECT owner, eta, completed_at FROM tasks WHERE status = 'done'")
    .all();
  const acc: Record<Owner, OwnerScore & { _lateSum: number }> = {
    khushi: { ...emptyScore("khushi"), _lateSum: 0 },
    kushal: { ...emptyScore("kushal"), _lateSum: 0 },
  };
  for (const r of results as Row[]) {
    const owner = r.owner as Owner;
    if (owner !== "khushi" && owner !== "kushal") continue;
    const a = acc[owner];
    const eta = r.eta as string | null;
    const completedAt = r.completed_at as string | null;
    if (!eta || !completedAt) { a.noEta += 1; continue; }
    const completedYmd = todayIST(new Date(completedAt));
    const lateBy = daysBetween(eta, completedYmd); // >0 means late
    a.scored += 1;
    if (lateBy <= 0) a.onTime += 1;
    else { a.late += 1; a._lateSum += lateBy; }
  }
  for (const owner of OWNERS) {
    const a = acc[owner];
    a.avgDaysLate = a.late ? Math.round((a._lateSum / a.late) * 10) / 10 : 0;
    a.onTimePct = a.scored ? Math.round((a.onTime / a.scored) * 100) : null;
  }
  return {
    khushi: stripPrivate(acc.khushi),
    kushal: stripPrivate(acc.kushal),
  };
}

function stripPrivate(s: OwnerScore & { _lateSum: number }): OwnerScore {
  const { _lateSum, ...rest } = s;
  return rest;
}
