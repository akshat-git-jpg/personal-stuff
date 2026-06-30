/**
 * PipelineBoard.tsx — admin row-per-topic matrix. One column per pipeline stage
 * (derived from STAGES); each cell shows done ✓ / an active status pill / pending ✕.
 */
import { useState } from "react";
import { Check, X, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Row } from "../shared/rbac";
import { statusOf, type StageDef, type PipelineDef } from "./stages";
import { displayName } from "./api";
import { stageStepState, activeAssigneeEmail } from "./pipeline";
import { rowMatchesFilters, type AdminFilters } from "./Filters";
import { StatusPill } from "./Card";
import { cn } from "@/lib/utils";

function StageCell({ row, pipeline, stage }: { row: Row; pipeline: PipelineDef; stage: StageDef }) {
  const r = row as Record<string, string>;
  const state = stageStepState(pipeline, stage, r);
  if (state === "done") {
    return <td className="px-3 py-2 text-center"><Check className="mx-auto size-4 text-emerald-600" aria-label={`${stage.label}: done`} /></td>;
  }
  if (state === "pending") {
    return <td className="px-3 py-2 text-center"><X className="mx-auto size-3.5 text-muted-foreground/30" aria-label={`${stage.label}: not started`} /></td>;
  }
  return (
    <td className="px-3 py-2 text-center">
      <div className="flex justify-center"><StatusPill status={statusOf(stage, r)} /></div>
    </td>
  );
}

function TopicCell({ row, names }: { row: Row; names: Record<string, string> }) {
  const r = row as Record<string, string>;
  const title = r.video_title || "(no title)";
  const cat = r.category ?? "";
  const sub = r.subcategory ?? "";
  const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;
  const email = activeAssigneeEmail(r);
  const name = email ? displayName(email, names) : "";
  return (
    <td className="px-3 py-2">
      <div className="font-medium leading-snug text-foreground">{title}</div>
      {catLabel && <div className="text-xs text-muted-foreground">{catLabel}</div>}
      {name && <div className="text-xs text-muted-foreground/80">{name}</div>}
    </td>
  );
}

const TOPIC_COL = "__topic__";
type SortState = { col: string; dir: "asc" | "desc" };

function sortValue(row: Row, col: string, pipeline: PipelineDef): string | number {
  const r = row as Record<string, string>;
  if (col === TOPIC_COL) return (r.video_title ?? "").toLowerCase();
  const stage = pipeline.stages.find((s) => s.id === col);
  if (!stage) return "";
  const s = stageStepState(pipeline, stage, r);
  return s === "done" ? 2 : s === "active" ? 1 : 0;
}

function compareRows(a: Row, b: Row, sort: SortState, pipeline: PipelineDef): number {
  const va = sortValue(a, sort.col, pipeline), vb = sortValue(b, sort.col, pipeline);
  let cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
  if (cmp === 0) {
    cmp = ((a as Record<string, string>).video_title ?? "").toLowerCase()
      .localeCompare(((b as Record<string, string>).video_title ?? "").toLowerCase());
  }
  return sort.dir === "asc" ? cmp : -cmp;
}

interface PipelineBoardProps {
  rows: Row[];
  pipeline: PipelineDef;   // the selected video type — drives the stage columns + row filter
  names: Record<string, string>;
  filters: AdminFilters;
  onOpen: (row: Row) => void;
  canDelete?: boolean;
  onDelete?: (rowId: string, title: string) => void;
}

export function PipelineBoard({ rows, pipeline, names, filters, onOpen, canDelete, onDelete }: PipelineBoardProps) {
  const [sort, setSort] = useState<SortState | null>(null);

  function toggleSort(col: string) {
    setSort((prev) => prev?.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: col === TOPIC_COL ? "asc" : "desc" });
  }

  const filtered = rows.filter((r) => (r as Record<string, string>).pipeline === pipeline.id && rowMatchesFilters(r, filters));
  if (filtered.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">No videos match these filters.</div>;
  }
  const sorted = sort ? [...filtered].sort((a, b) => compareRows(a, b, sort, pipeline)) : filtered;

  const caret = (col: string) => sort?.col === col
    ? (sort.dir === "asc" ? <ArrowUp className="inline size-3" /> : <ArrowDown className="inline size-3" />)
    : null;
  const ariaSort = (col: string): "ascending" | "descending" | "none" =>
    sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  const thCls = "select-none whitespace-nowrap border-b border-border bg-muted/50 px-3 py-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground";

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={cn(thCls, "cursor-pointer")} role="columnheader"
              aria-sort={ariaSort(TOPIC_COL)} tabIndex={0} onClick={() => toggleSort(TOPIC_COL)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(TOPIC_COL); } }}>
              Topic {caret(TOPIC_COL)}
            </th>
            {pipeline.stages.map((stage) => (
              <th key={stage.id} className={cn(thCls, "cursor-pointer text-center")} role="columnheader"
                aria-sort={ariaSort(stage.id)} tabIndex={0} onClick={() => toggleSort(stage.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(stage.id); } }}>
                {stage.label} {caret(stage.id)}
              </th>
            ))}
            {canDelete && <th className={cn(thCls, "w-10")} aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const id = (row as Record<string, string>).row_id ?? "";
            const title = (row as Record<string, string>).video_title ?? "";
            return (
              <tr key={id || title} className="group cursor-pointer border-b border-border last:border-0 hover:bg-muted/40" role="button" tabIndex={0}
                aria-label={`Open ${title || "topic"}`} onClick={() => onOpen(row)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(row); }}>
                <TopicCell row={row} names={names} />
                {pipeline.stages.map((stage) => <StageCell key={stage.id} row={row} pipeline={pipeline} stage={stage} />)}
                {canDelete && (
                  <td className="px-2 py-2 text-center">
                    <button type="button" title="Delete this video" aria-label={`Delete ${title || id}`}
                      onClick={(e) => { e.stopPropagation(); onDelete?.(id, title); }}
                      className="rounded-md p-1 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
