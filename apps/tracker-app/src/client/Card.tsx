import type { Row, Transition } from "../shared/rbac";
import { stageByStatusCol, normalizeStatus } from "../shared/pipeline";
import { displayName } from "./api";
import { daysSince } from "./pipeline";
import { statusMeta } from "./status";
import { FEEDBACK_COL, EMAIL_FOR_STAGE } from "./labels";

interface CardProps {
  row: Row;
  statusCol: string;             // the lane/status column this card is shown under
  transitions?: Transition[];    // allowed transitions for this stage + user
  names?: Record<string, string>;
  readOnly?: boolean;
  showAssignee?: boolean;        // admin/reviewer views where many people mix
  showDwell?: boolean;           // show "in <status> since N days"
  canDelete?: boolean;           // admin: show the delete affordance
  onDelete?: () => void;
  onOpen: () => void;
  onAction?: (t: Transition) => void;
}

export function Card({ row, statusCol, transitions = [], names = {}, readOnly, showAssignee, showDwell, canDelete, onDelete, onOpen, onAction }: CardProps) {
  const stage = stageByStatusCol(statusCol);
  const status = stage ? normalizeStatus(stage, row[statusCol as keyof Row] as string) : "To Do";
  const meta = statusMeta(status);

  // Days the card has sat in its current status (from status_since, stamped on
  // every status change). Blank until the card's next status change.
  const dwell = showDwell ? daysSince((row as Record<string, string>).status_since) : null;

  const title = row.video_title ?? "(no title)";
  const cat = row.category ?? "";
  const sub = row.subcategory ?? "";
  const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;
  const notes = row.video_notes ?? "";

  // Need-Changes reason (always present by construction when status is Need Changes).
  const feedbackCol = FEEDBACK_COL[statusCol];
  const feedback = feedbackCol ? ((row[feedbackCol as keyof Row] as string) ?? "").trim() : "";

  const assigneeCol = EMAIL_FOR_STAGE[statusCol];
  const assignee = assigneeCol ? ((row[assigneeCol as keyof Row] as string) ?? "") : "";

  return (
    <div className="card" role="button" tabIndex={0} aria-label={title}
      onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <div className="card__top">
        <span className={`pill pill--${meta.tone}`}>{meta.label}</span>
        {dwell !== null && (
          <span className="card__dwell" title={`In ${meta.label} since ${dwell} day${dwell === 1 ? "" : "s"}`}>
            ⏱ {dwell === 0 ? "today" : `${dwell}d`}
          </span>
        )}
        {showAssignee && assignee && <span className="card__who">{displayName(assignee, names)}</span>}
        {canDelete && onDelete && (
          <button type="button" className="card__delete" title="Delete this video" aria-label={`Delete ${title}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}>🗑</button>
        )}
      </div>
      <div className="card__title">{title}</div>
      {catLabel && <span className="card__cat">{catLabel}</span>}
      {notes && <div className="card__brief">{notes}</div>}

      {status === "Need Changes" && feedback && (
        <div className="card__needs">
          <strong>Needs changes:</strong> {feedback}
        </div>
      )}

      {!readOnly && transitions.length > 0 && (
        <>
          <div className="card__actions" onClick={(e) => e.stopPropagation()}>
            {transitions.map((t) => (
              <button
                key={t.to + t.kind}
                type="button"
                className={`act act--${t.kind}`}
                disabled={!!t.disabledReason}
                title={t.disabledReason ?? ""}
                onClick={() => { if (t.disabledReason) return; if (t.requiresFeedback) onOpen(); else onAction?.(t); }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {transitions.find((t) => t.disabledReason) && (
            <div className="card__needhint">{transitions.find((t) => t.disabledReason)!.disabledReason}</div>
          )}
        </>
      )}

      {!readOnly && status === "In Review" && transitions.length === 0 && (
        <div className="card__waiting">⏳ Waiting for review</div>
      )}
    </div>
  );
}
