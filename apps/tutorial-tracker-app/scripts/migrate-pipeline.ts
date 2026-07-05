/**
 * [DEPRECATED 2026-06-19] Migrates the Google SHEET schema (+ Access mirror tab).
 * The app moved to D1 (DATA_BACKEND=d1); this only matters in the Sheets fallback
 * mode, and the sheet is already migrated. Kept for that fallback case only.
 *
 * One-shot migration for the 2026 pipeline refactor. Idempotent — safe to re-run.
 *
 *   npx tsx scripts/migrate-pipeline.ts          # against SHEET_ID in .dev.vars
 *   SHEET_ID=<id> npx tsx scripts/migrate-pipeline.ts
 *
 * It:
 *   1. adds the new Master headers (ideator_email, uploader_email, topic_feedback)
 *   2. maps legacy status values to the unified lifecycle
 *        topic_status:     Ready     -> Done
 *        yt_upload_status: Published -> Uploaded,  Draft -> In Progress
 *   3. renames legacy roles in the Employes tab
 *        "Script Writer"  -> "Scriptwriter"
 *        "Tutorial Maker" -> "Recorder"
 *   4. regenerates the Access tab as a read-only mirror of the code policy
 *
 * It NEVER deletes data and only writes cells whose value actually changes.
 */
import { readFileSync } from "node:fs";
import { getAccessToken, sheetsGet, ensureColumns } from "../src/worker/sheets";
import { colLetter } from "../src/worker/google-jwt";
import { COLUMNS } from "../src/shared/columns";
import { POLICY } from "../src/shared/policy";
import { ALL_ROLES } from "../src/shared/pipeline";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function loadDevVars(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    for (const line of readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* no .dev.vars — rely on env */ }
  return out;
}

interface ValueRange { range: string; values: string[][]; }

/** One batched write for many ranges — avoids the 60 writes/min per-cell limit. */
async function batchUpdate(token: string, sheetId: string, data: ValueRange[]): Promise<void> {
  if (data.length === 0) return;
  const url = `${SHEETS_BASE}/${sheetId}/values:batchUpdate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  if (!resp.ok) throw new Error(`batchUpdate failed (${resp.status}): ${await resp.text()}`);
}

const STATUS_MAP: Record<string, Record<string, string>> = {
  topic_status: { Ready: "Done" },
  yt_upload_status: { Published: "Uploaded", Draft: "In Progress" },
};
const ROLE_MAP: Record<string, string> = { "Script Writer": "Scriptwriter", "Tutorial Maker": "Recorder" };

async function main() {
  const env = loadDevVars();
  const sheetId = env.SHEET_ID;
  if (!sheetId) throw new Error("SHEET_ID not set (in .dev.vars or env)");
  if (!env.GOOGLE_SA_JSON) throw new Error("GOOGLE_SA_JSON not set");
  const token = await getAccessToken(env.GOOGLE_SA_JSON);
  console.log(`Migrating sheet ${sheetId}…`);

  // 1) Add missing columns.
  const added = await ensureColumns(token, sheetId);
  console.log(added.length ? `+ added columns: ${added.join(", ")}` : "✓ all columns already present");

  const updates: ValueRange[] = [];

  // 2) Migrate Master status values.
  const range = `Master!A1:${colLetter(COLUMNS.length + 4)}999`;
  const raw = await sheetsGet(token, sheetId, range);
  const header = (raw[0] ?? []).map((h) => h.trim());
  let cellChanges = 0;
  for (const [col, map] of Object.entries(STATUS_MAP)) {
    const idx = header.indexOf(col);
    if (idx === -1) continue;
    for (let i = 1; i < raw.length; i++) {
      const cur = (raw[i]?.[idx] ?? "").trim();
      const next = map[cur];
      if (next && next !== cur) {
        updates.push({ range: `Master!${colLetter(idx)}${i + 1}`, values: [[next]] });
        cellChanges++;
      }
    }
  }

  // 3) Rename legacy roles in Employes.
  const emp = await sheetsGet(token, sheetId, "Employes!A1:C999");
  let roleChanges = 0;
  for (let i = 1; i < emp.length; i++) {
    const cell = (emp[i]?.[2] ?? "").trim();
    if (!cell) continue;
    const renamed = cell.split(",").map((r) => { const t = r.trim(); return ROLE_MAP[t] ?? t; }).join(", ");
    if (renamed !== cell) {
      updates.push({ range: `Employes!C${i + 1}`, values: [[renamed]] });
      roleChanges++;
    }
  }

  await batchUpdate(token, sheetId, updates);
  console.log(`✓ status values migrated (${cellChanges} cell${cellChanges === 1 ? "" : "s"})`);
  console.log(`✓ Employes roles migrated (${roleChanges} row${roleChanges === 1 ? "" : "s"})`);

  // 4) Regenerate the Access mirror tab (best-effort, one write).
  try {
    const accessRows: string[][] = [["Column", ...ALL_ROLES]];
    for (const col of COLUMNS) {
      if (col === "row_id" || col === "last_updated") continue;
      const cells = ALL_ROLES.map((role) => {
        const p = POLICY[role];
        if (p?.all) return "Edit";
        const a = p?.access?.[col];
        return a === "edit" ? "Edit" : a === "view" ? "View" : "Hidden";
      });
      accessRows.push([col, ...cells]);
    }
    await batchUpdate(token, sheetId, [{ range: `Access!A1:${colLetter(ALL_ROLES.length)}${accessRows.length}`, values: accessRows }]);
    console.log(`✓ Access tab regenerated (${accessRows.length - 1} columns × ${ALL_ROLES.length} roles)`);
  } catch (e) {
    console.warn(`! skipped Access tab (${e instanceof Error ? e.message : e}) — create an "Access" tab to enable the mirror`);
  }

  console.log("\nDone. NOTE: ensureColumns adds any new headers (thumbnail_*, *_eta, status_since).");
  console.log("Assign the new Thumbnail Maker role to someone via the admin Team tab.");
}

main().catch((e) => { console.error(e); process.exit(1); });
