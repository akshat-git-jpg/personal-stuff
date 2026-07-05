/**
 * One-time data migration: Google Sheets → D1 (the `tracker-db` database).
 * Reads the Master + Employes tabs and emits a SQL file (schema + seed inserts)
 * to stdout. Apply it with wrangler:
 *
 *   npx tsx scripts/migrate-to-d1.ts > /tmp/d1-seed.sql
 *   npx wrangler d1 execute tracker-db --remote --file=/tmp/d1-seed.sql
 *
 * Idempotent in the sense that it DROPs + recreates the tables — it's a seed,
 * meant to run ONCE at cutover. Don't re-run it after going live on D1 (it would
 * wipe D1-side changes). Reads SHEET_ID + GOOGLE_SA_JSON from .dev.vars / env.
 */
import { readFileSync } from "node:fs";
import { getAccessToken, readRows } from "../src/worker/sheets";
import { loadTeam } from "../src/worker/roles";
import { COLUMNS } from "../src/shared/columns";

function loadDevVars(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    for (const line of readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* rely on env */ }
  return out;
}

const q = (v: unknown) => `'${String(v ?? "").replace(/'/g, "''")}'`;

async function main() {
  const env = loadDevVars();
  if (!env.SHEET_ID) throw new Error("SHEET_ID not set");
  if (!env.GOOGLE_SA_JSON) throw new Error("GOOGLE_SA_JSON not set");
  const token = await getAccessToken(env.GOOGLE_SA_JSON);

  const [rows, team] = await Promise.all([
    readRows(token, env.SHEET_ID),
    loadTeam(token, env.SHEET_ID),
  ]);

  // NB: no explicit BEGIN/COMMIT — wrangler d1 execute wraps the file in its own
  // transaction, and D1 rejects raw BEGIN TRANSACTION statements.
  const out: string[] = [];

  // --- cards table (one TEXT column per COLUMNS; row_id is the PK) ---
  out.push("DROP TABLE IF EXISTS cards;");
  const colDefs = COLUMNS.map((c) => (c === "row_id" ? `"${c}" TEXT PRIMARY KEY` : `"${c}" TEXT`));
  out.push(`CREATE TABLE cards (\n  ${colDefs.join(",\n  ")}\n);`);
  for (const r of rows) {
    const vals = COLUMNS.map((c) => q((r as Record<string, string>)[c] ?? ""));
    out.push(`INSERT INTO cards (${COLUMNS.map((c) => `"${c}"`).join(", ")}) VALUES (${vals.join(", ")});`);
  }

  // --- employees table (email PK, name, comma-joined validated roles) ---
  out.push("DROP TABLE IF EXISTS employees;");
  out.push(`CREATE TABLE employees (\n  email TEXT PRIMARY KEY,\n  name TEXT,\n  role TEXT\n);`);
  for (const m of team) {
    const roleCell = (m.roles ?? [m.role]).filter(Boolean).join(", ");
    out.push(`INSERT INTO employees (email, name, role) VALUES (${q(m.email.toLowerCase())}, ${q(m.name)}, ${q(roleCell)});`);
  }

  process.stdout.write(out.join("\n") + "\n");
  process.stderr.write(`-- generated: ${rows.length} cards, ${team.length} employees\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
