// ===========================================================================
// DATASTORE — Cloudflare D1, normalized engine schema.
//
//   pipelines    (the system definitions; read by the engine elsewhere)
//   cards        one row per video (brief + pipeline_id + system stamps)
//   card_stages  one row per stage of a card (status + people + work fields)
//   employees    access list (email PK, name, comma-joined roles)
//
// The rest of the app speaks a flat `Row`; this store assembles that Row from
// cards + card_stages (engine/card.ts) on read, and routes each flat-col write
// back to the right table/slot on write. The DataStore interface is unchanged,
// so the worker is untouched. Sheets backend removed (D1-only).
// ===========================================================================
import type { Row } from "../shared/engine/rbac";
import type { Env } from "./auth";
import { ConflictError } from "./sheets";
import { type TeamMember } from "./roles";
import { getPipeline, rolesForSystem, WILDCARD_SYSTEM, ADMIN_ROLE } from "../shared/engine/registry";
import { unionRoles, type Memberships } from "../shared/engine/memberships";
import { assembleRow, decomposeRow, routeWrite, type CardRecord, type StageRecord } from "../shared/engine/card";

/** Parse a comma-separated role cell for ONE system, dropping roles that aren't
 *  valid there. "*" (cross-system) accepts only Admin; a real system accepts its
 *  doer roles + Reviewer (see rolesForSystem). */
function parseSystemRoles(cell: string | null | undefined, systemId: string): string[] {
  const valid = systemId === WILDCARD_SYSTEM ? new Set([ADMIN_ROLE]) : new Set(rolesForSystem(systemId));
  return (cell ?? "").split(",").map((r) => r.trim()).filter((r) => r !== "" && valid.has(r));
}

export interface DataStore {
  readRows(): Promise<Row[]>;
  /** Write cells of one card. `expected` enables optimistic concurrency (throws ConflictError). */
  updateCells(rowId: string, values: Record<string, string | undefined>, expected?: { col: string; value: string }): Promise<void>;
  /** Append a card; returns the minted row_id. */
  appendRow(values: Record<string, string | undefined>): Promise<string>;
  deleteRowById(rowId: string): Promise<void>;
  loadTeam(): Promise<TeamMember[]>;
  /** Per-system memberships for one email (systemId/"*" → roles). */
  lookupMemberships(email: string): Promise<Memberships>;
  /** Union of roles across all systems — identity/UI gating + back-compat. */
  lookupRoles(email: string): Promise<string[]>;
  /** Replace a person's FULL membership set (one D1 row per system). */
  saveMemberships(name: string, email: string, memberships: Memberships): Promise<"updated" | "added">;
  deleteEmployee(email: string): Promise<boolean>;
}

export { ConflictError };

const parse = (j: string | null | undefined): Record<string, string> => {
  if (!j) return {};
  try { return JSON.parse(j) as Record<string, string>; } catch { return {}; }
};

type CardDB = CardRecord & Record<string, string | null>;
type StageDB = StageRecord & Record<string, string | null>;

class D1Store implements DataStore {
  constructor(private db: D1Database) {}

  // --- read: assemble flat Rows from the two tables ------------------------
  async readRows(): Promise<Row[]> {
    const [cardsRes, stagesRes] = await Promise.all([
      this.db.prepare(`SELECT * FROM cards ORDER BY id`).all<CardDB>(),
      this.db.prepare(`SELECT * FROM card_stages`).all<StageDB>(),
    ]);
    const byCard = new Map<string, StageRecord[]>();
    for (const s of stagesRes.results ?? []) {
      const list = byCard.get(s.card_id) ?? [];
      list.push(s as StageRecord);
      byCard.set(s.card_id, list);
    }
    const rows: Row[] = [];
    for (const card of cardsRes.results ?? []) {
      if (String(card.title ?? "").trim() === "") continue; // title-less rows ignored (legacy parity)
      const p = getPipeline(card.pipeline_id);
      rows.push(assembleRow(p, card as CardRecord, byCard.get(card.id) ?? []) as unknown as Row);
    }
    return rows;
  }

