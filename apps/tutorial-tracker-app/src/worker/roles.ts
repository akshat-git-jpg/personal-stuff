/**
 * roles.ts
 * Email → role(s) lookup from the Employes tab of the tracker sheet.
 *
 * Responsibilities (one only):
 *   - Read Employes!A2:C, build a validated email→roles map.
 *   - Return the role(s) for a given email, or null/[] if unknown / invalid role.
 *
 * A person can hold MULTIPLE roles — the "Role" cell is comma-separated,
 * e.g. "Script Writer, Tutorial Maker".
 *
 * KV caching is intentionally NOT here — that is wired in Task 6.
 */

// Role names come from the ENGINE, which spans every pipeline. The old
// source (legacy POLICY keys) only knew the standard system, so a Tut-2-only
// role would have been rejected as invalid.
import { allRoles } from "../shared/engine/registry";
import { sheetsGet } from "./sheets";

// The set of valid role names comes from the engine's pipeline definitions.
const VALID_ROLES = new Set(allRoles());
/** Valid role names across every pipeline — team-management validation + UI. */
export const VALID_ROLE_NAMES: string[] = allRoles();

const EMPLOYEES_RANGE = "Employes!A2:C";

// ---------------------------------------------------------------------------
// parseRoles
// ---------------------------------------------------------------------------

/**
 * Parse a comma-separated Role cell into an array of validated role names.
 * Roles no pipeline defines are silently dropped.
 */
export function parseRoles(cell: string): string[] {
  return cell
    .split(",")
    .map(r => r.trim())
    .filter(r => r !== "" && VALID_ROLES.has(r));
}

// ---------------------------------------------------------------------------
// loadRolesMap  (new — email → roles[])
// ---------------------------------------------------------------------------

/**
 * Read the Employes tab (columns: Name, Email, Role) and build a map of
 * `email.toLowerCase().trim()` → validated roles array.
 *
 * - Rows with empty email or empty role are skipped silently.
 * - Rows whose Role contains no valid role name are skipped with a console.warn.
 */
export async function loadRolesMap(
  token: string,
  sheetId: string,
): Promise<Map<string, string[]>> {
  const rows = await sheetsGet(token, sheetId, EMPLOYEES_RANGE);
  const map = new Map<string, string[]>();

  for (const row of rows) {
    // Columns: A=Name (0), B=Email (1), C=Role (2)
    const email = (row[1] ?? "").trim();
    const roleCell = (row[2] ?? "").trim();

    if (email === "" || roleCell === "") continue;

    const roles = parseRoles(roleCell);
    if (roles.length === 0) {
      console.warn(
        `[roles] No valid roles found in "${roleCell}" for email "${email}" — skipping (typo in sheet?)`
      );
      continue;
    }

    map.set(email.toLowerCase(), roles);
  }

  return map;
}

// ---------------------------------------------------------------------------
// lookupRoles  (new — returns full roles array)
// ---------------------------------------------------------------------------

/**
 * Return the validated roles array for `email` (case-insensitive).
 * Returns an empty array if the email is absent or has no valid roles.
 */
export async function lookupRoles(
  token: string,
  sheetId: string,
  email: string,
): Promise<string[]> {
  const map = await loadRolesMap(token, sheetId);
  return map.get(email.toLowerCase().trim()) ?? [];
}

// ---------------------------------------------------------------------------
// loadRoleMap  (back-compat — email → first role string)
// ---------------------------------------------------------------------------

/**
 * Read the Employes tab (columns: Name, Email, Role) and build a map of
 * `email.toLowerCase().trim()` → first validated role string.
 *
 * - Rows with empty email or empty role are skipped silently.
 * - Rows whose Role is not a known role are skipped with a console.warn.
 *
 * @deprecated Use loadRolesMap for multi-role support.
 */
export async function loadRoleMap(
  token: string,
  sheetId: string,
): Promise<Map<string, string>> {
  const rolesMap = await loadRolesMap(token, sheetId);
  const map = new Map<string, string>();
  for (const [email, roles] of rolesMap) {
    map.set(email, roles[0]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// lookupRole  (back-compat — returns first role string or null)
// ---------------------------------------------------------------------------

/**
 * Return the validated role for `email` (case-insensitive), or `null` if the
 * email is absent from the sheet or mapped to no valid roles.
 *
 * @deprecated Use lookupRoles for multi-role support.
 */
export async function lookupRole(
  token: string,
  sheetId: string,
  email: string,
): Promise<string | null> {
  const roles = await lookupRoles(token, sheetId, email);
  return roles.length > 0 ? roles[0] : null;
}

// ---------------------------------------------------------------------------
// loadTeam
// ---------------------------------------------------------------------------

export interface TeamMember {
  name: string;
  email: string;
  role: string;   // raw cell (or first valid role) — for display
  roles?: string[]; // all parsed roles (union across systems)
  /** Per-system membership: systemId (or "*" for cross-system Admin) → roles there. */
  memberships?: Record<string, string[]>;
}

/**
 * Read the Employes tab (columns: Name, Email, Role) and return an array of
 * team members — only rows with a non-empty email AND at least one valid role
 * by a pipeline. The email is trimmed/lowercased.
 */
export async function loadTeam(
  token: string,
  sheetId: string,
): Promise<TeamMember[]> {
  const rows = await sheetsGet(token, sheetId, EMPLOYEES_RANGE);
  const members: TeamMember[] = [];

  for (const row of rows) {
    // Columns: A=Name (0), B=Email (1), C=Role (2)
    const name     = (row[0] ?? "").trim();
    const email    = (row[1] ?? "").trim();
    const roleCell = (row[2] ?? "").trim();

    if (email === "" || roleCell === "") continue;

    const roles = parseRoles(roleCell);
    if (roles.length === 0) continue;

    members.push({ name, email: email.toLowerCase(), role: roles[0], roles });
  }

  return members;
}
