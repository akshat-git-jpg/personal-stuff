/**
 * smoke-sheets.ts — throwaway smoke test for the Google Sheets adapter.
 * Reads credentials from /Users/kbtg/codebase/TY/credentials.json (repo file, no secret inline).
 *
 * Run with:   npx tsx scripts/smoke-sheets.ts
 *
 * Node 20+ has globalThis.crypto.subtle + fetch, so Worker-standard code runs as-is.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDS_PATH = resolve(__dirname, "../../../credentials.json");

const GOOGLE_SA_JSON = readFileSync(CREDS_PATH, "utf-8");
const SHEET_ID = "1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI";

// ---------------------------------------------------------------------------
// Import adapter (path relative to this script location)
// ---------------------------------------------------------------------------
// We import using the src/ path; tsx handles TS resolution
import { getAccessToken, ensureRowIds, readRows, updateCell } from "../src/worker/sheets.js";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Smoke Test: Google Sheets Adapter ===\n");

  // 1. Mint token
  console.log("1. Minting access token...");
  const token = await getAccessToken(GOOGLE_SA_JSON);
  console.log(`   Token obtained (length=${token.length}, prefix=${token.slice(0, 20)}...)\n`);

  // 2. ensureRowIds (idempotent migration)
  console.log("2. Running ensureRowIds (idempotent)...");
  await ensureRowIds(token, SHEET_ID);
  console.log("   ensureRowIds completed.\n");

  // 3. readRows
  console.log("3. Reading rows...");
  const rows = await readRows(token, SHEET_ID);
  console.log(`   Row count: ${rows.length}`);
  if (rows.length > 0) {
    const first = rows[0];
    console.log(`   First row keys: ${Object.keys(first).join(", ")}`);
    console.log(`   First row row_id: ${first.row_id ?? "(none)"}`);
    console.log(`   First row video_title: ${first.video_title ?? "(empty)"}`);
  } else {
    console.log("   No data rows found — sheet may be empty.");
    console.log("   Smoke test complete (nothing to write/verify).");
    return;
  }
  console.log();

  // 4. updateCell — write, verify, revert
  const firstRow = rows[0];
  const rowId = firstRow.row_id;
  if (!rowId) {
    console.log("   First row has no row_id — skipping write test.");
    return;
  }

  const testValue = `smoke-test-${Date.now()}`;
  const col = "video_notes";

  console.log(`4. Writing "${testValue}" to row_id=${rowId}, col=${col}...`);
  await updateCell(token, SHEET_ID, rowId, col, testValue);
  console.log("   Write complete.\n");

  console.log("5. Re-reading to verify value landed...");
  const rows2 = await readRows(token, SHEET_ID);
  const updated = rows2.find((r) => r.row_id === rowId);
  if (!updated) throw new Error(`Row ${rowId} disappeared after write — unexpected`);
  if (updated[col] !== testValue) {
    throw new Error(
      `Value mismatch: expected "${testValue}" but got "${updated[col]}"`,
    );
  }
  console.log(`   Verified: ${col} = "${updated[col]}"\n`);

  // 6. Revert — restore original value
  const originalValue = firstRow[col] ?? "";
  console.log(`6. Reverting ${col} back to "${originalValue}"...`);
  await updateCell(token, SHEET_ID, rowId, col, originalValue);
  console.log("   Reverted.\n");

  console.log("=== SMOKE TEST PASSED ===");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
