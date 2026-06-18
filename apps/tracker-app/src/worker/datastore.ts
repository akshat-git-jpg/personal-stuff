// ===========================================================================
// DATASTORE — the swappable data backend. Everything that reads/writes card or
// team data goes through this interface, so flipping the `DATA_BACKEND` env var
// ("sheets" | "d1") swaps the whole backend with zero logic changes elsewhere.
//
//   • SheetsStore — the original Google Sheets backend (wraps sheets.ts/roles.ts).
//   • D1Store     — Cloudflare D1 (SQLite): `cards` + `employees` tables.
//
// Both honour the same contracts (optimistic-concurrency ConflictError on
// updateCells; auto-stamped last_updated; row_id minted as r#### on append).
// ===========================================================================
import type { Column } from "../shared/columns";
import { COLUMNS } from "../shared/columns";
import type { Row } from "../shared/rbac";
import type { Env } from "./auth";
import {
  ConflictError, getAccessToken,
  readRows as sheetReadRows, updateCells as sheetUpdateCells,
  appendRow as sheetAppendRow, deleteRowById as sheetDeleteRow,
  upsertEmployee as sheetUpsertEmployee, deleteEmployee as sheetDeleteEmployee,
} from "./sheets";
import { loadTeam as sheetLoadTeam, lookupRoles as sheetLookupRoles, parseRoles, type TeamMember } from "./roles";

export interface DataStore {
  readRows(): Promise<Row[]>;
  /** Write cells of one card. `expected` enables optimistic concurrency (throws ConflictError). */
  updateCells(rowId: string, values: Partial<Record<Column, string>>, expected?: { col: Column; value: string }): Promise<void>;
  /** Append a card; returns the minted row_id. */
  appendRow(values: Partial<Record<Column, string>>): Promise<string>;
  deleteRowById(rowId: string): Promise<void>;
  loadTeam(): Promise<TeamMember[]>;
  lookupRoles(email: string): Promise<string[]>;
  upsertEmployee(name: string, email: string, roleCell: string): Promise<"updated" | "added">;
  deleteEmployee(email: string): Promise<boolean>;
}

const CARD_COLS = COLUMNS as readonly string[];

// ---------------------------------------------------------------------------
// Sheets backend — thin wrappers over the existing sheets.ts / roles.ts code.
// ---------------------------------------------------------------------------
class SheetsStore implements DataStore {
  private token?: string;
  constructor(private env: Env) {}
  private async tok(): Promise<string> {
    return (this.token ??= await getAccessToken(this.env.GOOGLE_SA_JSON));
  }
  async readRows() { return sheetReadRows(await this.tok(), this.env.SHEET_ID); }
  async updateCells(rowId: string, values: Partial<Record<Column, string>>, expected?: { col: Column; value: string }) {
    return sheetUpdateCells(await this.tok(), this.env.SHEET_ID, rowId, values, expected);
  }
  async appendRow(values: Partial<Record<Column, string>>) { return sheetAppendRow(await this.tok(), this.env.SHEET_ID, values); }
  async deleteRowById(rowId: string) { return sheetDeleteRow(await this.tok(), this.env.SHEET_ID, rowId); }
  async loadTeam() { return sheetLoadTeam(await this.tok(), this.env.SHEET_ID); }
  async lookupRoles(email: string) { return sheetLookupRoles(await this.tok(), this.env.SHEET_ID, email); }
  async upsertEmployee(name: string, email: string, roleCell: string) { return sheetUpsertEmployee(await this.tok(), this.env.SHEET_ID, name, email, roleCell); }
  async deleteEmployee(email: string) { return sheetDeleteEmployee(await this.tok(), this.env.SHEET_ID, email); }
}

// ---------------------------------------------------------------------------
// D1 backend — `cards` (one TEXT column per COLUMNS, row_id PRIMARY KEY) and
// `employees` (email PRIMARY KEY, name, role) tables.
// ---------------------------------------------------------------------------
class D1Store implements DataStore {
  constructor(private db: D1Database) {}

  async readRows(): Promise<Row[]> {
    const { results } = await this.db.prepare(`SELECT * FROM cards ORDER BY row_id`).all<Record<string, string | null>>();
    return (results ?? [])
      .filter((r) => String(r.video_title ?? "").trim() !== "") // mirror Sheets: title-less rows ignored
      .map((r) => {
        const row: Row = {};
        for (const c of CARD_COLS) row[c as Column] = (r[c] ?? "") as string;
        return row;
      });
  }

