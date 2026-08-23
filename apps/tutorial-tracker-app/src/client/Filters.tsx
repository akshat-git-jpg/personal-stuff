/**
 * Filters.tsx — admin filter bar for the All-videos view (client-side).
 *
 * Redesign note: the old bar put four form controls on screen at all times
 * (search + assignee + stage). Day to day an admin wants one of a
 * handful of *questions* answered ("what is stuck?", "what is with a
 * reviewer?"), so those are now one-click buckets. The precise dropdowns still
 * exist, one click away under "More filters", so nothing was taken away.
 */
import { useState, useEffect } from "react";
import type { Row } from "../shared/engine/rbac";
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
  viewerEmail?: string;
}

export function Filters({ rows, pipeline, names, memberRoles = {}, filters, onChange, viewerEmail }: FiltersProps) {
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

  const hasPrecise = filters.assignee !== "" || filters.stage !== "";
  const hasFilters = filters.q !== "" || filters.bucket !== "" || hasPrecise;
  const filteredCount = pRows.filter((r) => rowMatchesFilters(r, filters, viewerEmail)).length;

  // Chip counts ignore the bucket itself, so they keep showing what you'd get
  // by clicking — not zero for every bucket you are not currently in.
  const bucketCount = (key: Bucket) =>
    pRows.filter((r) => rowMatchesFilters(r, { ...filters, bucket: key }, viewerEmail)).length;

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
    <div className="mb-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">Needs your attention</h2>
      
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((b) => {
          const on = filters.bucket === b.key;
          return (
            <button key={b.key} type="button" aria-pressed={on}
              onClick={() => onChange({ ...filters, bucket: on ? "" : b.key })}
              className={cn(
                "group flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card hover:bg-muted/50"
              )}>
              <div className="flex w-full items-center justify-between">
                <span className={cn("text-xs font-semibold uppercase tracking-wider", on ? "text-background" : "text-muted-foreground group-hover:text-foreground")}>
                  {b.label}
                </span>
                <span className={cn("text-2xl font-bold tabular-nums tracking-tight", on ? "text-background" : "text-foreground")}>
                  {bucketCount(b.key)}
                </span>
              </div>
              <span className={cn("text-[11.5px] leading-snug", on ? "text-background/80" : "text-muted-foreground")}>
                {b.rule}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input id="f-q" type="search" placeholder="Search title…" aria-label="Search title"
          className="h-8 w-[240px] bg-transparent text-xs" value={localQ} onChange={(e) => setLocalQ(e.target.value)} />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className={cn("h-8 gap-1.5", filters.showPublished && "text-foreground")}
            type="button" aria-pressed={filters.showPublished} onClick={() => onChange({ ...filters, showPublished: !filters.showPublished })}>
            {filters.showPublished ? "Hide published" : "Show published"}
          </Button>
          <span className="text-xs tabular-nums text-muted-foreground" data-testid="row-count">{filteredCount} shown</span>
          <Button variant="ghost" size="sm" className={cn("h-8 gap-1.5", hasPrecise && "text-foreground")}
            type="button" aria-expanded={showMore} onClick={() => setShowMore((o) => !o)}>
            <SlidersHorizontal className="size-3.5" /> More filters
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-8" type="button"
              onClick={() => { onChange({ ...EMPTY_FILTERS, showPublished: filters.showPublished }); setLocalQ(""); }}>Clear</Button>
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
