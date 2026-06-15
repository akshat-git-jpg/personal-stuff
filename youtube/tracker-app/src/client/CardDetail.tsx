import { useState, useEffect } from "react";
import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";
import { canEditForRoles, isApproverRoles, canSetValueForRoles, isFieldLocked } from "../shared/rbac";
import { updateCell, review, displayName, ForbiddenError } from "./api";
import { LANES } from "./lanes";
import { FIELD_LABELS, LANE_LABELS, FEEDBACK_COL, LINK_HINTS, LINK_COLS, isUrl, STAGE_NAME, ARTIFACT_COL, EMAIL_FOR_STAGE } from "./labels";

interface CardDetailProps {
  row: Row;
  columns: Column[];
  role: string;        // legacy single role (kept for back-compat)
  roles: string[];     // multi-role array
  names: Record<string, string>;
  laneStatus: string;
  readOnly?: boolean;
  canEditAll?: boolean;   // session user is an admin → full edit authority even while previewing
  onClose: () => void;
  onSaved: () => void;
}

const LANE_COLUMNS = new Set(["topic_status","script_status","tutorial_status","video_editor_status","yt_upload_status"]);

// Columns whose values are email addresses — show resolved name + small email hint.
const EMAIL_COLS = new Set([
  "script_writer_email",
  "tutorial_maker_email",
  "video_editor_email",
  "reviewer_email",
  "admin_email",
]);

// ── Section definitions ───────────────────────────────────────────────────────
// Order matters: sections are rendered top-to-bottom in this order.
interface SectionDef {
  key: string;
  label: string;
  icon: string;
  cols: Column[];
}

const SECTIONS: SectionDef[] = [
  {
    key: "brief",
    label: "Brief",
    icon: "📋",
    cols: [
      "video_title","video_notes","video_description","category","subcategory",
      "topic_status","topic_date","admin_email",
    ],
  },
  {
    key: "script",
    label: "Script",
    icon: "✍️",
    cols: ["script_writer_email","script_instruction","script_link","script_status","script_feedback"],
  },
  {
    key: "recording",
    label: "Recording",
    icon: "🎬",
    cols: ["tutorial_maker_email","tutorial_instruction","tutorial_link","tutorial_status","tutorial_feedback"],
  },
  {
    key: "editing",
    label: "Editing",
    icon: "✂️",
    cols: ["video_editor_email","video_editor_instruction","video_editor_link","video_editor_status","editor_feedback"],
  },
  {
    key: "publish",
    label: "Publish",
    icon: "🚀",
    cols: ["reviewer_email","yt_upload_status","yt_upload_date","yt_link","short_links","actual_links"],
  },
];

// Maps a board laneStatus column → section key (the "active section").
const LANE_STATUS_TO_SECTION: Record<string, string> = {
  topic_status:        "brief",
  script_status:       "script",
  tutorial_status:     "recording",
  video_editor_status: "editing",
  yt_upload_status:    "publish",
};

/** Derive /api/review stage from the boardLaneStatus column key */
function stageFromLaneStatus(laneStatus: string): "script" | "tutorial" | "editor" | "upload" {
  if (laneStatus === "script_status")        return "script";
  if (laneStatus === "tutorial_status")      return "tutorial";
  if (laneStatus === "video_editor_status")  return "editor";
  return "upload";
}

// ── SectionAccordion component ────────────────────────────────────────────────
interface SectionAccordionProps {
  sectionKey: string;
  label: string;
  icon: string;
  isOpen: boolean;
  isActive: boolean;  // visually accent if this is the active/relevant section
  onToggle: () => void;
  children: React.ReactNode;
}

function SectionAccordion({ sectionKey: _sectionKey, label, icon, isOpen, isActive, onToggle, children }: SectionAccordionProps) {
  return (
    <div className={`sec-accordion${isActive ? " sec-accordion--active" : ""}${isOpen ? " sec-accordion--open" : ""}`}>
      <button
        type="button"
        className="sec-accordion__header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="sec-accordion__icon">{icon}</span>
        <span className="sec-accordion__label">{label}</span>
        <span className="sec-accordion__caret">{isOpen ? "▾" : "▸"}</span>
      </button>
      {isOpen && (
        <div className="sec-accordion__body">
          {children}
        </div>
      )}
    </div>
  );
}

