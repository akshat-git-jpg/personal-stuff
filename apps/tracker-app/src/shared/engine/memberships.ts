// ===========================================================================
// SYSTEM-SCOPED MEMBERSHIP MODEL
//
// An employee's authority is a set of per-system memberships: for each system
// they belong to, the roles they hold there. The key insight that keeps the rest
// of the RBAC engine unchanged: authority is always evaluated FOR ONE CARD, and a
// card knows its system — so we collapse the membership set into the "effective
// roles in this system" and feed those to the existing role-based checks.
//
// Rules (enforced where memberships are WRITTEN, not here):
//   • a doer role is held in exactly ONE system
//   • the Reviewer role may be held in several systems (queue spans them)
//   • Admin is cross-system — stored under the WILDCARD_SYSTEM ("*") key, so it
//     applies to every system, including ones added later
// ===========================================================================
import { WILDCARD_SYSTEM, ADMIN_ROLE, isDoerRole } from "./registry";

/** systemId (or "*") → roles held in that system. */
export type Memberships = Record<string, string[]>;

const uniq = (xs: string[]) => [...new Set(xs)];

/** The roles a user effectively holds when acting on a card of `systemId`:
 *  their roles in that system plus any cross-system ("*") roles (Admin). */
export function effectiveRoles(m: Memberships, systemId: string): string[] {
  return uniq([...(m[WILDCARD_SYSTEM] ?? []), ...(m[systemId] ?? [])]);
}

/** The union of every role across every system — for UI tab visibility and the
 *  approver/admin gating that isn't tied to one card. */
export function unionRoles(m: Memberships): string[] {
  return uniq(Object.values(m).flat());
}

/** Does this user hold `role` in `systemId` (counting cross-system roles)? */
export function holdsRoleInSystem(m: Memberships, systemId: string, role: string): boolean {
  return effectiveRoles(m, systemId).includes(role);
}

/** Real systems (excludes "*") where the user holds `role`. */
export function systemsForRole(m: Memberships, role: string): string[] {
  return Object.keys(m).filter((sys) => sys !== WILDCARD_SYSTEM && (m[sys] ?? []).includes(role));
}

/** Synthesize a membership set from a flat role list (dev bypass / fallback only):
 *  doer + Reviewer roles land in `systemId`, Admin becomes a cross-system "*" role. */
export function membershipsFromRoles(roles: string[], systemId: string): Memberships {
  const m: Memberships = {};
  const scoped = roles.filter((r) => r !== ADMIN_ROLE);
  if (scoped.length) m[systemId] = uniq(scoped);
  if (roles.includes(ADMIN_ROLE)) m[WILDCARD_SYSTEM] = [ADMIN_ROLE];
  return m;
}

/** The single system a user does doer work in, if any (the "home system"). The
 *  write path guarantees doer roles live in at most one system, so the first hit
 *  is authoritative. */
export function homeSystem(m: Memberships): string | undefined {
  for (const [sys, roles] of Object.entries(m)) {
    if (sys === WILDCARD_SYSTEM) continue;
    if (roles.some(isDoerRole)) return sys;
  }
  return undefined;
}
