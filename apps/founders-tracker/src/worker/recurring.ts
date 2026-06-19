import type { Cadence, Owner, Template } from "../shared";
import { listTemplates } from "./db";
import { nowIso, todayIST } from "./dates";

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** ISO week number + ISO week-year for a 'YYYY-MM-DD'. */
function isoWeek(ymd: string): { year: number; week: number } {
  const { y, m, d } = parseYmd(ymd);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  date.setUTCDate(date.getUTCDate() - day + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year: date.getUTCFullYear(), week };
}

export function periodKey(cadence: Cadence, ymd: string): string {
  if (cadence === "monthly") return ymd.slice(0, 7); // YYYY-MM
  const { year, week } = isoWeek(ymd);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based here
}

function pad2(n: number): string { return String(n).padStart(2, "0"); }

/** The 'YYYY-MM-DD' due date for the period that contains `ymd`. */
export function resolveEta(template: Template, ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  if (template.cadence === "monthly") {
    const day = Math.min(template.dueDay, daysInMonth(y, m));
    return `${y}-${pad2(m)}-${pad2(day)}`;
  }
  // weekly: dueDay 0=Mon … 6=Sun. Find that weekday within the current ISO week.
  const date = new Date(Date.UTC(y, m - 1, d));
  const cur = (date.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun for today
  date.setUTCDate(date.getUTCDate() + (template.dueDay - cur));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

async function ownerOpenMaxSort(db: D1Database, owner: Owner): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS m FROM tasks WHERE owner = ? AND status = 'open'")
    .bind(owner)
    .first<{ m: number }>();
  return (row?.m ?? 0) + 1;
}

/** Insert any missing recurring instances for "today". Idempotent: the unique
 *  index on (template_id, period_key) makes a duplicate insert a no-op. */
export async function runGenerator(db: D1Database): Promise<number> {
  const today = todayIST();
  const templates = (await listTemplates(db)).filter((t) => t.active);
  let inserted = 0;
  for (const t of templates) {
    const pk = periodKey(t.cadence, today);
    const exists = await db
      .prepare("SELECT 1 FROM tasks WHERE template_id = ? AND period_key = ? LIMIT 1")
      .bind(t.id, pk)
      .first();
    if (exists) continue;
    const eta = resolveEta(t, today);
    const sort = await ownerOpenMaxSort(db, t.owner);
    try {
      await db
        .prepare(
          `INSERT INTO tasks (title, owner, eta, notes, status, sort_order, template_id, period_key, created_at)
           VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
        )
        .bind(t.title, t.owner, eta, t.notes ?? null, sort, t.id, pk, nowIso())
        .run();
      inserted += 1;
    } catch (err) {
      // Unique-index collision under a race is expected and fine; log others.
      console.error(`generator insert failed for template ${t.id}:`, err);
    }
  }
  return inserted;
}
