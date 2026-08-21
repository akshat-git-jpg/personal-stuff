/**
 * Filters.tsx — admin filter bar for the All-videos view (client-side).
 *
 * Redesign note: the old bar put four form controls on screen at all times
 * (search + assignee + category + stage). Day to day an admin wants one of a
 * handful of *questions* answered ("what is stuck?", "what is with a
 * reviewer?"), so those are now one-click buckets. The precise dropdowns still
 * exist, one click away under "More filters", so nothing was taken away.
 */
import { useState, useEffect } from "react";
import type { Row } from "../shared/rbac";
import { personLabel } from "./api";
import { stagesOf, assigneeColOf, type PipelineDef } from "./stages";
import { BUCKETS, EMPTY_FILTERS, rowMatchesFilters, type AdminFilters, type Bucket } from "./filterModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const selectCls = "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

interface FiltersProps {
  rows: Row[];
  pipeline: PipelineDef;   // the selected video type — drives the stage options
  names: Record<string, string>;
  memberRoles?: Record<string, string>;
  filters: AdminFilters;
  onChange: (f: AdminFilters) => void;
}

export function Filters({ rows, pipeline, names, memberRoles = {}, filters, onChange }: FiltersProps) {
  // Scope everything to the selected video type (the board shows one system).
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

  const hasPrecise = filters.assignee !== "" || filters.category !== "" || filters.stage !== "";
  const hasFilters = filters.q !== "" || filters.bucket !== "" || hasPrecise;
  const filteredCount = pRows.filter((r) => rowMatchesFilters(r, filters)).length;
  const totalCount = pRows.length;

  // Chip counts ignore the bucket itself, so they keep showing what you'd get
  // by clicking — not zero for every bucket you are not currently in.
  const bucketCount = (key: Bucket) =>
    pRows.filter((r) => rowMatchesFilters(r, { ...filters, bucket: key })).length;

  // The box keeps its own text so typing stays smooth, and re-syncs during
  // render when the filter is cleared from outside (adjust-on-prop-change).
  const [localQ, setLocalQ] = useState(filters.q);
  const [lastQ, setLastQ] = useState(filters.q);
  if (filters.q !== lastQ) { setLastQ(filters.q); setLocalQ(filters.q); }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQ !== filters.q) onChange({ ...filters, q: localQ });
    }, 300);
    return () => clearTimeout(timer);
  }, [localQ, filters, onChange]);

  const [showMore, setShowMore] = useState(false);

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input id="f-q" type="search" placeholder="Search title…" aria-label="Search title"
          className="h-8 w-[240px] bg-transparent text-xs" value={localQ} onChange={(e) => setLocalQ(e.target.value)} />

        <div className="flex flex-wrap items-center gap-1.5">
          {BUCKETS.map((b) => {
            const on = filters.bucket === b.key;
            return (
              <button key={b.key || "all"} type="button" aria-pressed={on}
                onClick={() => onChange({ ...filters, bucket: b.key })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}>
                {b.label}
                <span className={cn("tabular-nums", on ? "text-background/60" : "text-muted-foreground/70")}>
                  {bucketCount(b.key)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{filteredCount} / {totalCount}</span>
          <Button variant="ghost" size="sm" className={cn("h-8 gap-1.5", hasPrecise && "text-foreground")}
            type="button" aria-expanded={showMore} onClick={() => setShowMore((o) => !o)}>
            <SlidersHorizontal className="size-3.5" /> More filters
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8" type="button"
              onClick={() => { onChange(EMPTY_FILTERS); setLocalQ(""); }}>Clear</Button>
          )}
        </div>
      </div>

      {(showMore || hasPrecise) && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
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
            <label className="text-[11px] font-medium text-muted-foreground" htmlFor="f-stage">Stuck at stage</label>
            <select id="f-stage" className={selectCls} value={filters.stage}
              onChange={(e) => onChange({ ...filters, stage: e.target.value })}>
              <option value="">All</option>
              {pipeline.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              <option value="done">Done</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
