/**
 * ReviewQueue.tsx — reviewer inbox.
 *
 * Redesign note: every item used to be a "Review →" link that opened the detail
 * modal, where you then hunted for Approve. Approving is the common case and it
 * needs no extra information, so it is now one click on the row itself. Asking
 * for changes still opens the panel, because it needs you to type the reason.
 */
import { Clock } from "lucide-react";
import type { ReviewItem } from "./api";
import type { Transition } from "../shared/rbac";
import { pipeOf, sinceOf } from "./stages";
import { daysSince } from "./pipeline";
import { Button } from "@/components/ui/button";

interface ReviewQueueProps {
  items: ReviewItem[];
  onOpen: (item: ReviewItem) => void;
  /** Run a reviewer transition straight from the row (Approve). */
  onAction?: (item: ReviewItem, t: Transition) => void;
  multiSystem?: boolean;
}

function reviewerTransitions(item: ReviewItem): Transition[] {
  const row = item.row as unknown as { _actions?: { statusCol: string; transitions: Transition[] }[] };
  const group = row._actions?.find((g) => g.statusCol === item.statusCol);
  return (group?.transitions ?? []).filter((t) => t.by === "reviewer");
}

export function ReviewQueue({ items, onOpen, onAction, multiSystem }: ReviewQueueProps) {
  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">Nothing waiting for your review right now.</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const days = daysSince(sinceOf(item.row as Record<string, unknown>, item.statusCol));
        const transitions = reviewerTransitions(item);
        // Approve is the one-click path; anything needing words opens the panel.
        const approve = transitions.find((t) => !t.requiresFeedback && t.kind !== "reject");
        const sendBack = transitions.find((t) => t.requiresFeedback || t.kind === "reject");

        const meta: string[] = [item.stage];
        if (multiSystem) meta.push(pipeOf(item.row as Record<string, unknown>).name);
        if (item.submittedByName) meta.push(`submitted by ${item.submittedByName}`);

        return (
          <article key={`${item.row_id}:${item.statusCol}`}
            role="button" tabIndex={0} aria-label={item.video_title || "Open submission"}
            onClick={() => onOpen(item)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpen(item); }}
            className="group flex cursor-pointer flex-col gap-3 rounded-[10px] border border-border bg-card p-4 shadow-xs transition-all hover:border-foreground/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">

            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-balance text-foreground">{item.video_title || "(no title)"}</h3>
                <div className="text-xs text-muted-foreground">{meta.join(" · ")}</div>
              </div>
              {days !== null && (
                <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-[11px] tabular-nums text-muted-foreground"
                  title={`Waiting ${days} day${days === 1 ? "" : "s"}`}>
                  <Clock className="size-3" /> {days === 0 ? "today" : `${days}d`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" className="h-9 px-3.5 text-[13px]" onClick={() => onOpen(item)}>
                Open the work
              </Button>
              <div className="flex-1" />
              {sendBack && (
                <Button size="sm" variant="ghost" className="h-9 px-3.5 text-[13px] text-muted-foreground hover:text-foreground"
                  onClick={() => onOpen(item)}>
                  {sendBack.label}
                </Button>
              )}
              {approve && (
                <Button size="sm" className="h-9 px-3.5 text-[13px]"
                  disabled={!!approve.disabledReason} title={approve.disabledReason ?? ""}
                  onClick={() => { if (!approve.disabledReason) onAction?.(item, approve); }}>
                  {approve.label}
                </Button>
              )}
              {approve?.disabledReason && (
                <span className="text-[11px] text-muted-foreground" role="status">{approve.disabledReason}</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
