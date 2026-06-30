/**
 * Filters.tsx — admin filter bar for the Pipeline and Board views (client-side).
 */
import type { Row } from "../shared/rbac";
import { personLabel } from "./api";
import { activeStage } from "./pipeline";
import { stagesOf, assigneeColOf, type PipelineDef } from "./stages";

export interface AdminFilters {
  assignee: string;   // email (lowercase) or ""
  category: string;   // raw category value or ""
  stage: string;      // stage id or ""
}

export const EMPTY_FILTERS: AdminFilters = { assignee: "", category: "", stage: "" };

export function rowMatchesFilters(row: Row, filters: AdminFilters): boolean {
  const r = row as Record<string, string>;
  if (filters.stage && (activeStage(r)?.id ?? "done") !== filters.stage) return false;
  if (filters.assignee) {
    const cols = stagesOf(r).map(assigneeColOf);
    const hit = cols.some((c) => (r[c] ?? "").trim().toLowerCase() === filters.assignee);
    if (!hit) return false;
  }
  if (filters.category && (r.category ?? "") !== filters.category) return false;
  return true;
}

interface FiltersProps {
  rows: Row[];
  pipeline: PipelineDef;   // the matrix's selected video type — drives the stage options
  names: Record<string, string>;
  memberRoles?: Record<string, string>;
  filters: AdminFilters;
  onChange: (f: AdminFilters) => void;
}

export function Filters({ rows, pipeline, names, memberRoles = {}, filters, onChange }: FiltersProps) {
  // Scope everything to the selected video type (the matrix shows one system).
  const pRows = rows.filter((r) => (r as Record<string, string>).pipeline === pipeline.id);
  const assigneeSet = new Map<string, string>();
  for (const row of pRows) {
    for (const col of stagesOf(row as Record<string, string>).map(assigneeColOf)) {
      const e = ((row as Record<string, string>)[col] ?? "").trim().toLowerCase();
      if (e) assigneeSet.set(e, personLabel(e, names, memberRoles));
    }
  }
  const assignees = [...assigneeSet.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const catSet = new Set<string>();
  for (const row of pRows) { const c = (row.category ?? "").trim(); if (c) catSet.add(c); }
  const categories = [...catSet].sort();

  const hasFilters = filters.assignee !== "" || filters.category !== "" || filters.stage !== "";
  const filteredCount = pRows.filter((r) => rowMatchesFilters(r, filters)).length;
  const totalCount = pRows.length;

  return (
    <div className="admin-filters">
      <div className="admin-filters__group">
        <label className="admin-filters__label" htmlFor="f-assignee">Assignee</label>
        <select id="f-assignee" className="admin-filters__select" value={filters.assignee}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value })}>
          <option value="">All</option>
          {assignees.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
        </select>
      </div>
      <div className="admin-filters__group">
        <label className="admin-filters__label" htmlFor="f-category">Category</label>
        <select id="f-category" className="admin-filters__select" value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}>
          <option value="">All</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="admin-filters__group">
        <label className="admin-filters__label" htmlFor="f-stage">Stage</label>
        <select id="f-stage" className="admin-filters__select" value={filters.stage}
          onChange={(e) => onChange({ ...filters, stage: e.target.value })}>
          <option value="">All</option>
          {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="done">Done</option>
        </select>
      </div>
      <div className="admin-filters__meta">
        <span className="admin-filters__count">{filteredCount} / {totalCount}</span>
        {hasFilters && (
          <button className="admin-filters__clear" type="button" onClick={() => onChange(EMPTY_FILTERS)}>Clear</button>
        )}
      </div>
    </div>
  );
}
