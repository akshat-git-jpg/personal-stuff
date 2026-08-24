/**
 * PipelineBoard.tsx — admin "All videos" list, one row per video.
 *
 * Redesign note: this used to be a tick/cross matrix — one cell per stage,
 * each holding ✓ / ✗ / a status pill. Scanning it meant decoding 6 glyphs per
 * row before you knew where the video actually was. It is now a six-part
 * progress strip per row (green = done, amber = happening now, grey = not
 * open), with the stage names printed once in the header. Per-stage column
 * sorting went away with the cells; the "Stuck at stage" filter answers the
 * same question ("show me everything sitting at Editing") more directly.
 */
import { useState } from "react";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Row } from "../shared/engine/rbac";
import { statusOf, statusColOf, sinceOf, holderOf, type StageDef, type PipelineDef } from "./stages";
import { displayName } from "./api";
import { stageStepState, activeStage, daysSince } from "./pipeline";
import { rowMatchesFilters, bucketOf, type AdminFilters } from "./filterModel";
import { cn } from "@/lib/utils";

const SEGMENT_TONE: Record<string, string> = {
  done: "bg-emerald-500",
  active: "bg-primary ring-4 ring-primary/20",
  pending: "bg-border",
};

function ProgressStrip({ row, pipeline }: { row: Row; pipeline: PipelineDef }) {
  const r = row as Record<string, string>;
  return (
    <div className="flex min-w-[240px] flex-1 items-center gap-1.5">
      {pipeline.stages.map((stage: StageDef) => {
        const state = stageStepState(pipeline, stage, r);
        return (
          <div key={stage.id} className="flex-1" title={`${stage.label}: ${state === "active" ? statusOf(stage, r) : state === "done" ? "done" : "not open yet"}`}>
            <div className={cn("h-1.5 w-full rounded-full", SEGMENT_TONE[state])} />
          </div>
        );
      })}
    </div>
  );
}

/** Where the video is right now, in one line: the stage, the state, and who holds it. */
function whereItIs(row: Row, names: Record<string, string>): { who: string; note: string } {
  const r = row as Record<string, string>;
  const stage = activeStage(r);
  if (!stage) return { who: "—", note: "Published" };
  const status = statusOf(stage, r);
  const holder = holderOf(stage, r as Record<string, unknown>, status);
  const who = holder.email ? displayName(holder.email, names) : "unassigned";
  return { who, note: `${stage.label} · ${status.toLowerCase()}` };
}

function ageOf(row: Row): number | null {
  const r = row as Record<string, string>;
  const stage = activeStage(r);
  if (!stage) return null;
  return daysSince(sinceOf(r as Record<string, unknown>, statusColOf(stage)));
}

// "title" / "age", or a stage id — sorting by a stage ranks its progress
// (done > happening now > not open), which is what the old matrix columns did.
type SortCol = string;
type SortState = { col: SortCol; dir: "asc" | "desc" };

function stageRank(row: Row, pipeline: PipelineDef, stageId: string): number {
  const stage = pipeline.stages.find((s) => s.id === stageId);
  if (!stage) return -1;
  const state = stageStepState(pipeline, stage, row as Record<string, string>);
  return state === "done" ? 2 : state === "active" ? 1 : 0;
}

function compareRows(a: Row, b: Row, sort: SortState, pipeline: PipelineDef): number {
  const titleOf = (r: Row) => ((r as Record<string, string>).video_title ?? "").toLowerCase();
  let cmp: number;
  if (sort.col === "age") cmp = (ageOf(a) ?? -1) - (ageOf(b) ?? -1);
  else if (sort.col === "title") cmp = titleOf(a).localeCompare(titleOf(b));
  else cmp = stageRank(a, pipeline, sort.col) - stageRank(b, pipeline, sort.col);
  if (cmp === 0) cmp = titleOf(a).localeCompare(titleOf(b));
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
  viewerEmail?: string;
}