  // --- write: route each flat-col write to its table/slot ------------------
  async updateCells(rowId: string, values: Record<string, string | undefined>, expected?: { col: string; value: string }) {
    const card = await this.db.prepare(`SELECT * FROM cards WHERE id = ?`).bind(rowId).first<CardDB>();
    if (!card) throw new Error(`Row with row_id "${rowId}" not found`);
    const p = getPipeline(card.pipeline_id);
    const stageRows = ((await this.db.prepare(`SELECT * FROM card_stages WHERE card_id = ?`).bind(rowId).all<StageDB>()).results ?? []) as StageRecord[];

    if (expected) {
      const current = assembleRow(p, card as CardRecord, stageRows) as Record<string, string | undefined>;
      const cur = String(current[expected.col] ?? "").trim();
      if (cur !== expected.value.trim()) throw new ConflictError(cur, expected.value);
    }

    const cardFields: Record<string, string> = { updated_at: new Date().toISOString() };
    const cardExtra = parse(card.extra_json); let cardExtraDirty = false;
    const stageBy = new Map(stageRows.map((s) => [s.stage_id, s]));
    const stageUpd = new Map<string, { fields: Record<string, string>; extra: Record<string, string>; extraDirty: boolean }>();
    const su = (id: string) => {
      let u = stageUpd.get(id);
      if (!u) { u = { fields: {}, extra: parse(stageBy.get(id)?.extra_json), extraDirty: false }; stageUpd.set(id, u); }
      return u;
    };

    for (const [col, value] of Object.entries(values)) {
      if (value === undefined) continue;
      const t = routeWrite(p, col);
      if (!t) continue;
      if (t.kind === "card" || t.kind === "system") cardFields[t.field] = value;
      else if (t.kind === "card_extra") { cardExtra[t.key] = value; cardExtraDirty = true; }
      else if (t.kind === "stage") su(t.stageId).fields[t.slot] = value;
      else if (t.kind === "stage_extra") { const u = su(t.stageId); u.extra[t.fieldId] = value; u.extraDirty = true; }
    }

    const stmts: D1PreparedStatement[] = [];
    if (cardExtraDirty) cardFields.extra_json = JSON.stringify(cardExtra);
    const cardCols = Object.keys(cardFields);
    stmts.push(this.db.prepare(`UPDATE cards SET ${cardCols.map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?`)
      .bind(...cardCols.map((c) => cardFields[c]), rowId));

    for (const [sid, u] of stageUpd) {
      const f: Record<string, string> = { ...u.fields };
      if (u.extraDirty) f.extra_json = JSON.stringify(u.extra);
      const cols = Object.keys(f);
      if (cols.length === 0) continue;
      stmts.push(this.db.prepare(
        `INSERT INTO card_stages (card_id, stage_id, ${cols.map((c) => `"${c}"`).join(", ")}) ` +
        `VALUES (?, ?, ${cols.map(() => "?").join(", ")}) ` +
        `ON CONFLICT(card_id, stage_id) DO UPDATE SET ${cols.map((c) => `"${c}" = excluded."${c}"`).join(", ")}`,
      ).bind(rowId, sid, ...cols.map((c) => f[c])));
    }
    await this.db.batch(stmts);
  }

  // --- append: create a fresh card + its stage rows ------------------------
  async appendRow(values: Record<string, string | undefined>): Promise<string> {
    const { results } = await this.db.prepare(`SELECT id FROM cards`).all<{ id: string }>();
    let counter = 1;
    for (const r of results ?? []) {
      const m = String(r.id).match(/^r(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n >= counter) counter = n + 1; }
    }
    const id = `r${String(counter).padStart(4, "0")}`;
    const row: Record<string, string | undefined> = { ...values, row_id: id, pipeline: values.pipeline || "standard" };
    const p = getPipeline(row.pipeline);
    const { card, stages } = decomposeRow(p, row, true);
    const now = new Date().toISOString();

    const cardCols = ["id", "pipeline_id", "title", "notes", "description", "category", "subcategory", "extra_json", "created_at", "updated_at", "status_since"];
    const stmts: D1PreparedStatement[] = [
      this.db.prepare(`INSERT INTO cards (${cardCols.map((x) => `"${x}"`).join(", ")}) VALUES (${cardCols.map(() => "?").join(", ")})`)
        .bind(id, p.id, card.title ?? "", card.notes ?? "", card.description ?? "", card.category ?? "", card.subcategory ?? "", card.extra_json ?? null, now, now, card.status_since ?? null),
    ];
    const stCols = ["card_id", "stage_id", "status", "assignee", "reviewer", "work_link", "instruction", "eta", "feedback", "extra_json", "status_since"];
    for (const s of stages) {
      stmts.push(this.db.prepare(`INSERT INTO card_stages (${stCols.map((x) => `"${x}"`).join(", ")}) VALUES (${stCols.map(() => "?").join(", ")})`)
        .bind(id, s.stage_id, s.status ?? null, s.assignee ?? null, s.reviewer ?? null, s.work_link ?? null, s.instruction ?? null, s.eta ?? null, s.feedback ?? null, s.extra_json ?? null, s.status_since ?? null));
    }
    await this.db.batch(stmts);
    return id;
  }

