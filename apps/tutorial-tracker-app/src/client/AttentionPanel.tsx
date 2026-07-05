import { useState } from "react";
import { type BoardRow } from "./api";
import { type PipelineSummary } from "./Board";
import { colOf, type StageDef } from "../shared/engine/types";
import { etaBadge } from "./labels";
import { isGateOpen, isStageComplete, statusOf, getPipeline } from "./stages";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const THRESHOLDS = { review: 2, bounced: 2, idle: 3 };

type AttentionGroup = "overdue" | "review" | "bounced" | "unassigned" | "idle";

interface AttentionItem {
  row: BoardRow;
  pipelineName: string;
  stage: StageDef;
  message: string;
}

export function AttentionPanel({
  rows,
  pipelines,
  names,
  onOpen,
}: {
  rows: BoardRow[];
  pipelines: PipelineSummary[];
  names: Record<string, string>;
  onOpen: (row: BoardRow, stageId: string) => void;
}) {
  const groups: Record<AttentionGroup, AttentionItem[]> = {
    overdue: [],
    review: [],
    bounced: [],
    unassigned: [],
    idle: [],
  };

  const now = Date.now();
  const getDays = (iso: string) => {
    if (!iso) return 0;
    const ts = Date.parse(iso);
    if (isNaN(ts)) return 0;
    return Math.floor((now - ts) / 86400e3);
  };

  for (const row of rows) {
    const pipelineName = pipelines.find((p) => p.id === row.pipeline)?.name ?? row.pipeline;
    const pipeline = getPipeline(row.pipeline);
    
    for (const s of pipeline.stages) {
      const st = statusOf(s, row as any);
      const done = isStageComplete(s, row as any);
      
      const stageSince = (row as any)[`${colOf(s, "status")}_since`] || row.status_since;
      const dwell = stageSince ? getDays(stageSince) : 0;
      
      const etaCol = colOf(s, "eta");
      const badge = etaBadge((row as any)[etaCol]);
      
      const assigneeCol = colOf(s, "assignee");
      const assignee = (row as any)[assigneeCol];
      const reviewerCol = colOf(s, "reviewer");
      const reviewer = (row as any)[reviewerCol];
      
      const assigneeName = names[assignee] || assignee || "unassigned";
      const reviewerName = names[reviewer] || reviewer || "unassigned";
      
      // 1. Overdue
      if (badge && (badge.tone === "eta-late" || badge.tone === "eta-over") && !done) {
        groups.overdue.push({ row, pipelineName, stage: s, message: `${assigneeName} · ETA ${badge.text}` });
        continue;
      }
      // 2. Waiting for review
      if (st === "In Review" && dwell >= THRESHOLDS.review) {
        groups.review.push({ row, pipelineName, stage: s, message: `${reviewerName} · waiting ${dwell}d` });
        continue;
      }
      // 3. Bounced, untouched
      if (st === "Need Changes" && dwell >= THRESHOLDS.bounced) {
        groups.bounced.push({ row, pipelineName, stage: s, message: `${assigneeName} · sent back ${dwell}d ago` });
        continue;
      }
      
      const open = isGateOpen(pipeline, s, row as any);
      // 4. Ready, nobody assigned
      if (open && st === "To Do" && !assignee) {
        groups.unassigned.push({ row, pipelineName, stage: s, message: `unassigned` });
        continue;
      }
      // 5. Ready, not started
      if (open && st === "To Do" && assignee && dwell >= THRESHOLDS.idle) {
        groups.idle.push({ row, pipelineName, stage: s, message: `${assigneeName} · idle ${dwell}d` });
        continue;
      }
    }
  }

  const multiSystem = pipelines.length > 1;
  const anyItems = Object.values(groups).some((g) => g.length > 0);

  if (!anyItems) {
    return <div className="mb-4 text-sm font-medium text-muted-foreground">Nothing needs attention ✅</div>;
  }

  return (
    <div className="mb-6 space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">Needs your attention</h3>
      <GroupCard title="Overdue or Late" tone="destructive" items={groups.overdue} onOpen={onOpen} multiSystem={multiSystem} />
      <GroupCard title="Waiting for Review" tone="warning" items={groups.review} onOpen={onOpen} multiSystem={multiSystem} />
      <GroupCard title="Bounced & Untouched" tone="destructive" items={groups.bounced} onOpen={onOpen} multiSystem={multiSystem} />
      <GroupCard title="Ready, Unassigned" tone="warning" items={groups.unassigned} onOpen={onOpen} multiSystem={multiSystem} />
      <GroupCard title="Ready, Idle" tone="warning" items={groups.idle} onOpen={onOpen} multiSystem={multiSystem} />
    </div>
  );
}

function GroupCard({ title, tone, items, onOpen, multiSystem }: { title: string, tone: "destructive" | "warning", items: AttentionItem[], onOpen: (row: BoardRow, stageId: string) => void, multiSystem: boolean }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const bg = tone === "destructive" ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400";
  const badgeBg = tone === "destructive" ? "bg-destructive/20" : "bg-amber-500/20";

  return (
    <div className={cn("rounded-lg border overflow-hidden", bg)}>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left">
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className="flex-1">{title}</span>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", badgeBg)}>{items.length}</span>
      </button>
      {open && (
        <div className="border-t border-current/10 divide-y divide-current/10">
          {items.map((item, i) => (
            <button key={i} type="button" onClick={() => onOpen(item.row, item.stage.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-3">
              <div className="flex-1 truncate">
                <span className="font-semibold">{item.row.video_title}</span>
                <span className="mx-2 opacity-50">·</span>
                <span className="opacity-90">{item.stage.label}</span>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap text-xs opacity-80">
                {multiSystem && <span className="bg-current/10 px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]">{item.pipelineName}</span>}
                {item.message}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
