/**
 * smoke-roles.ts — smoke test for the roles lookup module.
 * Reads SA creds from the gitignored credentials.json path.
 *
 * Run with:   npx tsx scripts/smoke-roles.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Resolve paths (same pattern as smoke-sheets.ts)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const CREDS_PATH = resolve(__dirname, "../../../credentials.json");

const GOOGLE_SA_JSON = readFileSync(CREDS_PATH, "utf-8");
const SHEET_ID = "1jlogtb33vjgjvKMHZjrEs3M9lV8Jg3zWSv0wzp6xAmI";

// ---------------------------------------------------------------------------
// Import roles module
// ---------------------------------------------------------------------------
import { getAccessToken } from "../src/worker/sheets.js";
import { loadRoleMap, lookupRole } from "../src/worker/roles.js";

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------
function assertEqual<T>(label: string, actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(
      `ASSERTION FAILED — ${label}\n  expected: ${JSON.stringify(expected)}\n  got:      ${JSON.stringify(actual)}`
    );
  }
  console.log(`   PASS  ${label}: ${JSON.stringify(actual)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Smoke Test: Roles Lookup ===\n");

  // 1. Mint token
  console.log("1. Minting access token...");
  const token = await getAccessToken(GOOGLE_SA_JSON);
  console.log(`   Token obtained (length=${token.length}, prefix=${token.slice(0, 20)}...)\n`);

  // 2. Load and print the full role map
  console.log("2. Loading role map from Employes tab...");
  const map = await loadRoleMap(token, SHEET_ID);
  console.log(`   Entries loaded: ${map.size}`);
  for (const [email, role] of map) {
    console.log(`     ${email}  →  ${role}`);
  }
  console.log();

  // 3. Assertions
  console.log("3. Running assertions...");

  // Known user — lowercase email
  const role1 = await lookupRole(token, SHEET_ID, "akshatpatidar17@gmail.com");
  assertEqual("lookupRole(akshatpatidar17@gmail.com)", role1, "Editor");

  // Case-insensitive check (all-uppercase input)
  const role2 = await lookupRole(token, SHEET_ID, "AKSHATPATIDAR17@GMAIL.COM");
  assertEqual("lookupRole(AKSHATPATIDAR17@GMAIL.COM)", role2, "Editor");

  // Unknown email — must return null
  const role3 = await lookupRole(token, SHEET_ID, "nobody@example.com");
  assertEqual("lookupRole(nobody@example.com)", role3, null);

  console.log("\n=== SMOKE TEST PASSED ===");
}

main().catch((err) => {
  console.error("\nSMOKE TEST FAILED:", err);
  process.exit(1);
});
