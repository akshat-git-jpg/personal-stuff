import { Clock, Trash2, AlertTriangle, Hourglass } from "lucide-react";
import type { Row, Transition } from "../shared/rbac";
import { pipeOf, stageByStatusColIn, normalizeStatusIn, feedbackColOf, assigneeColOf, sinceOf } from "./stages";
import { displayName } from "./api";
import { daysSince } from "./pipeline";
import { statusMeta, toneBadge, toneDot } from "./status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CardProps {
  row: Row;
  statusCol: string;             // the lane/status column this card is shown under
  transitions?: Transition[];    // allowed transitions for this stage + user
  names?: Record<string, string>;
  readOnly?: boolean;
  showAssignee?: boolean;        // admin/reviewer views where many people mix
  showDwell?: boolean;           // show "in <status> since N days"
  showStage?: boolean;           // show stage chip
  showSystem?: boolean;          // show system chip
  canDelete?: boolean;           // admin: show the delete affordance
  onDelete?: () => void;
  onOpen: () => void;
  onAction?: (t: Transition) => void;
}

// One status pill, identical on cards / lanes / legend.
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", toneBadge(meta.tone), className)}>
      <span className={cn("size-1.5 rounded-full", toneDot(meta.tone))} />
      {meta.label}
    </span>
  );
}

export function Card({ row, statusCol, transitions = [], names = {}, readOnly, showAssignee, showDwell, showStage, showSystem, canDelete, onDelete, onOpen, onAction }: CardProps) {
  const p = pipeOf(row as Record<string, unknown>);
  const stage = stageByStatusColIn(p, statusCol);
  const status = stage ? normalizeStatusIn(stage, row[statusCol as keyof Row] as string) : "To Do";
  const meta = statusMeta(status);

  // Days THIS STAGE has sat in its current status (falls back to the card-level
  // stamp for stages that predate per-stage `_since` tracking).
  const dwell = showDwell ? daysSince(sinceOf(row as Record<string, unknown>, statusCol)) : null;

  const title = row.video_title ?? "(no title)";
  const cat = row.category ?? "";
  const sub = row.subcategory ?? "";
  const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;
  const notes = row.video_notes ?? "";

  // Need-Changes reason (always present by construction when status is Need Changes).
  const feedbackCol = stage ? feedbackColOf(stage) : undefined;
  const feedback = feedbackCol ? ((row[feedbackCol as keyof Row] as string) ?? "").trim() : "";

  const assigneeCol = stage ? assigneeColOf(stage) : undefined;
  const assignee = assigneeCol ? ((row[assigneeCol as keyof Row] as string) ?? "") : "";

  return (
    <article
      role="button" tabIndex={0} aria-label={title}
      onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group relative flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-card p-3 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <StatusPill status={status} />
        {showStage && stage && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/70">{stage.label}</span>}
        {showSystem && <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/70">{p.name}</span>}
        {dwell !== null && (
          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground"
            title={`In ${meta.label} for ${dwell} day${dwell === 1 ? "" : "s"}`}>
            <Clock className="size-3" /> {dwell === 0 ? "today" : `${dwell}d`}
          </span>
        )}
        {showAssignee && assignee && <span className="truncate text-[11px] text-muted-foreground">{displayName(assignee, names)}</span>}
        {canDelete && onDelete && (
          <button type="button" title="Delete this video" aria-label={`Delete ${title}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="ml-auto rounded-md p-1 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold leading-snug tracking-tight text-foreground text-balance">{title}</h3>
        {catLabel && <div className="text-xs text-muted-foreground">{catLabel}</div>}
      </div>

      {notes && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">{notes}</p>}

      {status === "Need Changes" && feedback && (
        <div className="break-words rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs leading-relaxed text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <span className="font-semibold">Needs changes:</span> {feedback}
          {dwell !== null && <span className="block pt-0.5 text-[11px] text-red-700/70 dark:text-red-300/70">sent back {dwell === 0 ? "today" : `${dwell}d ago`}</span>}
        </div>
      )}

      {!readOnly && transitions.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
            {transitions.map((t) => {
              const reject = t.kind === "reject";
              const reopen = t.kind === "reopen";
              return (
                <Button
                  key={t.to + t.kind}
                  size="sm"
                  variant={reject ? "outline" : reopen ? "ghost" : "default"}
                  disabled={!!t.disabledReason}
                  title={t.disabledReason ?? ""}
                  className={cn("h-7 px-2.5 text-xs", reject && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                  onClick={() => { if (t.disabledReason) return; if (t.requiresFeedback) onOpen(); else onAction?.(t); }}
                >
                  {t.label}
                </Button>
              );
            })}
          </div>
          {transitions.find((t) => t.disabledReason) && (
            <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400" role="status">
              <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
              <span>{transitions.find((t) => t.disabledReason)!.disabledReason}</span>
            </div>
          )}
        </>
      )}

      {!readOnly && status === "In Review" && transitions.length === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Hourglass className="size-3" /> Waiting for review
        </div>
      )}
    </article>
  );
}
