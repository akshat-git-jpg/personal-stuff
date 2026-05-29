import type { Row } from "../shared/rbac";
import { FEEDBACK_COL } from "./labels";

interface CardProps {
  row: Row;
  onClick: () => void;
  isDragging?: boolean;
  /** The lane-status column that drives this board (e.g. "tutorial_status") */
  laneStatus?: string;
  /** Which columns are visible for this role */
  visibleCols?: string[];
  /** If true, card is locked (approved) — show lock badge, no drag cursor */
  locked?: boolean;
}

// Link column to check for each role's status column
const LINK_FOR_STATUS: Record<string, string> = {
  tutorial_status:     "tutorial_link",
  video_editor_status: "video_editor_link",
  yt_upload_status:    "yt_link",
  // topic_status → no signal
};

// Assignee email column for each status column
const EMAIL_FOR_STATUS: Record<string, string> = {
  tutorial_status:     "tutorial_maker_email",
  video_editor_status: "video_editor_email",
  yt_upload_status:    "reviewer_email",
  topic_status:        "admin_email",
};

function initials(email: string): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Card({ row, onClick, isDragging = false, laneStatus, visibleCols, locked = false }: CardProps) {
  const visible = new Set(visibleCols ?? []);

  // Title
  const showTitle = !visibleCols || visible.has("video_title");
  const title = row.video_title ?? "(no title)";

  // Category chip
  const cat = row.category ?? "";
  const sub = row.subcategory ?? "";
  const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;
  const showCat = catLabel.length > 0 && (!visibleCols || visible.has("category") || visible.has("subcategory"));

  // Brief (2-line excerpt from video_notes)
  const notes = row.video_notes ?? "";
  const showBrief = notes.length > 0 && (!visibleCols || visible.has("video_notes"));

  // Signal: check if the link column has a value
  let signal: { ok: boolean; label: string } | null = null;
  if (laneStatus && laneStatus in LINK_FOR_STATUS) {
    const linkCol = LINK_FOR_STATUS[laneStatus];
    const hasLink = !!(row[linkCol as keyof Row]);
    signal = hasLink
      ? { ok: true,  label: "● Link added" }
      : { ok: false, label: "○ No link yet" };
  }

  // Avatar = assignee initials, shown ONLY when the assignee email is actually
  // visible to this role (Admin/Reviewer views where many people's cards mix).
  // On a freelancer's own board the email is hidden, so we show no avatar.
  const emailCol = laneStatus ? (EMAIL_FOR_STATUS[laneStatus] ?? "") : "";
  const email = emailCol ? (row[emailCol as keyof Row] ?? "") : "";
  const avatar = email ? initials(email) : null;

  // Feedback note for the doer (if the status col has a feedback col)
  const feedbackNote = laneStatus && FEEDBACK_COL[laneStatus]
    ? (row[FEEDBACK_COL[laneStatus] as keyof Row] ?? "")
    : "";

  return (
    <div
      className={`card${isDragging ? " card--dragging" : ""}${locked ? " card--locked" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={title}
      style={locked ? { cursor: "pointer" } : undefined}
    >
      {locked && (
        <div className="card__lock">
          <span>🔒</span> Approved
        </div>
      )}
      {showTitle && <div className="card__title">{title}</div>}
      {showCat && <span className="card__cat">{catLabel}</span>}
      {showBrief && <div className="card__brief">{notes}</div>}
      {feedbackNote && (
        <div className="card__feedback-note">
          ⚠ Reviewer note: {feedbackNote}
        </div>
      )}
      {(signal || avatar) && (
        <div className="card__foot">
          {signal && (
            <span className={`sig ${signal.ok ? "sig--ok" : "sig--warn"}`}>
              {signal.label}
            </span>
          )}
          {avatar && <div className="card__avatar">{avatar}</div>}
        </div>
      )}
    </div>
  );
}
