import { useState, useEffect } from "react";
import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";
import { canEdit, isApprover, canSetValue } from "../shared/rbac";
import { updateCell, ForbiddenError } from "./api";
import { POLICY } from "../shared/policy";
import { LANES } from "./lanes";
import { FIELD_LABELS, LANE_LABELS, FEEDBACK_COL, LINK_HINTS } from "./labels";

interface CardDetailProps {
  row: Row;
  columns: Column[];
  role: string;
  laneStatus: string;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const LANE_COLUMNS = new Set(["topic_status","tutorial_status","video_editor_status","yt_upload_status"]);

export function CardDetail({ row, columns, role, laneStatus, readOnly, onClose, onSaved }: CardDetailProps) {
  const [draft, setDraft] = useState<Partial<Record<Column, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<Column, string>>>({});
  const [saving, setSaving] = useState(false);

  // Approver action state
  const [approverAction, setApproverAction] = useState<"none" | "sendback">("none");
  const [sendBackNote, setSendBackNote] = useState("");
  const [approverBusy, setApproverBusy] = useState(false);

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

  // In read-only preview mode, ALL columns become brief (read-only).
  const briefCols = readOnly
    ? columns.filter(c => c !== "row_id")
    : columns.filter(c => c !== "row_id" && !canEdit(role, c));
  const editCols = readOnly
    ? []
    : columns.filter(c => c !== "row_id" && canEdit(role, c));

  // Derived: the board's laneStatus (the status col that drives the current board view).
  // Used for approver actions and feedback display.
  const boardLaneStatus = laneStatus ?? POLICY[role]?.laneStatus ?? "";

  // Doer feedback: show the feedback column for this role's owned stage
  const doerFeedbackCol = !isApprover(role) ? FEEDBACK_COL[POLICY[role]?.laneStatus ?? ""] : undefined;
  const doerFeedbackText = doerFeedbackCol ? (row[doerFeedbackCol as Column] ?? "") : "";

  // Approver: show approve/send-back only when card is "In Review" on the board's laneStatus
  const showApproverActions =
    !readOnly &&
    isApprover(role) &&
    boardLaneStatus !== "" &&
    (row[boardLaneStatus as Column] ?? "") === "In Review";

  async function handleApprove() {
    if (!row.row_id) return;
    setApproverBusy(true);
    try {
      await updateCell(row.row_id, boardLaneStatus as Column, "Done");
    } catch { /* server will enforce */ }
    setApproverBusy(false);
    onSaved();
    onClose();
  }

  async function handleSendBack() {
    if (!row.row_id) return;
    setApproverBusy(true);
    try {
      await updateCell(row.row_id, boardLaneStatus as Column, "In Progress");
      const fbCol = FEEDBACK_COL[boardLaneStatus];
      if (fbCol && sendBackNote.trim()) {
        await updateCell(row.row_id, fbCol as Column, sendBackNote.trim());
      }
    } catch { /* server will enforce */ }
    setApproverBusy(false);
    onSaved();
    onClose();
  }

  const title = row.video_title ?? "(no title)";

  return (
    <>
      {/* Scrim — click outside to close */}
      <div className="detail-overlay" onClick={onClose} />

      <div className="detail-panel" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <button className="panel__close" onClick={onClose} aria-label="Close">×</button>

        <h2>{title}</h2>

        {/* Doer: feedback note from reviewer (shown prominently when non-empty) */}
        {doerFeedbackText && (
          <div className="detail-feedback-note">
            <span className="detail-feedback-note__icon">⚠</span>
            <div>
              <div className="detail-feedback-note__label">Reviewer note</div>
              <div className="detail-feedback-note__text">{doerFeedbackText}</div>
            </div>
          </div>
        )}

        {/* Approver actions (only for In-Review cards) */}
        {showApproverActions && (
          <div className="approver-actions">
            <button
              className="btn-approve"
              onClick={() => void handleApprove()}
              disabled={approverBusy}
            >
              {approverBusy && approverAction === "none" ? "…" : "✓ Approve"}
            </button>
            <button
              className="btn-sendback"
              onClick={() => setApproverAction(a => a === "sendback" ? "none" : "sendback")}
              disabled={approverBusy}
            >
              ↩ Send back
            </button>
            {approverAction === "sendback" && (
              <div className="sendback-form">
                <textarea
                  className="sendback-textarea"
                  placeholder="Feedback for the freelancer…"
                  value={sendBackNote}
                  onChange={e => setSendBackNote(e.target.value)}
                  rows={3}
                />
                <button
                  className="btn-sendback-confirm"
                  onClick={() => void handleSendBack()}
                  disabled={approverBusy}
                >
                  {approverBusy ? "…" : "Confirm send back"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* THE BRIEF — read-only */}
        {briefCols.length > 0 && (
          <>
            <div className="ctx-label">The brief — read only</div>
            {briefCols.map(col => {
              const value = draft[col] ?? "";
              const label = FIELD_LABELS[col] ?? col.replace(/_/g, " ");
              return (
                <div key={col} className="field">
                  <label>{label}</label>
                  <div className="ro">{value}</div>
                </div>
              );
            })}
          </>
        )}

        {/* Divider before YOUR PART */}
        {briefCols.length > 0 && editCols.length > 0 && (
          <div className="divider-line" />
        )}

        {/* YOUR PART — editable */}
        {editCols.length > 0 && (
          <div className="yours">
            <div className="yours-tag">YOUR PART</div>
            {editCols.map(col => {
              const editable = canEdit(role, col);
              const value = draft[col] ?? "";
              const err = errors[col];
              const isLaneCol = LANE_COLUMNS.has(col);
              const rawLaneValues = isLaneCol ? (LANES[col] ?? []) : [];
              const label = FIELD_LABELS[col] ?? col.replace(/_/g, " ");
              // lane labels for this col
              const friendlyMap = LANE_LABELS[col] ?? {};

              if (!editable) return null; // shouldn't happen but guard

              return (
                <div key={col} className="field">
                  <label htmlFor={`field-${col}`}>{label}</label>
                  {isLaneCol ? (
                    <select
                      id={`field-${col}`}
                      value={value}
                      onChange={e => handleChange(col, e.target.value)}
                    >
                      {value && !rawLaneValues.includes(value) && (
                        <option value={value}>{friendlyMap[value] ?? value}</option>
                      )}
                      {rawLaneValues
                        .filter(v => canSetValue(role, col, v))
                        .map(v => (
                          <option key={v} value={v}>{friendlyMap[v] ?? v}</option>
                        ))}
                    </select>
                  ) : (
                    <input
                      id={`field-${col}`}
                      type="text"
                      value={value}
                      placeholder={`Paste your ${label.toLowerCase()}…`}
                      onChange={e => handleChange(col, e.target.value)}
                    />
                  )}
                  {LINK_HINTS[col] && (
                    <div className="field-hint">🔗 {LINK_HINTS[col]}</div>
                  )}
                  {err && <div className="field-error">{err}</div>}
                </div>
              );
            })}
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}

        {/* Admin: if all columns are editable, show them without the brief/yours split */}
        {briefCols.length === 0 && editCols.length === 0 && (
          <p style={{ color: "var(--t4)", fontSize: "13px" }}>No editable fields.</p>
        )}
      </div>
    </>
  );
}