  async updateCells(rowId: string, values: Partial<Record<Column, string>>, expected?: { col: Column; value: string }) {
    const existing = await this.db.prepare(`SELECT * FROM cards WHERE row_id = ?`).bind(rowId).first<Record<string, string | null>>();
    if (!existing) throw new Error(`Row with row_id "${rowId}" not found`);
    if (expected) {
      const cur = String(existing[expected.col] ?? "").trim();
      if (cur !== expected.value.trim()) throw new ConflictError(cur, expected.value);
    }
    const toWrite: Record<string, string> = { ...(values as Record<string, string>) };
    if (!("last_updated" in toWrite)) toWrite.last_updated = new Date().toISOString();
    const cols = Object.keys(toWrite).filter((c) => CARD_COLS.includes(c));
    if (cols.length === 0) return;
    const setClause = cols.map((c) => `"${c}" = ?`).join(", ");
    await this.db.prepare(`UPDATE cards SET ${setClause} WHERE row_id = ?`)
      .bind(...cols.map((c) => toWrite[c] ?? ""), rowId).run();
  }

  async appendRow(values: Partial<Record<Column, string>>): Promise<string> {
    const { results } = await this.db.prepare(`SELECT row_id FROM cards`).all<{ row_id: string }>();
    let counter = 1;
    for (const r of results ?? []) {
      const m = String(r.row_id).match(/^r(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n >= counter) counter = n + 1; }
    }
    const rowId = `r${String(counter).padStart(4, "0")}`;
    const full: Record<string, string> = { ...(values as Record<string, string>), row_id: rowId, last_updated: new Date().toISOString() };
    const cols = Object.keys(full).filter((c) => CARD_COLS.includes(c));
    const placeholders = cols.map(() => "?").join(", ");
    await this.db.prepare(`INSERT INTO cards (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`)
      .bind(...cols.map((c) => full[c] ?? "")).run();
    return rowId;
  }

  async deleteRowById(rowId: string) {
    const res = await this.db.prepare(`DELETE FROM cards WHERE row_id = ?`).bind(rowId).run();
    if (res.meta?.changes === 0) throw new Error(`Row with row_id "${rowId}" not found`);
  }

  async loadTeam(): Promise<TeamMember[]> {
    const { results } = await this.db.prepare(`SELECT name, email, role FROM employees`).all<{ name: string; email: string; role: string }>();
    const members: TeamMember[] = [];
    for (const r of results ?? []) {
      const email = (r.email ?? "").trim();
      const roleCell = (r.role ?? "").trim();
      if (!email || !roleCell) continue;
      const roles = parseRoles(roleCell);
      if (roles.length === 0) continue;
      members.push({ name: (r.name ?? "").trim(), email: email.toLowerCase(), role: roles[0], roles });
    }
    return members;
  }

  async lookupRoles(email: string): Promise<string[]> {
    const r = await this.db.prepare(`SELECT role FROM employees WHERE email = ?`).bind(email.trim().toLowerCase()).first<{ role: string }>();
    return r ? parseRoles((r.role ?? "").trim()) : [];
  }

  async upsertEmployee(name: string, email: string, roleCell: string): Promise<"updated" | "added"> {
    const key = email.trim().toLowerCase();
    const existing = await this.db.prepare(`SELECT email FROM employees WHERE email = ?`).bind(key).first();
    await this.db.prepare(
      `INSERT INTO employees (email, name, role) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role`,
    ).bind(key, name, roleCell).run();
    return existing ? "updated" : "added";
  }

  async deleteEmployee(email: string): Promise<boolean> {
    const res = await this.db.prepare(`DELETE FROM employees WHERE email = ?`).bind(email.trim().toLowerCase()).run();
    return (res.meta?.changes ?? 0) > 0;
  }
}

/** Pick the live backend from the DATA_BACKEND env var (defaults to Sheets). */
export function getStore(env: Env): DataStore {
  return env.DATA_BACKEND === "d1" ? new D1Store(env.TRACKER_DB) : new SheetsStore(env);
}
