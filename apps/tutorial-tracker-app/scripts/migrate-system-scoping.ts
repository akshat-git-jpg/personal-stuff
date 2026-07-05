/**
 * Migration: GLOBAL employees + defaults → SYSTEM-SCOPED.
 *
 * Turns the flat `employees` table (email PK, comma-joined global roles) into a
 * membership-grained table (one row per email × system) and adds `pipeline_id` to
 * `assignment_defaults`. Existing people are placed in the DEFAULT system
 * (`standard` — the only live doer pipeline); the Admin role becomes a
 * cross-system "*" membership; everything else (doer roles + Reviewer) lands in
 * standard. Reviewers can later be added to more systems from the Team tab.
 *
 * It does NOT touch the DB itself — feed it the current employees as JSON so the
 * step is reviewable. Produce the input + apply the output with:
 *
 *   # 1. dump the current employees table
 *   npx wrangler d1 execute tracker-db --remote --json \
 *     --command "SELECT email, name, role FROM employees" > /tmp/emp.json
 *
 *   # 2. generate the migration SQL
 *   npx tsx scripts/migrate-system-scoping.ts /tmp/emp.json > /tmp/system-scoping.sql
 *
 *   # 3. review, then apply
 *   npx wrangler d1 execute tracker-db --remote --file=/tmp/system-scoping.sql
 *
 * Safe + idempotent-ish: it renames the old tables to *_legacy (kept as backups)
 * rather than dropping them. Re-applying would fail on the second rename — restore
 * from *_legacy first if you need to re-run.
 */
import { readFileSync } from "node:fs";
import { DEFAULT_PIPELINE_ID, WILDCARD_SYSTEM, ADMIN_ROLE } from "../src/shared/engine/registry";

const q = (v: unknown) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

interface EmpRow { email?: string; name?: string; role?: string }

function loadRows(path: string): EmpRow[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(raw) && raw.length && "results" in raw[0]) return raw.flatMap((r: { results: EmpRow[] }) => r.results ?? []);
  if (Array.isArray(raw)) return raw as EmpRow[];
  if (raw && Array.isArray(raw.results)) return raw.results as EmpRow[];
  throw new Error("Unrecognized input JSON shape");
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx scripts/migrate-system-scoping.ts <employees.json>");
  const rows = loadRows(path);
  const out: string[] = [];

  // --- employees → membership-grained ------------------------------------
  out.push("ALTER TABLE employees RENAME TO employees_legacy;");
  out.push(`CREATE TABLE employees (
  email TEXT NOT NULL, system_id TEXT NOT NULL, name TEXT, role TEXT,
  PRIMARY KEY (email, system_id)
);`);

  let memberships = 0;
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    const name = (r.name ?? "").trim();
    if (!email) continue;
    const roles = (r.role ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const scoped = roles.filter((x) => x !== ADMIN_ROLE);     // doers + Reviewer → standard
    if (scoped.length) {
      out.push(`INSERT INTO employees (email, system_id, name, role) VALUES (${q(email)}, ${q(DEFAULT_PIPELINE_ID)}, ${q(name)}, ${q(scoped.join(", "))});`);
      memberships++;
    }
    if (roles.includes(ADMIN_ROLE)) {                          // Admin → cross-system "*"
      out.push(`INSERT INTO employees (email, system_id, name, role) VALUES (${q(email)}, ${q(WILDCARD_SYSTEM)}, ${q(name)}, ${q(ADMIN_ROLE)});`);
      memberships++;
    }
  }

  // --- assignment_defaults → add pipeline_id (rebuild) -------------------
  out.push("ALTER TABLE assignment_defaults RENAME TO assignment_defaults_legacy;");
  out.push(`CREATE TABLE assignment_defaults (
  pipeline_id TEXT NOT NULL DEFAULT '${DEFAULT_PIPELINE_ID}', category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '', col TEXT NOT NULL, email TEXT NOT NULL,
  PRIMARY KEY (pipeline_id, category, subcategory, col)
);`);
  out.push(`INSERT INTO assignment_defaults (pipeline_id, category, subcategory, col, email)
  SELECT '${DEFAULT_PIPELINE_ID}', category, subcategory, col, email FROM assignment_defaults_legacy;`);

  process.stderr.write(`-- migrated ${rows.length} employees → ${memberships} membership rows; assignment_defaults gained pipeline_id\n`);
  process.stdout.write(out.join("\n") + "\n");
}

main();