export function CardDetail({ row, columns, roles, names, laneStatus, readOnly, canEditAll, onClose, onSaved }: CardDetailProps) {
  // Edit authority is separate from the field VIEW: an admin previewing a
  // member's card sees the member's fields but edits with full admin power.
  const editRoles = canEditAll ? [...roles, "Admin"] : roles;

  const [draft, setDraft] = useState<Partial<Record<Column, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<Column, string>>>({});
  const [saving, setSaving] = useState(false);

  // Approver action state
  const [approverAction, setApproverAction] = useState<"none" | "sendback">("none");
  const [sendBackNote, setSendBackNote] = useState("");
  const [approverBusy, setApproverBusy] = useState(false);

  // Derived: the board's laneStatus
  const boardLaneStatus = laneStatus ?? "";
  const activeSection = LANE_STATUS_TO_SECTION[boardLaneStatus] ?? "brief";

  // Default-open state: active section + brief always open (unless active IS brief)
  const defaultOpen = (): Record<string, boolean> => {
    const init: Record<string, boolean> = {};
    for (const s of SECTIONS) {
      init[s.key] = s.key === activeSection || s.key === "brief";
    }
    return init;
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(defaultOpen);

  // Re-compute open sections if laneStatus changes (e.g. parent re-uses component)
  useEffect(() => {
    setOpenSections(defaultOpen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardLaneStatus]);

  useEffect(() => {
    const init: Partial<Record<Column, string>> = {};
    for (const col of columns) init[col] = row[col] ?? "";
    setDraft(init);
  }, [row, columns]);

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

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
      // Only save if the role(s) can edit AND the field isn't locked
      if (!canEditForRoles(editRoles, col)) continue;
      if (isFieldLocked(editRoles, col, row)) continue;
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

  const isApprover = isApproverRoles(editRoles);

  // A doer's submitted-for-review card is frozen: show it fully read-only (incl.
  // the status dropdown) so the only way back is dragging it to "Working on it".
  const submittedLocked =
    !isApprover && (row[boardLaneStatus as Column] ?? "").toString().trim() === "In Review";
  const effReadOnly = readOnly || submittedLocked;

  // Doer feedback: show feedback cols for any stages the user is a doer of
  const doerFeedbackEntries: { col: string; text: string }[] = [];
  if (!isApprover) {
    for (const [statusCol, feedbackCol] of Object.entries(FEEDBACK_COL)) {
      if (statusCol === boardLaneStatus) {
        const text = (row[feedbackCol as Column] ?? "").trim();
        if (text) doerFeedbackEntries.push({ col: feedbackCol, text });
      }
    }
  }

  // Approver: show approve/send-back only when card is "In Review" on the board's laneStatus
  const showApproverActions =
    !readOnly &&
    isApprover &&
    boardLaneStatus !== "" &&
    (row[boardLaneStatus as Column] ?? "") === "In Review";

  async function handleApprove() {
    if (!row.row_id) return;
    setApproverBusy(true);
    try {
      await review(row.row_id, stageFromLaneStatus(boardLaneStatus), "approve");
    } catch { /* server will enforce */ }
    setApproverBusy(false);
    onSaved();
    onClose();
  }

  async function handleSendBack() {
    if (!row.row_id) return;
    setApproverBusy(true);
    try {
      await review(row.row_id, stageFromLaneStatus(boardLaneStatus), "sendback", sendBackNote.trim() || undefined);
    } catch { /* server will enforce */ }
    setApproverBusy(false);
    onSaved();
    onClose();
  }

  const title = row.video_title ?? "(no title)";

  // ── Focused review mode ───────────────────────────────────────────────────
  const isReviewMode = showApproverActions;
  const stageName = STAGE_NAME[boardLaneStatus] ?? boardLaneStatus;
  const artifactCol = ARTIFACT_COL[boardLaneStatus] ?? "";
  const artifactValue = artifactCol ? (row[artifactCol as Column] ?? "") : "";
  const artifactIsUrl = isUrl(artifactValue);
  const assigneeEmailCol = EMAIL_FOR_STAGE[boardLaneStatus] ?? "";
  const assigneeEmail = assigneeEmailCol ? (row[assigneeEmailCol as Column] ?? "") : "";
  const assigneeDisplay = assigneeEmail ? displayName(assigneeEmail, names) : "";

  // Stage dot color: script=todo(slate), tutorial=prog(blue), video_editor=review(amber), yt_upload=done(green)
  const STAGE_DOT_COLOR: Record<string, string> = {
    script_status:        "var(--todo, #64748b)",
    tutorial_status:      "var(--prog)",
    video_editor_status:  "var(--review)",
    yt_upload_status:     "var(--done)",
  };
  const stageDotColor = STAGE_DOT_COLOR[boardLaneStatus] ?? "var(--accent)";

  // ── Helper: render a read-only field value ────────────────────────────────
  function renderReadOnlyValue(col: string, value: string) {
    if (EMAIL_COLS.has(col) && value) {
      const name = displayName(value, names);
      const isDifferent = name !== value;
      return (
        <div className="ro">
          <span>{name}</span>
          {isDifferent && <span style={{ color: "var(--t4)", fontSize: "11px", marginLeft: "6px" }}>{value}</span>}
        </div>
      );
    }
    if (LINK_COLS.has(col) && isUrl(value)) {
      return (
        <div className="ro ro--link">
          <span className="ro__link-text">{value}</span>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="ext-link"
          >
            Open ↗
          </a>
        </div>
      );
    }
    return <div className="ro">{value}</div>;
  }

  // ── Helper: render a single field (read-only or editable) ────────────────
  function renderField(col: Column) {
    const value = draft[col] ?? "";
    const err = errors[col];
    const label = FIELD_LABELS[col] ?? col.replace(/_/g, " ");
    const canEdit = !effReadOnly && canEditForRoles(editRoles, col) && !isFieldLocked(editRoles, col, row);

    if (!canEdit) {
      // read-only
      return (
        <div key={col} className="field">
          <label>{label}</label>
          {renderReadOnlyValue(col, value)}
        </div>
      );
    }

    // editable
    const isLaneCol = LANE_COLUMNS.has(col);
    const rawLaneValues = isLaneCol ? (LANES[col] ?? []) : [];
    const friendlyMap = LANE_LABELS[col] ?? {};
    const isEmailCol = EMAIL_COLS.has(col);

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
              .filter(v => canSetValueForRoles(editRoles, col, v))
              .map(v => (
                <option key={v} value={v}>{friendlyMap[v] ?? v}</option>
              ))}
          </select>
        ) : (
          <>
            <input
              id={`field-${col}`}
              type="text"
              value={value}
              placeholder={`Paste your ${label.toLowerCase()}…`}
              onChange={e => handleChange(col, e.target.value)}
            />
            {isEmailCol && value && (
              <div className="field-hint" style={{ color: "var(--t3)" }}>
                → {displayName(value, names)}
              </div>
            )}
            {LINK_COLS.has(col) && isUrl(value) && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="ext-link ext-link--below-input"
              >
                Open ↗
              </a>
            )}
          </>
        )}
        {LINK_HINTS[col] && (
          <div className="field-hint">🔗 {LINK_HINTS[col]}</div>
        )}
        {err && <div className="field-error">{err}</div>}
      </div>
    );
  }

  // ── Compute visible sections ──────────────────────────────────────────────
  // A section is visible if at least one of its cols appears in user's columns list.
  const colSet = new Set<string>(columns);

  // Check whether any section has editable fields (for Save button display)
  const hasAnyEditable = !effReadOnly && columns.some(
    col => canEditForRoles(editRoles, col) && !isFieldLocked(editRoles, col, row)
  );

  // ── Approver actions block ────────────────────────────────────────────────
  const approverActionsBlock = showApproverActions ? (
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
  ) : null;

  // ── Section rendering helper ──────────────────────────────────────────────
  function renderSections(forReviewMode: boolean) {
    return SECTIONS.map(sec => {
      // Filter to cols visible to this user
      const visibleCols = sec.cols.filter(c => colSet.has(c as Column));
      if (visibleCols.length === 0) return null;

      const isActive = sec.key === activeSection;
      // In review mode: open = active section OR brief (same logic as normal mode)
      const isOpen = openSections[sec.key] ?? false;

      return (
        <SectionAccordion
          key={sec.key}
          sectionKey={sec.key}
          label={sec.label}
          icon={sec.icon}
          isOpen={isOpen}
          isActive={isActive}
          onToggle={() => toggleSection(sec.key)}
        >
          <div className="sec-accordion__fields">
            {visibleCols.map(c => {
              // In review mode, all fields are read-only (approver sees details, not edit)
              if (forReviewMode) {
                const value = draft[c as Column] ?? "";
                const label = FIELD_LABELS[c] ?? c.replace(/_/g, " ");
                return (
                  <div key={c} className="field">
                    <label>{label}</label>
                    {renderReadOnlyValue(c, value)}
                  </div>
                );
              }
              return renderField(c as Column);
            })}
          </div>
        </SectionAccordion>
      );
    }).filter(Boolean);
  }

  return (
    <>
      {/* Scrim — click outside to close */}
      <div className="detail-overlay" onClick={onClose} />

      <div className="detail-panel" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <button className="panel__close" onClick={onClose} aria-label="Close">×</button>

        <div className="detail-body">
          <h2>{title}</h2>

          {/* ── FOCUSED REVIEW MODE ── */}
          {isReviewMode ? (
            <>
              {/* 1. Stage chip + submitted-by header */}
              <div className="review-header">
                <div className="review-stage-chip">
                  <span className="review-stage-chip__dot" style={{ background: stageDotColor }} />
                  <span className="review-stage-chip__label">Reviewing: {stageName}</span>
                </div>
                {assigneeDisplay && (
                  <div className="review-submitted-by">
                    submitted by <strong>{assigneeDisplay}</strong>
                  </div>
                )}
              </div>

              {/* 2. Prominent artifact link */}
              <div className="review-artifact">
                {artifactIsUrl ? (
                  <a
                    href={artifactValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-artifact"
                  >
                    ▶ Open the {stageName.toLowerCase()} ↗
                  </a>
                ) : (
                  <div className="review-artifact__no-link">(no link provided)</div>
                )}
              </div>

              {/* 3. Approve / Send back */}
              {approverActionsBlock}

              {/* 4. Grouped collapsible sections (review mode: all read-only) */}
              <div className="sec-sections">
                {renderSections(true)}
              </div>
            </>
          ) : (
            <>
              {/* ── NORMAL MODE (non-review opens) ── */}

              {/* Doer: submitted-for-review freeze notice */}
              {submittedLocked && (
                <div className="detail-locked-note">
                  <span className="detail-locked-note__icon">⏳</span>
                  <div>
                    <div className="detail-locked-note__label">Submitted for review</div>
                    <div className="detail-locked-note__text">
                      This card is locked while the reviewer checks it. To make changes,
                      drag it back to “Working on it” on the board.
                    </div>
                  </div>
                </div>
              )}

              {/* Doer: feedback notes from reviewer (shown prominently when non-empty) */}
              {doerFeedbackEntries.map(({ col, text }) => (
                <div key={col} className="detail-feedback-note">
                  <span className="detail-feedback-note__icon">⚠</span>
                  <div>
                    <div className="detail-feedback-note__label">Reviewer note</div>
                    <div className="detail-feedback-note__text">{text}</div>
                  </div>
                </div>
              ))}

              {/* Grouped collapsible sections */}
              <div className="sec-sections">
                {renderSections(false)}
              </div>

              {/* Global Save button at the bottom */}
              {hasAnyEditable && (
                <button
                  className="btn-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              )}

              {columns.length === 0 && (
                <p style={{ color: "var(--t4)", fontSize: "13px" }}>No editable fields.</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
