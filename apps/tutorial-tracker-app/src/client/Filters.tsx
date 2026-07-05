/**
 * Filters.tsx — admin filter bar for the Pipeline and Board views (client-side).
 */
import { useState, useEffect } from "react";
import type { Row } from "../shared/rbac";
import { personLabel } from "./api";
import { activeStage } from "./pipeline";
import { stagesOf, assigneeColOf, type PipelineDef } from "./stages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectCls = "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export interface AdminFilters {
  q: string;          // title search
  assignee: string;   // email (lowercase) or ""
  category: string;   // raw category value or ""
  stage: string;      // stage id or ""
}

export const EMPTY_FILTERS: AdminFilters = { q: "", assignee: "", category: "", stage: "" };

export function rowMatchesFilters(row: Row, filters: AdminFilters): boolean {
  const r = row as Record<string, string>;
  if (filters.q && !(r.video_title ?? "").toLowerCase().includes(filters.q.toLowerCase())) return false;
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

  const hasFilters = filters.q !== "" || filters.assignee !== "" || filters.category !== "" || filters.stage !== "";
  const filteredCount = pRows.filter((r) => rowMatchesFilters(r, filters)).length;
  const totalCount = pRows.length;

  const [localQ, setLocalQ] = useState(filters.q);
  useEffect(() => { setLocalQ(filters.q); }, [filters.q]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQ !== filters.q) onChange({ ...filters, q: localQ });
    }, 300);
    return () => clearTimeout(timer);
  }, [localQ, filters, onChange]);

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1 flex-1 min-w-[200px] max-w-xs">
        <label className="text-[11px] font-medium text-muted-foreground" htmlFor="f-q">Search</label>
        <Input id="f-q" type="search" placeholder="Search title…" className="h-8 text-xs bg-transparent" value={localQ} onChange={(e) => setLocalQ(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground" htmlFor="f-assignee">Assignee</label>
        <select id="f-assignee" className={selectCls} value={filters.assignee}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value })}>
          <option value="">All</option>
          {assignees.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground" htmlFor="f-category">Category</label>
        <select id="f-category" className={selectCls} value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}>
          <option value="">All</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-muted-foreground" htmlFor="f-stage">Stage</label>
        <select id="f-stage" className={selectCls} value={filters.stage}
          onChange={(e) => onChange({ ...filters, stage: e.target.value })}>
          <option value="">All</option>
          {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="done">Done</option>
        </select>
      </div>
      <div className="ml-auto flex items-center gap-2 pb-1">
        <span className="text-xs tabular-nums text-muted-foreground">{filteredCount} / {totalCount}</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7" type="button" onClick={() => onChange(EMPTY_FILTERS)}>Clear</Button>
        )}
      </div>
    </div>
  );
}
