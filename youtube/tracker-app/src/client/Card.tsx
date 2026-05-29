import type { Row } from "../shared/rbac";

interface CardProps {
  row: Row;
  onClick: () => void;
  /** Extra class applied when dragging */
  isDragging?: boolean;
}

const META_FIELDS = ["category", "topic_status", "tutorial_status"] as const;

export function Card({ row, onClick, isDragging = false }: CardProps) {
  const metaFields = META_FIELDS.filter(f => row[f]);

  return (
    <div
      className={`card${isDragging ? " card--dragging" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && onClick()}
      aria-label={row.video_title ?? "Card"}
    >
      <div className="card__title">{row.video_title ?? "(no title)"}</div>
      {metaFields.length > 0 && (
        <div className="card__meta">
          {metaFields.map(f => (
            <span key={f} className="card__tag">
              {String(row[f])}
            </span>
          ))}
        </div>
      )}
      {row.category && <div className="card__sub">{row.category}</div>}
    </div>
  );
}
