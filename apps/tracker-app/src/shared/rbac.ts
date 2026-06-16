import type { Column } from "./columns";
import { COLUMNS } from "./columns";
import { POLICY, APPROVER_ROLES, APPROVER_ONLY_VALUES, STAGE_OF_COL } from "./policy";
export type Row = Partial<Record<Column, string>>;

// ---------------------------------------------------------------------------
// Single-role helpers (kept for back-compat + direct use)
// ---------------------------------------------------------------------------

export function visibleColumns(role: string): Column[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.all) return [...COLUMNS];
  const acc = p.access ?? {};
  // row_id is always included for addressing/updates (UI hides it from display).
  return COLUMNS.filter(c => c === "row_id" || acc[c] !== undefined);
}

export function canEdit(role: string, col: Column): boolean {
  const p = POLICY[role]; if (!p) return false;
  if (p.all) return true;
  return (p.access?.[col]) === "edit";
}

export function filterRows(role: string, email: string, rows: Row[]): Row[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.rows === "all") return rows;
  const col = p.rows.match;
  const gate = p.rows.gate;
  const want = email.trim().toLowerCase();
  return rows.filter(r => {
    if ((r[col] || "").trim().toLowerCase() !== want) return false;
    // Gated handoff: only show the row once the upstream stage is complete.
    if (gate && (r[gate.col] || "").trim() !== gate.equals) return false;
    return true;
  });
}

export function projectRow(role: string, row: Row): Row {
  const out: Row = {};
  for (const c of visibleColumns(role)) out[c] = row[c];
  return out;
}

// Rows currently AT a role's stage, ignoring which specific person is assigned:
// the role's match column must be non-empty AND the upstream gate (if any) must pass.
export function stageRows(role: string, rows: Row[]): Row[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.rows === "all") return rows;
  const col = p.rows.match; const gate = p.rows.gate;
  return rows.filter(r => {
    if (!(r[col] || "").trim()) return false;
    if (gate && (r[gate.col] || "").trim() !== gate.equals) return false;
    return true;
  });
}

// Distinct non-empty assignee emails for a role (for the person filter):
export function peopleFor(role: string, rows: Row[]): string[] {
  const p = POLICY[role]; if (!p || p.rows === "all") return [];
  const col = p.rows.match;
  const set = new Set<string>();
  for (const r of rows) { const v = (r[col] || "").trim(); if (v) set.add(v); }
  return [...set].sort();
}

export function isApprover(role: string): boolean {
  return APPROVER_ROLES.has(role);
}

// Can this role set this column to this specific value?
export function canSetValue(role: string, col: Column, value: string): boolean {
  if (!canEdit(role, col)) return false;
  const restricted = APPROVER_ONLY_VALUES[col];
  if (restricted && restricted.includes(value) && !isApprover(role)) return false;
  return true;
}

// Is this row locked for this role? (a doer's row is locked once their owned
// stage is approved = "Done"). Approvers are never locked.
// Kept for back-compat; prefer isFieldLocked for multi-role accuracy.
export function isRowLockedFor(role: string, row: Row): boolean {
  if (isApprover(role)) return false;
  const p = POLICY[role]; if (!p) return true;
  const owned = p.laneStatus;
  return (row[owned] || "").trim() === "Done";
}

// ---------------------------------------------------------------------------
// Multi-role union helpers
// ---------------------------------------------------------------------------

/** Union of visible columns across all roles, preserving COLUMNS order. */
export function visibleColumnsForRoles(roles: string[]): Column[] {
  const visible = new Set<Column>();
  for (const role of roles) {
    for (const col of visibleColumns(role)) {
      visible.add(col);
    }
  }
  return COLUMNS.filter(c => visible.has(c));
}

/** True if ANY role in the array can edit this column. */
export function canEditForRoles(roles: string[], col: Column): boolean {
  return roles.some(r => canEdit(r, col));
}

/** True if ANY role in the array can set this column to this value. */
export function canSetValueForRoles(roles: string[], col: Column, value: string): boolean {
  return roles.some(r => canSetValue(r, col, value));
}

/** True if ANY role in the array is Admin or Reviewer. */
export function isApproverRoles(roles: string[]): boolean {
  return roles.some(r => isApprover(r));
}

/**
 * Union row filter: a row is visible if ANY role's rule matches (email match +
 * that role's gate). Admin/all roles include all rows. De-duped by row_id.
 */
export function filterRowsForRoles(roles: string[], email: string, rows: Row[]): Row[] {
  // If any role is "all", return all rows immediately
  if (roles.some(r => POLICY[r]?.rows === "all")) return rows;

  const seen = new Set<string>();
  const result: Row[] = [];
  for (const role of roles) {
    for (const row of filterRows(role, email, rows)) {
      const id = (row.row_id || "").trim();
      // Use a composite key of row_id + stringified row identity for rows without row_id
      const key = id || JSON.stringify(row);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(row);
      }
    }
  }
  return result;
}

/** Project a row to the union of visible columns across all roles. */
export function projectRowForRoles(roles: string[], row: Row): Row {
  const out: Row = {};
  for (const c of visibleColumnsForRoles(roles)) out[c] = row[c];
  return out;
}

/**
 * The distinct status columns this user can DRIVE a board on — one per
 * non-Admin/Reviewer role where the user can also edit that status column.
 * Used by the UI to offer a stage switcher.
 */
export function workerStagesForRoles(roles: string[]): { statusCol: Column; role: string }[] {
  const seen = new Set<Column>();
  const result: { statusCol: Column; role: string }[] = [];
  for (const role of roles) {
    if (isApprover(role)) continue; // Admin/Reviewer handled separately
    const p = POLICY[role];
    if (!p) continue;
    const statusCol = p.laneStatus;
    // Confirm the role can edit that status column
    if (canEdit(role, statusCol) && !seen.has(statusCol)) {
      seen.add(statusCol);
      result.push({ statusCol, role });
    }
  }
  return result;
}

/**
 * Field-level lock for multi-role correctness.
 * For a non-approver doer, a field is locked when its governing stage is:
 *   • "Done"      — approved work is frozen entirely (incl. the status column).
 *   • "In Review" — submitted-for-review work is frozen, EXCEPT the stage's own
 *                   status column, so the doer can still move the card back to
 *                   "In Progress" (drag) to reopen the rest for editing.
 * Approvers (Admin/Reviewer) are never locked.
 */
export function isFieldLocked(roles: string[], col: Column, row: Row): boolean {
  if (isApproverRoles(roles)) return false;
  const stageCol = STAGE_OF_COL[col];
  if (!stageCol) return false;
  const stage = (row[stageCol] || "").trim();
  if (stage === "Done") return true;
  if (stage === "In Review" && col !== stageCol) return true;
  return false;
}
