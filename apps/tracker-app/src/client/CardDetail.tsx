import { useState, useEffect } from "react";
import type { Column } from "../shared/columns";
import type { Row, Transition } from "../shared/rbac";
import { canEditForRoles, isAdminRoles } from "../shared/rbac";
import { STAGES, stageById, statusOf, PROTECTED_ADMIN_EMAIL, REVIEWER_COLS } from "../shared/pipeline";
import { COLUMNS, DATE_COLUMNS, ETA_COLUMNS } from "../shared/columns";
import { fieldType } from "./columnMeta";
import {
  showColumns, editColumns, requiredToApprove, requiredToSubmitFrom,
  missingColumns, columnLabel, type RoleKind,
} from "../shared/control";
import {
  applyTransition, updateCell, generateLinks, displayName, personLabel,
  type BoardRow, type GenerateLinksResult,
} from "./api";
import { statusMeta } from "./status";
import { fieldLabel, LINK_HINTS, LINK_COLS, isUrl, etaBadge } from "./labels";

interface CardDetailProps {
  row: BoardRow;
  columns: Column[];
  roles: string[];
  names: Record<string, string>;
  memberRoles?: Record<string, string>;
  readOnly?: boolean;
  /** Which stage the card was opened while working — scopes the fields/actions shown. */
  contextStageId?: string;
  /** Whose actions to show: doer (My work), reviewer (Review queue), or all (Pipeline). */
  perspective?: "doer" | "reviewer" | "all";
  categoryOptions?: string[];
  subcategoryOptions?: string[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;        // admin: delete this video (confirm handled by caller)
}

// A select of existing values + an "Add new…" escape hatch.
export function ComboSelect({ id, value, options, placeholder, onChange }: {
  id: string; value: string; options: string[]; placeholder: string; onChange: (v: string) => void;
}) {
  const ADD = "__add_new__";
  const [adding, setAdding] = useState(false);
  if (adding) {
    return (
      <div className="combo">
        <input id={id} type="text" autoFocus value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="combo__toggle" title="Pick from the list instead" onClick={() => setAdding(false)}>⌄</button>
      </div>
    );
  }
  return (
    <select id={id} value={value} onChange={(e) => {
      if (e.target.value === ADD) { onChange(""); setAdding(true); } else onChange(e.target.value);
    }}>
      <option value="">— None —</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value={ADD}>➕ Add new…</option>
    </select>
  );
}

const STATUS_COLS = new Set(STAGES.map((s) => s.statusCol));
// Widget membership is derived from the column metadata (columnMeta.ts), so a new
// column's input type is set in ONE place, not re-listed here.
const ASSIGNEE_COLS = new Set(COLUMNS.filter((c) => fieldType(c) === "assignee"));
const MULTILINE_COLS = new Set(COLUMNS.filter((c) => fieldType(c) === "textarea"));
const COMBO_COLS = new Set(COLUMNS.filter((c) => fieldType(c) === "combo"));
const DATE_COLS = new Set<string>(DATE_COLUMNS);
const ETA_COLS = new Set<string>(ETA_COLUMNS);

// Which role each assignee field requires, so its dropdown only lists people who
// actually hold that role. Derived from the pipeline (+ the card-level reviewer).
const ASSIGNEE_ROLE: Record<string, string> = { reviewer_email: "Reviewer", admin_email: "Admin" };
for (const s of STAGES) {
  ASSIGNEE_ROLE[s.assigneeCol] = s.ownerRole;
  if (s.reviewerCol) ASSIGNEE_ROLE[s.reviewerCol] = "Reviewer"; // per-stage reviewer dropdowns
}
// Per-stage reviewer fields: blank means "no review — auto-approve on submit".
const REVIEWER_COL_SET = new Set<string>(REVIEWER_COLS);

// All assignee fields, in pipeline sequence, grouped right after the brief so the
// admin sets them in one place: Scriptwriter → Recorder → Video Editor → Uploader
// → Reviewer → Admin. (Topic's assignee is admin_email, shown once as "Admin".)
const ASSIGNEE_SEQUENCE: Column[] = [
  ...new Set<Column>([
    ...STAGES.filter((s) => s.id !== "topic").map((s) => s.assigneeCol),
    "reviewer_email",
    "admin_email",
  ]),
];

// Section per stage. "Brief" (topic) carries the meta + the whole assignee block.
// Stage sections hold only the work fields (instructions, links, feedback).
interface SectionDef { id: string; label: string; cols: Column[]; }
const SECTIONS: SectionDef[] = STAGES.map((s) => ({
  id: s.id,
  label: s.id === "topic" ? "Brief & assignments" : s.label,
  cols: (s.id === "topic"
    ? ["video_title", "video_notes", "video_description", "category", "subcategory", "topic_date", ...ASSIGNEE_SEQUENCE]
    : [s.instructionCol, ...s.editFields]
  ).filter(Boolean) as Column[],
}));

export function CardDetail({ row, columns, roles, names, memberRoles = {}, readOnly, contextStageId, perspective = "all", categoryOptions = [], subcategoryOptions = [], onClose, onSaved, onDelete }: CardDetailProps) {
  const locks = row._locks ?? {};
  const actionGroups = row._actions ?? [];
  const isAdmin = isAdminRoles(roles);
  const colSet = new Set<string>(columns);

  // The card is scoped to the stage it was opened from: only that stage's curated
  // fields + actions show. Admins get a "Show all fields" escape hatch.
  const contextStage = stageById(contextStageId ?? "") ?? STAGES[0];
  const [showAll, setShowAll] = useState(false);

  // The form is driven by the control tables: which columns show / are editable
  // depends on (stage, role-kind, current status). `worker` = the stage owner's
  // view (My work); `reviewer` = the card reviewer's view (Review queue).
  const kind: RoleKind = perspective === "reviewer" ? "reviewer" : "worker";
  const ctxStatus = statusOf(contextStage, row);
  const editSet = new Set<string>(editColumns(contextStage.id, kind, ctxStatus));

  const [draft, setDraft] = useState<Partial<Record<Column, string>>>({});
  const [savedMap, setSavedMap] = useState<Partial<Record<Column, string>>>({}); // last value persisted to the sheet
  const [fieldStatus, setFieldStatus] = useState<Partial<Record<Column, "saving" | "saved" | "error">>>({});
  const [touched, setTouched] = useState(false); // did we auto-save anything this session?
  const [errors, setErrors] = useState<Partial<Record<Column, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // "Request changes" note (the box is always shown for a reviewer; the button
  // commits the send-back and is enabled once a note is typed).
  const [feedbackText, setFeedbackText] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  // Link generation (admin).
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<GenerateLinksResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    const init: Partial<Record<Column, string>> = {};
    for (const col of columns) init[col] = (row[col] as string) ?? "";
    setDraft(init);
    setSavedMap(init);
    setFieldStatus({});
    setTouched(false);
  }, [row, columns]);

  function editableNow(col: Column): boolean {
    if (readOnly) return false;
    if (STATUS_COLS.has(col)) return false;       // driven by action buttons
    if (col === "admin_email") return false;       // founding admin is fixed
    if (col in locks) return false;                // server says it's locked (submitted/approved/gate)
    if (!canEditForRoles(roles, col)) return false;
    if (isAdmin) return true;                      // admin edits everything the policy allows
    // Everyone else: only what the control table marks editable at THIS status.
    return editSet.has(col);
  }

  // The card's values as they'd be after saving the current edits — used to
  // evaluate the required-field gate against what's typed, not just what's saved.
  const effectiveRow = { ...row, ...draft } as BoardRow;

  function handleChange(col: Column, value: string) {
    setDraft((d) => ({ ...d, [col]: value }));
    setErrors((e) => ({ ...e, [col]: undefined }));
    setFormError(null);
  }

  // Auto-save a single field (on blur / change). No "Save" button — fields persist
  // themselves, and `savedMap` tracks what's on the sheet so the optimistic-lock
  // check uses the right expected value.
  async function autoSaveField(col: Column, value: string) {
    if (!row.row_id || !editableNow(col)) return;
    const prev = savedMap[col] ?? "";
    if (value === prev) return;
    setFieldStatus((s) => ({ ...s, [col]: "saving" }));
    try {
      await updateCell(row.row_id, col, value, prev);
      setSavedMap((m) => ({ ...m, [col]: value }));
      setFieldStatus((s) => ({ ...s, [col]: "saved" }));
      setErrors((e) => ({ ...e, [col]: undefined }));
      setTouched(true);
    } catch (err) {
      setFieldStatus((s) => ({ ...s, [col]: "error" }));
      setErrors((e) => ({ ...e, [col]: err instanceof Error ? err.message : "Save failed" }));
    }
  }

  // Flush any field not yet auto-saved (e.g. a status action fired before a blur).
  // Returns false on error. Compares against savedMap (what's really on the sheet).
  async function flushPending(): Promise<boolean> {
    const newErrors: Partial<Record<Column, string>> = {};
    let anyError = false;
    for (const col of columns) {
      const updated = draft[col] ?? "";
      const prev = savedMap[col] ?? "";
      if (updated === prev || !editableNow(col) || !row.row_id) continue;
      try {
        await updateCell(row.row_id, col, updated, prev);
        setSavedMap((m) => ({ ...m, [col]: updated }));
        setTouched(true);
      } catch (err) {
        anyError = true;
        newErrors[col] = err instanceof Error ? err.message : "Save failed";
      }
    }
    if (anyError) { setErrors(newErrors); return false; }
    return true;
  }

  // Closing the card: if we auto-saved anything, refresh the board (via onSaved)
  // so it reflects the edits; otherwise just close.
  function closeCard() { (touched ? onSaved : onClose)(); }

  async function runTransition(t: Transition, currentStatus: string, feedback?: string) {
    if (!row.row_id) return;
    setActingId(t.stageId + t.to);
    // Flush any not-yet-saved field FIRST, so the status change carries it along.
    if (!(await flushPending())) {
      setActingId(null);
      setFormError("Couldn't save your changes — fix the highlighted fields and try again.");
      return;
    }
    try {
      await applyTransition(row.row_id, t, currentStatus, feedback);
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Action failed");
      setActingId(null);
    }
  }

  async function handleGenerate() {
    if (!row.row_id) return;
    setGenLoading(true); setGenError(null);
    try { setGenResult(await generateLinks(row.row_id)); onSaved(); }
    catch (err) { setGenError(err instanceof Error ? err.message : String(err)); }
    finally { setGenLoading(false); }
  }

  // ── Field renderer ─────────────────────────────────────────────────────────
  function renderField(col: Column) {
    // Admin is always the founding admin — show it prefilled and read-only even
    // when the cell is blank.
    const value = col === "admin_email" ? (draft[col] || PROTECTED_ADMIN_EMAIL) : (draft[col] ?? "");
    const label = fieldLabel(col);
    const lockReason = locks[col];
    const editable = editableNow(col);

    if (!editable) {
      return (
        <div key={col} className="field">
          <label>{label}{lockReason && <span className="lock-tag" title={lockReason}>🔒</span>}</label>
          {ETA_COLS.has(col)
            ? <div className="ro ro--eta">{value || <span className="ro--empty">—</span>}{etaBadge(value) && <span className={`eta-badge eta-badge--${etaBadge(value)!.tone}`}>{etaBadge(value)!.text}</span>}</div>
            : ASSIGNEE_COLS.has(col) && value
            ? <div className="ro">{displayName(value, names)} <span className="ro__sub">{value}</span></div>
            : LINK_COLS.has(col) && isUrl(value)
            ? <div className="ro ro--link"><span className="ro__link-text">{value}</span><a href={value} target="_blank" rel="noopener noreferrer" className="ext-link">Open ↗</a></div>
            : <div className={`ro${MULTILINE_COLS.has(col) ? " ro--para" : ""}`}>{value || <span className="ro--empty">—</span>}</div>}
          {lockReason && <div className="field-lock-note">{lockReason}</div>}
        </div>
      );
    }

    const err = errors[col];
    const st = fieldStatus[col];
    const indicator =
      st === "saving" ? <span className="save-ind">Saving…</span>
      : st === "saved" ? <span className="save-ind save-ind--ok">Saved ✓</span>
      : null;
    return (
      <div key={col} className="field">
        <label htmlFor={`f-${col}`}>{label}{indicator}</label>
        {COMBO_COLS.has(col) ? (
          <ComboSelect id={`f-${col}`} value={value} options={col === "category" ? categoryOptions : subcategoryOptions}
            placeholder={`New ${label.toLowerCase()}…`} onChange={(v) => { handleChange(col, v); void autoSaveField(col, v); }} />
        ) : ASSIGNEE_COLS.has(col) ? (
          (() => {
            const requiredRole = ASSIGNEE_ROLE[col];
            const hasRole = (email: string) =>
              !requiredRole || (memberRoles[email] ?? "").split(",").map((r) => r.trim()).includes(requiredRole);
            const people = Object.keys(names).filter(hasRole).sort((a, b) => names[a].localeCompare(names[b]));
            const cur = value.toLowerCase();
            return (
              <select id={`f-${col}`} value={value} onChange={(e) => { handleChange(col, e.target.value); void autoSaveField(col, e.target.value); }}>
                <option value="">{REVIEWER_COL_SET.has(col) ? "— No review (auto-approve) —" : "— Unassigned —"}</option>
                {value && !people.includes(cur) && <option value={value}>{personLabel(value, names, memberRoles)}</option>}
                {people.map((email) => (
                  <option key={email} value={email}>{personLabel(email, names, memberRoles)}</option>
                ))}
              </select>
            );
          })()
        ) : DATE_COLS.has(col) ? (
          <div className="date-field">
            <input id={`f-${col}`} type="date" value={value}
              onChange={(e) => { handleChange(col, e.target.value); void autoSaveField(col, e.target.value); }} />
            {ETA_COLS.has(col) && etaBadge(value) && <span className={`eta-badge eta-badge--${etaBadge(value)!.tone}`}>{etaBadge(value)!.text}</span>}
          </div>
        ) : MULTILINE_COLS.has(col) ? (
          <textarea id={`f-${col}`} className="field-para" value={value} rows={5} placeholder={`Write the ${label.toLowerCase()}…`}
            onChange={(e) => handleChange(col, e.target.value)} onBlur={(e) => void autoSaveField(col, e.target.value)} />
        ) : (
          <>
            <input id={`f-${col}`} type="text" value={value}
              placeholder={LINK_COLS.has(col) ? `Paste the ${label.toLowerCase()} link…` : `Enter the ${label.toLowerCase()}…`}
              onChange={(e) => handleChange(col, e.target.value)} onBlur={(e) => void autoSaveField(col, e.target.value)} />
            {LINK_COLS.has(col) && isUrl(value) && <a href={value} target="_blank" rel="noopener noreferrer" className="ext-link ext-link--below-input">Open ↗</a>}
          </>
        )}
        {LINK_HINTS[col] && <div className="field-hint">🔗 {LINK_HINTS[col]}</div>}
        {err && <div className="field-error">{err}</div>}
      </div>
    );
  }

  // ── Action area (scoped to the context stage + the viewer's perspective) ─────
  function renderActions() {
    const inPerspective = (t: Transition) => perspective === "all" || t.by === perspective;
    const groups = (showAll ? actionGroups : actionGroups.filter((g) => g.stageId === contextStage.id))
      .map((g) => ({ ...g, transitions: g.transitions.filter(inPerspective) }))
      .filter((g) => g.transitions.length > 0);
    if (readOnly || groups.length === 0) return null;
    return (
      <div className="detail-actions">
        {groups.map((g) => {
          const stage = stageById(g.stageId);
          if (!stage) return null;
          const status = statusOf(stage, row);
          const meta = statusMeta(status);
          // Raw stored value for the optimistic-lock check (blank stays blank).
          const rawStatus = (row[g.statusCol as Column] as string) ?? "";
          // Re-evaluate the required-field gate against what's TYPED (draft), not
          // just what's saved — so pasting the link enables Submit immediately
          // (clicking it then saves the link + moves the status in one go).
          // Required-field gate, re-evaluated against TYPED values (effectiveRow):
          //  • Start (To Do→In Progress) / Submit / Mark-uploaded → worker mustFill
          //  • Approve → reviewer toApprove (e.g. the next worker's instruction)
          const blockReason = (t: Transition): string | undefined => {
            let cols: Column[];
            if (t.kind === "approve") cols = requiredToApprove(stage.id);
            else if (t.kind === "submit" || t.kind === "advance") cols = requiredToSubmitFrom(stage.id, status);
            else if (t.kind === "start" && status === "To Do") cols = requiredToSubmitFrom(stage.id, "To Do");
            else return undefined;
            const missing = missingColumns(cols, effectiveRow as Record<string, unknown>);
            return missing.length ? `Add the ${missing.map(columnLabel).join(", ")} first.` : undefined;
          };
          const hint = g.transitions.map(blockReason).find(Boolean);
          return (
            <div key={g.stageId} className="detail-action-row">
              <div className="detail-action-row__label">
                <strong>{stage.label}</strong> <span className={`pill pill--${meta.tone}`}>{meta.label}</span>
              </div>
              {/* Non-feedback actions (Approve / Start / Submit / Mark uploaded) */}
              {g.transitions.some((t) => !t.requiresFeedback) && (
                <div className="detail-action-row__btns">
                  {g.transitions.filter((t) => !t.requiresFeedback).map((t) => {
                    const reason = blockReason(t);
                    return (
                      <button key={t.to + t.kind} type="button" className={`act act--${t.kind}`}
                        disabled={actingId !== null || !!reason} title={reason ?? ""}
                        onClick={() => { if (!reason) void runTransition(t, rawStatus); }}>{t.label}</button>
                    );
                  })}
                </div>
              )}
              {hint && (
                <div className="detail-action-row__hint" role="status">
                  <span className="hint-icon" aria-hidden="true">⚠</span>
                  <span>{hint}</span>
                </div>
              )}
              {/* Send-back: the box is always shown; the button IS the action, enabled once a note is typed. */}
              {g.transitions.filter((t) => t.requiresFeedback).map((t) => (
                <div key={"fb" + t.to} className="sendback-form">
                  <label className="sendback-label">Or send it back — say what to change:</label>
                  <textarea className="sendback-textarea" rows={3} placeholder="What needs to change?"
                    value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                  <button className="act act--reject" disabled={actingId !== null || !feedbackText.trim()}
                    onClick={() => void runTransition(t, rawStatus, feedbackText.trim())}>{t.label}</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Feedback banners: show the reviewer's note while the stage is being
  //    reworked (Need Changes → In Progress → resubmit), i.e. any time feedback
  //    exists and the stage isn't yet approved. This is the ONLY place feedback
  //    is shown (it's no longer an editable field). ──────────────────────────
  const feedbackBanners = STAGES
    .filter((s) => (showAll || s.id === contextStage.id) && s.reviewable && s.feedbackCol && colSet.has(s.feedbackCol) && statusOf(s, row) !== "Done")
    .map((s) => ({ stage: s, text: ((row[s.feedbackCol as Column] as string) ?? "").trim() }))
    .filter((b) => b.text);

  const title = row.video_title ?? "(no title)";

  // Default: the columns the control table shows for this stage + role-kind at
  // the current status. "Show all fields" (admin) falls back to the full per-stage
  // section breakdown.
  const contextCols = showColumns(contextStage.id, kind, ctxStatus).filter((c) => colSet.has(c));
  const fullSections = SECTIONS
    .map((sec) => ({ ...sec, cols: sec.cols.filter((c) => colSet.has(c)) }))
    .filter((sec) => sec.cols.length > 0);
  const sectionsToShow = showAll
    ? fullSections
    : [{ id: contextStage.id, label: contextStage.id === "topic" ? "Brief & assignments" : contextStage.label, cols: contextCols }]
        .filter((sec) => sec.cols.length > 0);

  return (
    <>
      <div className="detail-overlay" onClick={closeCard} />
      <div className="detail-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="panel__close" onClick={closeCard} aria-label="Close">×</button>
        <div className="detail-body">
          <h2>{title}</h2>

          {/* Stage status overview */}
          <div className="detail-status-row">
            {STAGES.filter((s) => colSet.has(s.statusCol) || isAdmin).map((s) => {
              const m = statusMeta(statusOf(s, row as Row));
              return <span key={s.id} className="detail-status-chip"><span className="detail-status-chip__stage">{s.label}</span><span className={`pill pill--${m.tone}`}>{m.label}</span></span>;
            })}
          </div>

          {feedbackBanners.map(({ stage, text }) => (
            <div key={stage.id} className="needs-banner">
              <span className="needs-banner__icon">⚠</span>
              <div><div className="needs-banner__label">{stage.label} — changes requested</div><div className="needs-banner__text">{text}</div></div>
            </div>
          ))}

          {/* Admin: generate links */}
          {isAdmin && !readOnly && (
            <div className="gen-panel">
              <button className="btn-save" onClick={() => void handleGenerate()} disabled={genLoading}>
                {genLoading ? "Generating…" : "Generate links & description"}
              </button>
              {genError && <p className="gen-panel__error">{genError}</p>}
              {genResult && (
                <div className="gen-panel__result">
                  <label className="gen-panel__label">Description</label>
                  <textarea readOnly value={genResult.description} rows={6} className="gen-panel__desc" />
                  <button type="button" className="gen-panel__copy" onClick={() => void navigator.clipboard.writeText(genResult.description)}>Copy description</button>
                  <ul className="gen-panel__links">
                    {genResult.links.map((l) => (
                      <li key={l.tool}><code>{l.tool}</code>: <a href={l.short_url} target="_blank" rel="noopener noreferrer">{l.short_url}</a>{!l.has_affiliate && <span className="gen-panel__warn"> (no affiliate — verify URL)</span>}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Field sections — scoped to the context stage; admins can expand to all */}
          <div className="sec-sections">
            {sectionsToShow.map((sec) => (
              <div key={sec.id} className="detail-section">
                <div className="detail-section__title">{sec.label}</div>
                <div className="detail-section__fields">{sec.cols.map((c) => renderField(c))}</div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <button type="button" className="show-all-toggle" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show only this stage's fields" : "Show all fields"}
            </button>
          )}

          {isAdmin && !readOnly && onDelete && (
            <div className="detail-danger">
              <button type="button" className="btn-delete" onClick={onDelete}>🗑 Delete video</button>
            </div>
          )}
        </div>

        {/* Single action footer — fields above auto-save; this is the one CTA. */}
        {(renderActions() || formError) && (
          <div className="detail-footer">
            {formError && <div className="field-error detail-form-error">{formError}</div>}
            {renderActions()}
          </div>
        )}
      </div>
    </>
  );
}
