import { ArrowRight } from "lucide-react";
import type { ReviewItem } from "./api";
import { pipeOf } from "./stages";

interface ReviewQueueProps {
  items: ReviewItem[];
  onOpen: (item: ReviewItem) => void;
}

/** Reviewer inbox — what's been submitted to me, by whom, on which stage. */
export function ReviewQueue({ items, onOpen }: ReviewQueueProps) {
  if (items.length === 0) {
    return <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">Nothing waiting for your review right now. 🎉</div>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={`${item.row_id}:${item.statusCol}`}
          role="button" tabIndex={0}
          onClick={() => onOpen(item)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(item); }}
          className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-xs transition-all hover:border-foreground/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20">{item.stage}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/70">{pipeOf(item.row as Record<string, unknown>).name}</span>
            <span className="truncate text-sm font-medium text-foreground">{item.video_title || "(no title)"}</span>
            {item.submittedByName && <span className="text-xs text-muted-foreground">submitted by {item.submittedByName}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
            Review <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      ))}
    </div>
  );
}
