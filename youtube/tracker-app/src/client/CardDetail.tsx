import { useState, useEffect, useRef } from "react";
import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";
import { canEdit } from "../shared/rbac";
import { updateCell, ForbiddenError } from "./api";
import { LANES } from "./lanes";

interface CardDetailProps {
  row: Row;
  columns: Column[];
  role: string;
  onClose: () => void;
  onSaved: () => void;
}

const LANE_COLUMNS = new Set(["topic_status", "tutorial_status", "video_editor_status", "yt_upload_status"]);

function fieldLabel(col: Column): string {
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function CardDetail({ row, columns, role, onClose, onSaved }: CardDetailProps) {
  const [draft, setDraft] = useState<Partial<Record<Column, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<Column, string>>>({});
  const [saving, setSaving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialise draft from row
  useEffect(() => {
    const init: Partial<Record<Column, string>> = {};
    for (const col of columns) init[col] = row[col] ?? "";
    setDraft(init);
  }, [row, columns]);

  function handleChange(col: Column, value: string) {
    setDraft(d => ({ ...d, [col]: value }));
    setErrors(e => ({ ...e, [col]: undefined }));
  }

  async function handleSave() {
    setSaving(true);
    const newErrors: Partial<Record<Column, string>> = {};
    let anyError = false;

    for (const col of columns) {
      const original = row[col] ?? "";
      const updated = draft[col] ?? "";
      if (updated === original) continue;
      if (!canEdit(role, col)) continue;
      if (!row.row_id) continue;

      try {
        await updateCell(row.row_id, col, updated);
      } catch (err) {
        anyError = true;
        if (err instanceof ForbiddenError) {
          newErrors[col] = "Permission denied";
        } else {
          newErrors[col] = (err as Error).message ?? "Save failed";
        }
      }
    }

    setSaving(false);
    if (anyError) {
      setErrors(newErrors);
    } else {
      onSaved();
      onClose();
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div className="detail-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="detail-panel">
        <div className="detail-header">
          <h2 className="detail-title">{row.video_title ?? "(no title)"}</h2>
          <button className="detail-close" onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>
        <div className="detail-fields">
          {columns.filter(c => c !== "row_id").map(col => {
            const editable = canEdit(role, col);
            const value = draft[col] ?? "";
            const err = errors[col];
            const isLaneCol = LANE_COLUMNS.has(col);
            const laneValues = isLaneCol ? (LANES[col] ?? []) : [];

            return (
              <div key={col} className={`detail-field${editable ? "" : " detail-field--readonly"}`}>
                <label className="detail-label" htmlFor={`field-${col}`}>{fieldLabel(col)}</label>
                {editable ? (
                  isLaneCol ? (
                    <select
                      id={`field-${col}`}
                      className="detail-input"
                      value={value}
                      onChange={e => handleChange(col, e.target.value)}
                    >
                      {value && !laneValues.includes(value) && (
                        <option value={value}>{value}</option>
                      )}
                      {laneValues.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`field-${col}`}
                      className="detail-input"
                      type="text"
                      value={value}
                      onChange={e => handleChange(col, e.target.value)}
                    />
                  )
                ) : (
                  <div id={`field-${col}`} className="detail-value">{value || <em>—</em>}</div>
                )}
                {err && <div className="detail-error">{err}</div>}
              </div>
            );
          })}
        </div>
        <div className="detail-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
