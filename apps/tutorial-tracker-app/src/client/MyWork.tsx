import type { ReviewItem, BoardRow } from "./api";
import type { Transition } from "../shared/rbac";
import { ReviewQueue } from "./ReviewQueue";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { pipeOf, stageByStatusColIn, normalizeStatusIn, holderOf, sinceOf } from "./stages";
import type { StageDef, PipelineDef } from "./stages";
import { Card } from "./Card";
import { displayName } from "./api";
import { daysSince } from "./pipeline";


/** Which stage of the video this row is about. Without it, two stages of the
 *  same video render as two identical titles and read as a duplicate. It sits
 *  UNDER the title now — the title is what you scan for. */
function StageChip({ stage, pipeline, showSystem }: { stage: StageDef; pipeline: PipelineDef; showSystem?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>{stage.label}</span>
      {showSystem && <><span aria-hidden="true">·</span><span>{pipeline.name}</span></>}
    </div>
  );
}

interface WorkItem {
  row: BoardRow;
  statusCol: string;
  stage: StageDef;
  pipeline: PipelineDef;
  status: string;
  upcoming?: boolean;
}

export interface MyWorkProps {
  queueItems: ReviewItem[];
  onOpenQueueItem: (item: ReviewItem) => void;
  onQueueAction: (item: ReviewItem, t: Transition) => void;
  rows: BoardRow[];
  names?: Record<string, string>;
  readOnly?: boolean;
  isAdmin?: boolean;
  showDwell?: boolean;
  handleDelete: (row_id: string, title: string) => void;
  openDetail: (row: BoardRow, stageId?: string, as?: "doer" | "reviewer") => void;
  doAction: (row: BoardRow, t: Transition) => void;
  transitionsForStageCol: (row: BoardRow, statusCol: string) => Transition[];
  onSaveField: (row: BoardRow, col: string, value: string, prev: string) => void;
}

