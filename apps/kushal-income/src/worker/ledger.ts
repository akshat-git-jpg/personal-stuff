/**
 * ledger.ts
 * Store the synced ledger in D1 and merge the owner's edits into it on read.
 *
 * Precedence, highest first:
 *   1. an override on the row itself      -> status "confirmed"
 *   2. an owner rule on the row's payee   -> status "confirmed", only for rows
 *                                            the sync could not tag ("needs")
 *   3. what the sync decided              -> "proven" | "confirmed" | "needs"
 * A sync replaces rows/statements/meta and never touches overrides or rules.
 */

import type { Env } from "./auth";

export type Status = "proven" | "confirmed" | "needs";

export interface Row {
  id: string;
  source: "sbi" | "sbic" | "neu" | "icici";
  date: string;
  time: string | null;
  amount: number | null;
  fx: string | null;
  kind: "spend" | "in" | "refund" | "bill" | "payment";
  final: boolean;
  text: string;
  payee: string;
  payee_key: string;
  tags: string[];
  desc: string | null;
  status: Status;
  why: string;
  stmt: string | null;
  maybe_dup?: boolean;
}

interface Ledger {
  generated_at: string;
  rows: Row[];
  statements: { id: string }[];
  sources: unknown[];
}

const CHUNK = 250;

function valid(body: unknown): body is Ledger {
  const b = body as Ledger;
  return !!b && typeof b.generated_at === "string" && Array.isArray(b.rows)
    && Array.isArray(b.statements) && Array.isArray(b.sources)
    && b.rows.every((r) => typeof r.id === "string" && typeof r.date === "string"
      && typeof r.payee_key === "string");
}

/** Replace the synced data. One json_each insert per chunk keeps the query count low. */
export async function ingest(env: Env, body: unknown): Promise<{ rows: number; statements: number }> {
  if (!valid(body)) throw new Error("bad ledger shape");
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM rows"),
    env.DB.prepare("DELETE FROM statements"),
  ];
  for (let i = 0; i < body.rows.length; i += CHUNK) {
    const part = body.rows.slice(i, i + CHUNK);
    stmts.push(env.DB.prepare(
      `INSERT INTO rows (id, date, payee_key, data)
       SELECT json_extract(value, '$.id'), json_extract(value, '$.date'),
              json_extract(value, '$.payee_key'), value FROM json_each(?)`,
    ).bind(JSON.stringify(part)));
  }
  for (let i = 0; i < body.statements.length; i += CHUNK) {
    stmts.push(env.DB.prepare(
      `INSERT INTO statements (id, data)
       SELECT json_extract(value, '$.id'), value FROM json_each(?)`,
    ).bind(JSON.stringify(body.statements.slice(i, i + CHUNK))));
  }
  stmts.push(env.DB.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('generated_at', ?), ('sources', ?)",
  ).bind(body.generated_at, JSON.stringify(body.sources)));
  await env.DB.batch(stmts);
  return { rows: body.rows.length, statements: body.statements.length };
}

export async function read(env: Env) {
  const [rows, stmts, meta, ovr, rules] = await env.DB.batch([
    env.DB.prepare("SELECT data FROM rows ORDER BY date DESC"),
    env.DB.prepare("SELECT data FROM statements"),
    env.DB.prepare("SELECT key, value FROM meta"),
    env.DB.prepare("SELECT row_id, tags, descr, updated_at FROM overrides"),
    env.DB.prepare("SELECT payee_key, tags, descr, created_at FROM rules"),
  ]);
  const m = Object.fromEntries((meta.results as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const byRow = new Map((ovr.results as { row_id: string; tags: string; descr: string | null; updated_at: string }[])
    .map((o) => [o.row_id, o]));
  const byPayee = new Map((rules.results as { payee_key: string; tags: string; descr: string | null; created_at: string }[])
    .map((r) => [r.payee_key, r]));

  const out = (rows.results as { data: string }[]).map(({ data }) => {
    const r = JSON.parse(data) as Row;
    const o = byRow.get(r.id);
    if (o) {
      return { ...r, tags: JSON.parse(o.tags), desc: o.descr ?? r.desc, status: "confirmed" as Status,
        why: `You tagged this on ${o.updated_at.slice(0, 10)}.` };
    }
    const rule = r.status === "needs" ? byPayee.get(r.payee_key) : undefined;
    if (rule) {
      return { ...r, tags: JSON.parse(rule.tags), desc: rule.descr ?? r.desc, status: "confirmed" as Status,
        why: `Your rule for ${r.payee}, made on ${rule.created_at.slice(0, 10)}.` };
    }
    return r;
  });
  return {
    generated_at: m.generated_at ?? null,
    sources: m.sources ? JSON.parse(m.sources) : [],
    statements: (stmts.results as { data: string }[]).map((s) => JSON.parse(s.data)),
    rows: out,
  };
}

export interface TagBody { row_ids?: unknown; tags?: unknown; desc?: unknown; always?: unknown }

/** Tag one or more rows. `always` also saves a rule for each row's payee. */
export async function tag(env: Env, b: TagBody): Promise<number> {
  const ids = b.row_ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || !ids.every((i) => typeof i === "string")
      || !Array.isArray(b.tags) || !b.tags.every((t) => typeof t === "string")) {
    throw new Error("row_ids[] and tags[] required");
  }
  const tags = (b.tags as string[]).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 6);
  if (!tags.length) throw new Error("at least one tag");
  const desc = typeof b.desc === "string" && b.desc.trim() ? b.desc.trim().slice(0, 120) : null;
  const now = new Date().toISOString();
  const found = await env.DB.prepare(
    "SELECT id, payee_key, json_extract(data, '$.payee') AS payee FROM rows WHERE id IN (SELECT value FROM json_each(?))",
  ).bind(JSON.stringify(ids)).all<{ id: string; payee_key: string; payee: string }>();
  if (found.results.length !== ids.length) throw new Error("unknown row id");
  const stmts = [env.DB.prepare(
    `INSERT OR REPLACE INTO overrides (row_id, tags, descr, updated_at)
     SELECT value, ?, ?, ? FROM json_each(?)`,
  ).bind(JSON.stringify(tags), desc, now, JSON.stringify(ids))];
  if (b.always === true) {
    const payees = new Map(found.results.map((r) => [r.payee_key, r.payee]));
    for (const [key, payee] of payees) {
      stmts.push(env.DB.prepare(
        "INSERT OR REPLACE INTO rules (payee_key, tags, descr, payee, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(key, JSON.stringify(tags), desc, payee, now));
    }
  }
  await env.DB.batch(stmts);
  return ids.length;
}
