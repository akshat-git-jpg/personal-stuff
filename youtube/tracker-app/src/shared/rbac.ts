import type { Column } from "./columns";
import { COLUMNS, GROUPS } from "./columns";
import { POLICY, APPROVER_ROLES, APPROVER_ONLY_VALUES } from "./policy";
export type Row = Partial<Record<Column, string>>;

export function visibleColumns(role: string): Column[] {
  const p = POLICY[role]; if (!p) return [];
  if (p.visibleGroups === "*") return [...COLUMNS];
  const set = new Set<Column>(["row_id"]);
  for (const g of p.visibleGroups) GROUPS[g].forEach(c => set.add(c));
  return COLUMNS.filter(c => set.has(c));
}
export function canEdit(role: string, col: Column): boolean {
  const p = POLICY[role]; if (!p) return false;
  if (p.visibleGroups === "*" && p.editable.length === 0) return true; // Admin
  return p.editable.includes(col);
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
export function isRowLockedFor(role: string, row: Row): boolean {
  if (isApprover(role)) return false;
  const p = POLICY[role]; if (!p) return true;
  const owned = p.laneStatus; // tutorial_status / video_editor_status
  return (row[owned] || "").trim() === "Done";
}
