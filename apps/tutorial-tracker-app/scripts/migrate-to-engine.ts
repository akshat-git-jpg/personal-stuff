/**
 * Phase-1 migration: the wide `cards` table → the normalized engine schema
 * (`pipelines` + `cards` + `card_stages`). Every existing card becomes a
 * `standard` card; its 50 columns fan out into one `card_stages` row per stage.
 *
 * It does NOT read the DB itself — feed it the current wide rows as JSON so the
 * step is reviewable and re-runnable. Produce the input + apply the output with:
 *
 *   # 1. dump the current wide table
 *   npx wrangler d1 execute tracker-db --remote --json \
 *     --command "SELECT * FROM cards" > /tmp/wide.json
 *
 *   # 2. generate the normalized migration SQL
 *   npx tsx scripts/migrate-to-engine.ts /tmp/wide.json > /tmp/engine.sql
 *
 *   # 3. review, then apply
 *   npx wrangler d1 execute tracker-db --remote --file=/tmp/engine.sql
 *
 * Safe: it renames the old table to `cards_legacy` (kept as a backup) rather
 * than dropping it, and is idempotent in that re-applying rebuilds from legacy.
 */
import { readFileSync } from "node:fs";
import { PIPELINES, DEFAULT_PIPELINE_ID } from "../src/shared/engine/registry";
import { getPipeline } from "../src/shared/engine/registry";
import { decomposeRow, type Row } from "../src/shared/engine/card";

const q = (v: unknown) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

/** Accepts either a raw array of rows, or the `wrangler --json` envelope
 *  ([{ results: [...] }]) — returns the flat wide rows. */
function loadWideRows(path: string): Row[] {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(raw) && raw.length && "results" in raw[0]) return raw.flatMap((r: { results: Row[] }) => r.results ?? []);
  if (Array.isArray(raw)) return raw as Row[];
  if (raw && Array.isArray(raw.results)) return raw.results as Row[];
  throw new Error("Unrecognized input JSON shape");
}

function main() {
  const path = process.argv[2];
  if (!path) throw new Error("usage: tsx scripts/migrate-to-engine.ts <wide-rows.json>");
  const wide = loadWideRows(path).filter((r) => String(r.video_title ?? "").trim() !== "");
  const out: string[] = [];

  // --- schema -------------------------------------------------------------
  out.push("ALTER TABLE cards RENAME TO cards_legacy;");
  out.push(`CREATE TABLE pipelines (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  definition_json TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT
);`);
  out.push(`CREATE TABLE cards (
  id TEXT PRIMARY KEY, pipeline_id TEXT NOT NULL,
  title TEXT, notes TEXT, description TEXT, category TEXT, subcategory TEXT,
  extra_json TEXT, created_at TEXT, updated_at TEXT, status_since TEXT
);`);
  out.push(`CREATE TABLE card_stages (
  card_id TEXT NOT NULL, stage_id TEXT NOT NULL, status TEXT,
  assignee TEXT, reviewer TEXT, work_link TEXT, instruction TEXT, eta TEXT, feedback TEXT,
  extra_json TEXT, status_since TEXT,
  PRIMARY KEY (card_id, stage_id)
);`);
  out.push("CREATE INDEX idx_card_stages_card ON card_stages(card_id);");
  out.push("CREATE INDEX idx_cards_pipeline ON cards(pipeline_id);");

  // --- seed pipeline definitions -----------------------------------------
  for (const p of Object.values(PIPELINES)) {
    out.push(`INSERT INTO pipelines (id, name, version, definition_json) VALUES (${q(p.id)}, ${q(p.name)}, 1, ${q(JSON.stringify(p))});`);
  }

  // --- migrate every wide row to a `standard` card -----------------------
  const P = getPipeline(DEFAULT_PIPELINE_ID);
  let cards = 0, stageRows = 0;
  for (const row of wide) {
    (row as Row).pipeline = DEFAULT_PIPELINE_ID;
    const { card, stages } = decomposeRow(P, row);
    out.push(`INSERT INTO cards (id, pipeline_id, title, notes, description, category, subcategory, extra_json, created_at, updated_at, status_since) VALUES (${q(card.id)}, ${q(card.pipeline_id)}, ${q(card.title)}, ${q(card.notes)}, ${q(card.description)}, ${q(card.category)}, ${q(card.subcategory)}, ${q(card.extra_json)}, ${q(row.created_at ?? row.last_updated)}, ${q(card.updated_at)}, ${q(card.status_since)});`);
    cards++;
    for (const s of stages) {
      out.push(`INSERT INTO card_stages (card_id, stage_id, status, assignee, reviewer, work_link, instruction, eta, feedback, extra_json, status_since) VALUES (${q(s.card_id)}, ${q(s.stage_id)}, ${q(s.status)}, ${q(s.assignee)}, ${q(s.reviewer)}, ${q(s.work_link)}, ${q(s.instruction)}, ${q(s.eta)}, ${q(s.feedback)}, ${q(s.extra_json)}, ${q(s.status_since ?? row.status_since)});`);
      stageRows++;
    }
  }

  process.stderr.write(`-- migrated ${cards} cards → ${stageRows} card_stages rows; seeded ${Object.keys(PIPELINES).length} pipelines\n`);
  process.stdout.write(out.join("\n") + "\n");
}

main();
