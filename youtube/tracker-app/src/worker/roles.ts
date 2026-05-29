/**
 * roles.ts
 * Email → role lookup from the Employes tab of the tracker sheet.
 *
 * Responsibilities (one only):
 *   - Read Employes!A2:C, build a validated email→role map.
 *   - Return the role for a given email, or null if unknown / invalid role.
 *
 * KV caching is intentionally NOT here — that is wired in Task 6.
 */

import { POLICY } from "../shared/policy";
import { sheetsGet } from "./sheets";

// The set of valid role names comes from POLICY keys.
const VALID_ROLES = new Set(Object.keys(POLICY));

const EMPLOYEES_RANGE = "Employes!A2:C";

// ---------------------------------------------------------------------------
// loadRoleMap
// ---------------------------------------------------------------------------

/**
 * Read the Employes tab (columns: Name, Email, Role) and build a map of
 * `email.toLowerCase().trim()` → validated role string.
 *
 * - Rows with empty email or empty role are skipped silently.
 * - Rows whose Role is not a key in POLICY are skipped with a console.warn.
 */
export async function loadRoleMap(
  token: string,
  sheetId: string,
): Promise<Map<string, string>> {
  const rows = await sheetsGet(token, sheetId, EMPLOYEES_RANGE);
  const map = new Map<string, string>();

  for (const row of rows) {
    // Columns: A=Name (0), B=Email (1), C=Role (2)
    const email = (row[1] ?? "").trim();
    const role = (row[2] ?? "").trim();

    if (email === "" || role === "") continue;

    if (!VALID_ROLES.has(role)) {
      console.warn(
        `[roles] Unknown role "${role}" for email "${email}" — skipping (typo in sheet?)`
      );
      continue;
    }

    map.set(email.toLowerCase(), role);
  }

  return map;
}

// ---------------------------------------------------------------------------
// lookupRole
// ---------------------------------------------------------------------------

/**
 * Return the validated role for `email` (case-insensitive), or `null` if the
 * email is absent from the sheet or mapped to an invalid role.
 */
export async function lookupRole(
  token: string,
  sheetId: string,
  email: string,
): Promise<string | null> {
  const map = await loadRoleMap(token, sheetId);
  return map.get(email.toLowerCase().trim()) ?? null;
}

// ---------------------------------------------------------------------------
// loadTeam
// ---------------------------------------------------------------------------

export interface TeamMember {
  name: string;
  email: string;
  role: string;
}

/**
 * Read the Employes tab (columns: Name, Email, Role) and return an array of
 * team members — only rows with a non-empty email AND a role that exists in
 * POLICY. The email is trimmed/lowercased.
 */
export async function loadTeam(
  token: string,
  sheetId: string,
): Promise<TeamMember[]> {
  const rows = await sheetsGet(token, sheetId, EMPLOYEES_RANGE);
  const members: TeamMember[] = [];

  for (const row of rows) {
    // Columns: A=Name (0), B=Email (1), C=Role (2)
    const name  = (row[0] ?? "").trim();
    const email = (row[1] ?? "").trim();
    const role  = (row[2] ?? "").trim();

    if (email === "" || role === "") continue;
    if (!VALID_ROLES.has(role)) continue;

    members.push({ name, email: email.toLowerCase(), role });
  }

  return members;
}
