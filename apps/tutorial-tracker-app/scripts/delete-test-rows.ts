/**
 * [DEPRECATED 2026-06-19] Operates directly on the Google SHEET (Master tab).
 * The app moved to D1 (DATA_BACKEND=d1) — delete cards via the app's 🗑 button
 * instead. Only relevant if you flip back to the Sheets fallback backend.
 *
 * Delete every Master row whose video_title starts with "test" (case-insensitive).
 *   npx tsx scripts/delete-test-rows.ts            # dry run — lists matches
 *   npx tsx scripts/delete-test-rows.ts --apply    # actually delete
 */
import { readFileSync } from "node:fs";
import { getAccessToken, sheetsGet } from "../src/worker/sheets";
import { colLetter } from "../src/worker/google-jwt";
import { COLUMNS } from "../src/shared/columns";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TAB = "Master";

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

async function gridId(token: string, sheetId: string): Promise<number> {
  const resp = await fetch(`${SHEETS_BASE}/${sheetId}?fields=sheets.properties(sheetId,title)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await resp.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };
  const found = json.sheets?.find((s) => s.properties?.title === TAB);
  if (!found?.properties || found.properties.sheetId == null) throw new Error(`Tab "${TAB}" not found`);
  return found.properties.sheetId;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = loadDevVars();
  if (!env.SHEET_ID || !env.GOOGLE_SA_JSON) throw new Error("SHEET_ID / GOOGLE_SA_JSON not set");
  const token = await getAccessToken(env.GOOGLE_SA_JSON);

  const raw = await sheetsGet(token, env.SHEET_ID, `${TAB}!A1:${colLetter(COLUMNS.length + 4)}999`);
  const header = (raw[0] ?? []).map((h) => h.trim());
  const titleIdx = header.indexOf("video_title");
  if (titleIdx === -1) throw new Error("video_title column not found");

  // Match by exact title via --title "…", otherwise default to prefix "test".
  const titleArg = process.argv.find((a) => a.startsWith("--title="));
  const exact = titleArg ? titleArg.slice("--title=".length).trim().toLowerCase() : null;
  const test = (title: string) =>
    exact !== null ? title.toLowerCase() === exact : title.toLowerCase().startsWith("test");

  // 0-based grid row indices (header is grid row 0).
  const matches: { gridRow: number; title: string }[] = [];
  for (let i = 1; i < raw.length; i++) {
    const title = (raw[i]?.[titleIdx] ?? "").trim();
    if (test(title)) matches.push({ gridRow: i, title });
  }

  console.log(`Found ${matches.length} row(s) matching ${exact !== null ? `"${exact}"` : 'prefix "test"'}:`);
  for (const m of matches) console.log(`  - ${m.title}`);
  if (matches.length === 0) return;
  if (!apply) { console.log('\nDry run. Re-run with --apply to delete.'); return; }

  const gid = await gridId(token, env.SHEET_ID);
  // Delete bottom-up so earlier indices stay valid as rows shift.
  const requests = matches
    .sort((a, b) => b.gridRow - a.gridRow)
    .map((m) => ({ deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: m.gridRow, endIndex: m.gridRow + 1 } } }));

  const resp = await fetch(`${SHEETS_BASE}/${env.SHEET_ID}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!resp.ok) throw new Error(`batchUpdate failed (${resp.status}): ${await resp.text()}`);
  console.log(`\n✓ Deleted ${matches.length} row(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
