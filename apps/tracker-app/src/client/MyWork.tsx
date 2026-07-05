import type { ReviewItem, BoardRow } from "./api";
import type { Transition } from "../shared/rbac";
import { ReviewQueue } from "./ReviewQueue";
import { REVIEWER_GUIDE } from "./guidance";
import { Info, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { pipeOf, stageByStatusColIn, stageByIdIn, normalizeStatusIn } from "./stages";
import type { StageDef, PipelineDef } from "./stages";
import { Card } from "./Card";


function HelpBanner({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border bg-muted/40">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground/80 hover:text-foreground">
        <Info className="size-3.5 text-primary" /> What you do here
        {open ? <ChevronDown className="ml-auto size-3.5 text-muted-foreground" /> : <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />}
      </button>
      {open && <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">{text}</p>}
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
  rows: BoardRow[];
  names?: Record<string, string>;
  readOnly?: boolean;
  isAdmin?: boolean;
  showDwell?: boolean;
  handleDelete: (row_id: string, title: string) => void;
  openDetail: (row: BoardRow, stageId?: string, as?: "doer" | "reviewer") => void;
  doAction: (row: BoardRow, t: Transition) => void;
  transitionsForStageCol: (row: BoardRow, statusCol: string) => Transition[];
}

export function MyWork({ 
  queueItems, onOpenQueueItem, rows, names, readOnly, isAdmin, showDwell, 
  handleDelete, openDetail, doAction, transitionsForStageCol 
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
        const status = normalizeStatusIn(stage, (row as any)[statusCol]);
        allItems.push({ row, statusCol, stage, pipeline, status });
      }
    }
    
    // Upcoming stages
    for (const statusCol of (row._upcoming || [])) {
      const stage = stageByStatusColIn(pipeline, statusCol);
      if (stage) {
        pipelines.add(pipeline.id);
        const status = normalizeStatusIn(stage, (row as any)[statusCol]);
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
    const etaA = ((a.row as any)[`${a.stage.id}_eta`]) || "";
    const etaB = ((b.row as any)[`${b.stage.id}_eta`]) || "";
    if (etaA && !etaB) return -1;
    if (!etaA && etaB) return 1;
    return etaA.localeCompare(etaB);
  });

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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs your review</h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{queueItems.length}</span>
          </div>
          <HelpBanner text={REVIEWER_GUIDE} />
          <ReviewQueue items={queueItems} onOpen={onOpenQueueItem} />
        </section>
      )}

      {/* 2. Needs your action */}
      {needsAction.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs your action</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{needsAction.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {needsAction.map((item) => (
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
                onDelete={() => handleDelete(item.row.row_id, item.row.video_title ?? "")}
                transitions={transitionsForStageCol(item.row, item.statusCol).filter((t) => t.by === "doer")}
                onOpen={() => openDetail(item.row, item.stage.id, "doer")}
                onAction={(t) => doAction(item.row, t)} 
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. Waiting on review */}
      {waitingOnReview.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waiting on review</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{waitingOnReview.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {waitingOnReview.map((item) => (
              <div key={`${item.row.row_id}-${item.statusCol}`} className="group relative flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-card p-3 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md" onClick={() => openDetail(item.row, item.stage.id, "doer")}>
                <div className="text-sm font-semibold">{item.row.video_title || "(no title)"}</div>
                <div className="text-xs text-muted-foreground">
                  Submitted — waiting for review
                  {/* optionally show reviewer name here */}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Up next */}
      {upNext.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Up next</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{upNext.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {upNext.map((item) => {
              const gateLabel = item.stage.gate ? stageByIdIn(item.pipeline, item.stage.gate)?.label : "previous stage";
              return (
                <div key={`${item.row.row_id}-${item.statusCol}`} className="group relative flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-muted/30 p-3 text-left shadow-xs transition-all hover:border-foreground/15 opacity-70" onClick={() => openDetail(item.row, item.stage.id, "doer")}>
                  <div className="text-sm font-semibold">{item.row.video_title || "(no title)"}</div>
                  <div className="text-xs text-muted-foreground">Opens after {gateLabel} is approved</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Done */}
      {done.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowDone(o => !o)} className="mb-3 flex items-center gap-2 text-left hover:opacity-80">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Done</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{done.length}</span>
            {showDone ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
          </button>
          {showDone && (
            <div className="flex flex-col gap-3">
              {done.map((item) => (
                <div key={`${item.row.row_id}-${item.statusCol}`} className="group relative flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-card p-3 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md" onClick={() => openDetail(item.row, item.stage.id, "doer")}>
                  <div className="text-sm font-semibold">{item.row.video_title || "(no title)"}</div>
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
