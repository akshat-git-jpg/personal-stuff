import type { Column } from "./columns";
import { COLUMNS, GROUPS } from "./columns";
import { POLICY } from "./policy";
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
  return rows.filter(r => (r[col] || "").trim().toLowerCase() === email.trim().toLowerCase());
}
export function projectRow(role: string, row: Row): Row {
  const out: Row = {};
  for (const c of visibleColumns(role)) out[c] = row[c];
  return out;
}