export function MyWork({ 
  queueItems, onOpenQueueItem, onQueueAction, rows, names, readOnly, isAdmin, showDwell, 
  handleDelete, openDetail, doAction, transitionsForStageCol, onSaveField
}: MyWorkProps) {
  
  const allItems: WorkItem[] = [];
  const pipelines = new Set<string>();

  for (const row of rows) {
    const pipeline = pipeOf(row);
    
    // Active stages
    for (const statusCol of (row._stages || [])) {
      const stage = stageByStatusColIn(pipeline, statusCol);
      if (stage) {
        pipelines.add(pipeline.id);
        const status = normalizeStatusIn(stage, (row as Record<string, unknown>)[statusCol] as string);
        allItems.push({ row, statusCol, stage, pipeline, status });
      }
    }
    
    // Upcoming stages
    for (const statusCol of (row._upcoming || [])) {
      const stage = stageByStatusColIn(pipeline, statusCol);
      if (stage) {
        pipelines.add(pipeline.id);
        const status = normalizeStatusIn(stage, (row as Record<string, unknown>)[statusCol] as string);
        allItems.push({ row, statusCol, stage, pipeline, status, upcoming: true });
      }
    }
  }

  const multiSystem = pipelines.size > 1;

  // Group items
  const needsAction: WorkItem[] = [];
  const waitingOnReview: WorkItem[] = [];
  const upNext: WorkItem[] = [];
  const done: WorkItem[] = [];

  for (const item of allItems) {
    if (item.upcoming) {
      upNext.push(item);
      continue;
    }

    const { status } = item;

    
    if (status === "Done") {
      done.push(item);
    } else if (status === "In Review") {
      waitingOnReview.push(item);
    } else {
      needsAction.push(item);
    }
  }

  // Sort needsAction: Need Changes first, then To Do, In Progress. ETA ascending.
  const statusRank = (s: string) => {
    if (s === "Need Changes") return 0;
    if (s === "To Do") return 1;
    if (s === "In Progress") return 2;
    return 3;
  };

  needsAction.sort((a, b) => {
    const rankA = statusRank(a.status);
    const rankB = statusRank(b.status);
    if (rankA !== rankB) return rankA - rankB;
    const etaA = String((a.row as Record<string, unknown>)[`${a.stage.id}_eta`] ?? "");
    const etaB = String((b.row as Record<string, unknown>)[`${b.stage.id}_eta`] ?? "");
    if (etaA && !etaB) return -1;
    if (!etaA && etaB) return 1;
    return etaA.localeCompare(etaB);
  });

  // Everything in needsAction is genuinely this person's turn — none of it is
  // blocked on anyone else. So none of it is ever hidden. The top job renders as
  // the full card that carries the action; the rest sit under it as quiet rows.
  // They used to fold behind a "4 more after this" disclosure, which made the
  // section header ("5") disagree with the screen ("1") and read as a bug — and
  // hiding real work does not make the work smaller, it just adds a click.
  const LEAD_COUNT = 1;

  const focus = needsAction.slice(0, LEAD_COUNT);
  const behind = needsAction.slice(LEAD_COUNT);

  // A person who owns two stages on the same video (e.g. Video Editor AND
  // Thumbnail Maker) would otherwise see that video twice. The later stage is
  // folded into the live card as a "then …" line instead. A stage that is ONLY
  // locked behind someone else's unfinished work is dropped from this screen
  // altogether — there is nothing the person can do about it, and naming it
  // invited them to wait on work that had been stalled for weeks.
  const activeRowIds = new Set([...needsAction, ...waitingOnReview].map((i) => i.row.row_id));
  const laterStages = new Map<string, string[]>();
  for (const item of upNext) {
    if (!activeRowIds.has(item.row.row_id)) continue;
    const labels = laterStages.get(item.row.row_id) ?? [];
    if (!labels.includes(item.stage.label)) labels.push(item.stage.label);
    laterStages.set(item.row.row_id, labels);
  }
  const thenNote = (rowId: string) => {
    const labels = laterStages.get(rowId);
    return labels?.length ? `Then yours: ${labels.join(" · ")}` : undefined;
  };

  const isEmpty = queueItems.length === 0 && allItems.length === 0;

  const [showDone, setShowDone] = useState(false);

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-2xl px-2 pb-12 pt-4">
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Nothing needs you right now 🎉
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-2 pb-12 pt-4">
      {/* 1. Needs your review */}
      {queueItems.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-1.5 shrink-0 rounded-full bg-amber-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Needs your review</h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{queueItems.length}</span>
          </div>
          <ReviewQueue items={queueItems} onOpen={onOpenQueueItem} onAction={onQueueAction} multiSystem={multiSystem} />
        </section>
      )}

      {/* 2. Your turn */}
      {needsAction.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-1.5 shrink-0 rounded-full bg-orange-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">Your turn</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{needsAction.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {focus.map((item) => (
              <Card 
                key={`${item.row.row_id}-${item.statusCol}`} 
                row={item.row} 
                statusCol={item.statusCol} 
                names={names} 
                readOnly={readOnly}
                showAssignee={isAdmin} 
                showDwell={showDwell}
                showStage={true}
                showSystem={multiSystem}
                canDelete={isAdmin && !readOnly}
                footNote={thenNote(item.row.row_id)}
                onDelete={() => handleDelete(item.row.row_id, item.row.video_title ?? "")}
                transitions={transitionsForStageCol(item.row, item.statusCol).filter((t) => t.by === "doer")}
                onOpen={() => openDetail(item.row, item.stage.id, "doer")}
                onAction={(t) => doAction(item.row, t)}
                onSaveField={(col, value, prev) => onSaveField(item.row, col, value, prev)}
              />
            ))}
            {behind.map((item) => (
              <div data-testid="quiet-job" key={`${item.row.row_id}-${item.statusCol}`} className="group relative flex cursor-pointer flex-col gap-1.5 rounded-[10px] border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md" onClick={() => openDetail(item.row, item.stage.id, "doer")}>
                <div className="text-[15px] font-semibold leading-snug tracking-tight text-balance">{item.row.video_title || "(no title)"}</div>
                <StageChip stage={item.stage} pipeline={item.pipeline} showSystem={multiSystem} />
                {item.status === "Need Changes" && (
                  <div className="text-xs font-medium text-red-700 dark:text-red-300">Sent back for changes</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Waiting on reviewer */}
      {waitingOnReview.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-1.5 shrink-0 rounded-full bg-blue-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">Waiting on reviewer</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{waitingOnReview.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {waitingOnReview.map((item) => {
              const holder = holderOf(item.stage, item.row as Record<string, unknown>, item.status);
              const days = daysSince(sinceOf(item.row as Record<string, unknown>, item.statusCol));
              const who = holder.kind === "reviewer" && holder.email ? displayName(holder.email, names) : "reviewer";
              const dayLabel = days === null ? "" : ` · ${days}d`;
              const note = thenNote(item.row.row_id);
              return (
                <div key={`${item.row.row_id}-${item.statusCol}`} className="group relative flex cursor-pointer flex-col gap-1.5 rounded-[10px] border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md" onClick={() => openDetail(item.row, item.stage.id, "doer")}>
                  <div className="text-[15px] font-semibold leading-snug tracking-tight text-balance">{item.row.video_title || "(no title)"}</div>
                  <StageChip stage={item.stage} pipeline={item.pipeline} showSystem={multiSystem} />
                  <div className="text-xs text-muted-foreground">With {who}{dayLabel}</div>
                  {note && <div className="text-[11px] text-muted-foreground/70">{note}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Done */}
      {done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone(o => !o)} className="mb-3 flex items-center gap-2 text-left hover:opacity-80">
            <div className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Done</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{done.length}</span>
            {showDone ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </button>
          {showDone && (
            <div className="flex flex-col gap-3">
              {done.map((item) => (
                <div key={`${item.row.row_id}-${item.statusCol}`} className="group relative flex cursor-pointer flex-col gap-1.5 rounded-[10px] border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md" onClick={() => openDetail(item.row, item.stage.id, "doer")}>
                  <div className="text-[15px] font-semibold leading-snug tracking-tight text-balance">{item.row.video_title || "(no title)"}</div>
                  <StageChip stage={item.stage} pipeline={item.pipeline} showSystem={multiSystem} />
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