  async deleteRowById(rowId: string) {
    const res = await this.db.prepare(`DELETE FROM cards WHERE id = ?`).bind(rowId).run();
    await this.db.prepare(`DELETE FROM card_stages WHERE card_id = ?`).bind(rowId).run();
    if (res.meta?.changes === 0) throw new Error(`Row with row_id "${rowId}" not found`);
  }

  // --- employees (access list, membership-grained) ------------------------
  // One row per (email, system_id). `role` is the comma-joined roles that person
  // holds IN that system. A doer has one row; a cross-system reviewer has one row
  // per system; the founding admin has a "*" row.
  async loadTeam(): Promise<TeamMember[]> {
    const { results } = await this.db.prepare(`SELECT email, system_id, name, role FROM employees`)
      .all<{ email: string; system_id: string; name: string; role: string }>();
    const byEmail = new Map<string, TeamMember>();
    for (const r of results ?? []) {
      const email = (r.email ?? "").trim().toLowerCase();
      const sys = (r.system_id ?? "").trim();
      if (!email || !sys) continue;
      const roles = parseSystemRoles(r.role, sys);
      if (roles.length === 0) continue;
      let m = byEmail.get(email);
      if (!m) { m = { email, name: (r.name ?? "").trim(), role: "", roles: [], memberships: {} }; byEmail.set(email, m); }
      if ((r.name ?? "").trim()) m.name = (r.name ?? "").trim();
      m.memberships![sys] = roles;
    }
    const members = [...byEmail.values()];
    for (const m of members) { m.roles = unionRoles(m.memberships ?? {}); m.role = m.roles[0] ?? ""; }
    return members;
  }

  async lookupMemberships(email: string): Promise<Memberships> {
    const { results } = await this.db.prepare(`SELECT system_id, role FROM employees WHERE email = ?`)
      .bind(email.trim().toLowerCase()).all<{ system_id: string; role: string }>();
    const m: Memberships = {};
    for (const r of results ?? []) {
      const sys = (r.system_id ?? "").trim();
      if (!sys) continue;
      const roles = parseSystemRoles(r.role, sys);
      if (roles.length) m[sys] = roles;
    }
    return m;
  }

  async lookupRoles(email: string): Promise<string[]> {
    return unionRoles(await this.lookupMemberships(email));
  }

  async saveMemberships(name: string, email: string, memberships: Memberships): Promise<"updated" | "added"> {
    const key = email.trim().toLowerCase();
    const existing = await this.db.prepare(`SELECT 1 FROM employees WHERE email = ? LIMIT 1`).bind(key).first();
    const stmts: D1PreparedStatement[] = [
      this.db.prepare(`DELETE FROM employees WHERE email = ?`).bind(key),
    ];
    for (const [sys, roles] of Object.entries(memberships)) {
      const cell = (roles ?? []).filter(Boolean).join(", ");
      if (!sys || !cell) continue;
      stmts.push(this.db.prepare(`INSERT INTO employees (email, system_id, name, role) VALUES (?, ?, ?, ?)`)
        .bind(key, sys, name, cell));
    }
    await this.db.batch(stmts);
    return existing ? "updated" : "added";
  }

  async deleteEmployee(email: string): Promise<boolean> {
    const res = await this.db.prepare(`DELETE FROM employees WHERE email = ?`).bind(email.trim().toLowerCase()).run();
    return (res.meta?.changes ?? 0) > 0;
  }
}

/** D1 is the only backend now. */
export function getStore(env: Env): DataStore {
  return new D1Store(env.TRACKER_DB);
}
