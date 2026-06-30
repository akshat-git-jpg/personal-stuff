import type { ReviewItem } from "./api";
import { pipeOf } from "./stages";

interface ReviewQueueProps {
  items: ReviewItem[];
  onOpen: (item: ReviewItem) => void;
}

/** Reviewer inbox — what's been submitted to me, by whom, on which stage. */
export function ReviewQueue({ items, onOpen }: ReviewQueueProps) {
  if (items.length === 0) {
    return <div className="awaiting-empty">Nothing waiting for your review right now. 🎉</div>;
  }
  return (
    <div className="awaiting-list">
      {items.map((item) => (
        <div key={`${item.row_id}:${item.statusCol}`} className="awaiting-item awaiting-item--clickable"
          role="button" tabIndex={0}
          onClick={() => onOpen(item)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(item); }}>
          <div className="awaiting-item__meta">
            <span className="awaiting-item__stage">{item.stage}</span>
            <span className="sys-chip">{pipeOf(item.row as Record<string, unknown>).name}</span>
            <span className="awaiting-item__title">{item.video_title || "(no title)"}</span>
            {item.submittedByName && <span className="awaiting-item__assignee">submitted by {item.submittedByName}</span>}
          </div>
          <div className="awaiting-item__hint">Review →</div>
        </div>
      ))}
    </div>
  );
}