export function PipelineBoard({ rows, pipeline, names, filters, onOpen, canDelete, onDelete, viewerEmail }: PipelineBoardProps) {
  const [sort, setSort] = useState<SortState | null>(null);

  function toggleSort(col: SortCol) {
    setSort((prev) => prev?.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: col === "title" ? "asc" : "desc" });
  }

  const filtered = rows.filter((r) => (r as Record<string, string>).pipeline === pipeline.id && rowMatchesFilters(r, filters, viewerEmail));
  if (filtered.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">No videos match these filters.</div>;
  }
  const sorted = sort ? [...filtered].sort((a, b) => compareRows(a, b, sort, pipeline)) : filtered;

  const caret = (col: SortCol) => sort?.col === col
    ? (sort.dir === "asc" ? <ArrowUp className="inline size-3" /> : <ArrowDown className="inline size-3" />)
    : null;
  const ariaSort = (col: SortCol): "ascending" | "descending" | "none" =>
    sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  const headCls = "text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    // overflow-x-auto makes THIS div the sticky scrollport, which un-pins the
    // header from the page and parks it over the first row. So the scroll is
    // only switched on below the width where the row actually fits.
    <div className="overflow-x-auto rounded-xl border border-border bg-card min-[920px]:overflow-x-visible">
      <div className="min-w-[860px]">

        <div className="sticky top-[var(--app-header-h)] z-20 flex items-center gap-4 border-b border-border bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))] px-4 py-2.5">
          <button type="button" onClick={() => toggleSort("title")} aria-sort={ariaSort("title")}
            className={cn(headCls, "w-[260px] shrink-0 text-left hover:text-foreground")}>
            Video {caret("title")}
          </button>
          <div className="flex min-w-[240px] flex-1 items-center gap-1.5">
            {pipeline.stages.map((s) => (
              <button key={s.id} type="button" onClick={() => toggleSort(s.id)} aria-sort={ariaSort(s.id)}
                className={cn(headCls, "flex-1 truncate text-center hover:text-foreground")}
                title={`Sort by ${s.label}`}>{s.label} {caret(s.id)}</button>
            ))}
          </div>
          <div className={cn(headCls, "w-[150px] shrink-0")}>Now with</div>
          <button type="button" onClick={() => toggleSort("age")} aria-sort={ariaSort("age")}
            className={cn(headCls, "w-[56px] shrink-0 text-right hover:text-foreground")}>
            Age {caret("age")}
          </button>
          {canDelete && <div className="w-6 shrink-0" aria-hidden="true" />}
        </div>

        {sorted.map((row) => {
          const r = row as Record<string, string>;
          const id = r.row_id ?? "";
          const title = r.video_title ?? "";
          const cat = r.category ?? "";
          const sub = r.subcategory ?? "";
          const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;
          const { who, note } = whereItIs(row, names);
          const age = ageOf(row);
          const bucket = bucketOf(row, viewerEmail);
          const stuck = bucket === "idle" || bucket === "late" || bucket === "needsyou";
          return (
            <div key={id || title}
              role="button" tabIndex={0} aria-label={`Open ${title || "video"}`}
              onClick={() => onOpen(row)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(row); } }}
              className="group flex cursor-pointer items-center gap-4 border-b border-border px-4 py-3.5 transition-colors last:border-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <div className="w-[260px] shrink-0 space-y-0.5">
                <div className="text-[14.5px] font-semibold leading-snug tracking-tight text-foreground">{title || "(no title)"}</div>
                {catLabel && <div className="text-[11.5px] text-muted-foreground">{catLabel}</div>}
              </div>
              <ProgressStrip row={row} pipeline={pipeline} />
              <div className="w-[150px] shrink-0 space-y-0.5">
                <div className="truncate text-[13px] font-medium text-foreground/85">{who}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">{note}</div>
              </div>
              <div className="w-[56px] shrink-0 text-right">
                {age === null ? (
                  <span className="text-xs text-muted-foreground/60">—</span>
                ) : stuck ? (
                  <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    title="Sitting longer than it should">{age}d</span>
                ) : (
                  <span className="text-xs tabular-nums text-muted-foreground">{age}d</span>
                )}
              </div>
              {canDelete && (
                <button type="button" title="Delete this video" aria-label={`Delete ${title || id}`}
                  onClick={(e) => { e.stopPropagation(); onDelete?.(id, title); }}
                  className="w-6 shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
