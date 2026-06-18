import { useState, useCallback, useEffect, useMemo } from "react";
import type { Column } from "../shared/columns";
import type { Transition } from "../shared/rbac";
import { stageByStatusCol } from "../shared/pipeline";
import {
  applyTransition, getReviewQueue, createVideo, deleteVideo,
  type BoardRow, type ReviewItem,
} from "./api";
import { lanesFor, groupByLane } from "./lanes";
import { activeStage } from "./pipeline";
import { statusMeta, STATUS_LEGEND } from "./status";
import { STAGE_GUIDE, REVIEWER_GUIDE } from "./guidance";
import { Card } from "./Card";
import { CardDetail, ComboSelect } from "./CardDetail";
import { ReviewQueue } from "./ReviewQueue";
import { PipelineBoard } from "./PipelineBoard";
import { TeamPanel } from "./TeamPanel";
import { Filters, EMPTY_FILTERS, type AdminFilters } from "./Filters";

interface BoardProps {
  roles: string[];
  stages: { statusCol: string; role: string }[];
  columns: Column[];
  rows: BoardRow[];
  names: Record<string, string>;
  memberRoles?: Record<string, string>;
  readOnly?: boolean;
  reload: () => void;
}

type TabKey = "work" | "review" | "pipeline" | "team";

function transitionsForStageCol(row: BoardRow, statusCol: string): Transition[] {
  return row._actions?.find((g) => g.statusCol === statusCol)?.transitions ?? [];
}

function Toast({ message }: { message: string }) { return <div className="toast">{message}</div>; }

// Collapsible "what you do here" helper at the top of a board.
function HelpBanner({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="help">
      <button type="button" className="help__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="help__icon">ⓘ</span> What you do here <span className="help__caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && <p className="help__body">{text}</p>}
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="legend">
      {STATUS_LEGEND.map((s) => {
        const m = statusMeta(s);
        return <span key={s} className={`pill pill--${m.tone}`}>{m.label}</span>;
      })}
    </div>
  );
}

export function Board({ roles, stages, columns, rows, names, memberRoles = {}, readOnly, reload }: BoardProps) {
  const isAdmin = roles.includes("Admin");
  // Reviewing is an explicit role, not an Admin default.
  const canReview = roles.includes("Reviewer");
  const workerStages = stages ?? [];

  // Time-in-status chip audience. "everyone" = freelancers see it on their own
  // board AND admins see it in view-as. Flip to "admin" to restrict it to admins
  // / view-as only — that's the only change needed.
  const SHOW_DWELL: "everyone" | "admin" = "everyone";
  const adminViewing = isAdmin || !!readOnly; // readOnly board = an admin's view-as mirror
  const showDwell = SHOW_DWELL === "everyone" || adminViewing;

  // Build the tab set from what this user actually has.
  const tabs: { key: TabKey; label: string }[] = [];
  const [queueCount, setQueueCount] = useState(0);
  if (workerStages.length > 0) tabs.push({ key: "work", label: "My work" });
  if (canReview) tabs.push({ key: "review", label: `Review queue${queueCount ? ` (${queueCount})` : ""}` });
  if (isAdmin) {
    tabs.push({ key: "pipeline", label: "Pipeline" });
    tabs.push({ key: "team", label: "Team" });
  }
  const defaultTab: TabKey = workerStages.length > 0 ? "work" : "review";
  const [tab, setTab] = useState<TabKey>(defaultTab);

  const [workerIdx, setWorkerIdx] = useState(0);
  const [adminFilters, setAdminFilters] = useState<AdminFilters>(EMPTY_FILTERS);
  const [detailRow, setDetailRow] = useState<BoardRow | null>(null);
  const [detailStageId, setDetailStageId] = useState<string | undefined>(undefined);
  const [detailPerspective, setDetailPerspective] = useState<"doer" | "reviewer" | "all">("all");
  const [toast, setToast] = useState<string | null>(null);

  function openDetail(row: BoardRow, stageId?: string, perspective: "doer" | "reviewer" | "all" = "all") {
    setDetailRow(row); setDetailStageId(stageId); setDetailPerspective(perspective);
  }

  const [queueItems, setQueueItems] = useState<ReviewItem[]>([]);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); }, []);

  const refreshQueue = useCallback(async () => {
    if (!canReview) return;
    const data = await getReviewQueue();
    setQueueItems(data.items);
    setQueueCount(data.count);
  }, [canReview]);

  useEffect(() => { void refreshQueue(); }, [refreshQueue, rows]);

  const categoryOptions = useMemo(
    () => [...new Set(rows.map((r) => (r.category ?? "").trim()).filter(Boolean))].sort(), [rows]);
  const subcategoryOptions = useMemo(
    () => [...new Set(rows.map((r) => (r.subcategory ?? "").trim()).filter(Boolean))].sort(), [rows]);

  // Single delete path used by every admin surface (Pipeline matrix, board card
  // tiles, and the card detail panel). Confirms, deletes, closes any open detail,
  // toasts, and reloads.
  async function handleDelete(rowId: string, title: string) {
    if (!rowId) return;
    if (!confirm(`Delete "${title || rowId}"? This removes the row from the sheet and can't be undone.`)) return;
    try {
      await deleteVideo(rowId);
      showToast("Video deleted");
      setDetailRow(null); setDetailStageId(undefined);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete the row");
    }
  }

  async function doAction(row: BoardRow, t: Transition) {
    if (!row.row_id) return;
    if (t.requiresFeedback) { openDetail(row, stageByStatusCol(t.statusCol)?.id, "reviewer"); return; }
    // Send the RAW stored value (blank stays blank) as the optimistic-lock expectation,
    // so a blank cell isn't mistaken for a "To Do" change.
    const prev = (row[t.statusCol as keyof BoardRow] as string) ?? "";
    try {
      await applyTransition(row.row_id, t, prev);
      reload();
      void refreshQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed");
    }
  }

  // ── New-video modal (admin) ────────────────────────────────────────────────
  const [showNewVideo, setShowNewVideo] = useState(false);
  const [nv, setNv] = useState({ title: "", notes: "", category: "", subcategory: "" });
  const [nvBusy, setNvBusy] = useState(false);
  const [nvError, setNvError] = useState<string | null>(null);

  async function submitNewVideo() {
    if (!nv.title.trim() || !nv.category.trim() || !nv.subcategory.trim() || !nv.notes.trim()) {
      setNvError("All fields are required."); return;
    }
    setNvBusy(true); setNvError(null);
    try {
      await createVideo({ video_title: nv.title.trim(), video_notes: nv.notes.trim(), category: nv.category.trim(), subcategory: nv.subcategory.trim() });
      setShowNewVideo(false); setNv({ title: "", notes: "", category: "", subcategory: "" });
      setTab("work"); reload();
    } catch (err) { setNvError(err instanceof Error ? err.message : String(err)); }
    finally { setNvBusy(false); }
  }

  // ── Lane board renderer ──────────────────────────────────────────────────────
  function renderLaneBoard(statusCol: Column, sourceRows: BoardRow[]) {
    const lanes = lanesFor(statusCol);
    const groups = groupByLane(sourceRows, statusCol, lanes);
    return (
      <div className="board">
        {groups.map(({ lane, rows: laneRows }) => {
          const m = statusMeta(lane);
          return (
            <div key={lane} className={`lane lane--${m.tone}`}>
              <div className="lane__head">
                <span className="lane__title">{m.label}</span>
                <span className="lane__count">{laneRows.length}</span>
              </div>
              <div className="lane__cards">
                {laneRows.map((row) => (
                  <Card key={row.row_id} row={row} statusCol={statusCol} names={names} readOnly={readOnly}
                    showAssignee={isAdmin} showDwell={showDwell}
                    canDelete={isAdmin && !readOnly}
                    onDelete={() => void handleDelete(row.row_id ?? "", row.video_title ?? "")}
                    /* My work is the doer's board — never show reviewer actions here */
                    transitions={transitionsForStageCol(row, statusCol).filter((t) => t.by === "doer")}
                    onOpen={() => openDetail(row, stageByStatusCol(statusCol)?.id, "doer")}
                    onAction={(t) => void doAction(row, t)} />
                ))}
                {laneRows.length === 0 && <div className="lane__empty">No items</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── My work tab ──────────────────────────────────────────────────────────────
  function renderWork() {
    const ws = workerStages[Math.min(workerIdx, workerStages.length - 1)];
    if (!ws) return <div className="awaiting-empty">Nothing assigned to you yet.</div>;
    const statusCol = ws.statusCol as Column;
    const mine = rows.filter((r) => (r._stages ?? []).includes(statusCol));
    return (
      <>
        {workerStages.length > 1 ? (
          <div className="stage-switcher">
            {workerStages.map((s, i) => (
              <button key={s.statusCol} type="button"
                className={`stage-switch-btn${i === workerIdx ? " stage-switch-btn--active" : ""}`}
                onClick={() => setWorkerIdx(i)}>{stageByStatusCol(s.statusCol)?.label ?? s.statusCol}</button>
            ))}
          </div>
        ) : (
          <div className="work-heading">{stageByStatusCol(statusCol)?.label ?? statusCol}</div>
        )}
        {STAGE_GUIDE[stageByStatusCol(statusCol)?.id ?? ""] && (
          <HelpBanner text={STAGE_GUIDE[stageByStatusCol(statusCol)!.id]} />
        )}
        {mine.length === 0
          ? <div className="awaiting-empty">Nothing in your {stageByStatusCol(statusCol)?.label ?? "queue"} right now.</div>
          : renderLaneBoard(statusCol, mine)}
      </>
    );
  }

  const newVideoModal = showNewVideo ? (
    <>
      <div className="confirm-overlay" onClick={() => !nvBusy && setShowNewVideo(false)} />
      <div className="confirm-dialog nv-dialog" role="dialog" aria-modal="true">
        <h3 className="confirm-dialog__title">New video</h3>
        <p className="confirm-dialog__body">Adds a topic at the start of the pipeline (Topic → To Do).</p>
        <div className="nv-form">
          <div className="field"><label>Title *</label>
            <input value={nv.title} autoFocus placeholder="e.g. Best AI video editors in 2026" onChange={(e) => setNv({ ...nv, title: e.target.value })} /></div>
          <div className="field"><label>Notes / brief *</label>
            <textarea rows={4} value={nv.notes} placeholder="Angle, tools to cover, anything the ideator/scriptwriter needs…" onChange={(e) => setNv({ ...nv, notes: e.target.value })} /></div>
          <div className="nv-form__row">
            <div className="field"><label>Category *</label>
              <ComboSelect id="nv-cat" value={nv.category} options={categoryOptions} placeholder="New category…" onChange={(v) => setNv({ ...nv, category: v })} /></div>
            <div className="field"><label>Subcategory *</label>
              <ComboSelect id="nv-sub" value={nv.subcategory} options={subcategoryOptions} placeholder="New subcategory…" onChange={(v) => setNv({ ...nv, subcategory: v })} /></div>
          </div>
        </div>
        {nvError && <p className="nv-form__error">{nvError}</p>}
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__cancel" onClick={() => setShowNewVideo(false)} disabled={nvBusy}>Cancel</button>
          <button type="button" className="confirm-dialog__confirm" onClick={() => void submitNewVideo()} disabled={nvBusy}>{nvBusy ? "Creating…" : "Create video"}</button>
        </div>
      </div>
    </>
  ) : null;

  const activeTab = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? "review");

  return (
    <div className="board-root">
      {tabs.length > 1 && (
        <div className="admin-tabs">
          {tabs.map((t) => (
            <button key={t.key} type="button" className={`admin-tab${activeTab === t.key ? " admin-tab--active" : ""}`}
              onClick={() => setTab(t.key)} aria-pressed={activeTab === t.key}>{t.label}</button>
          ))}
          {isAdmin && <button type="button" className="btn-newvideo" onClick={() => setShowNewVideo(true)}>+ New video</button>}
        </div>
      )}

      {activeTab === "work" && <StatusLegend />}

      {activeTab === "work" && renderWork()}
      {activeTab === "review" && (
        <>
          <HelpBanner text={REVIEWER_GUIDE} />
          <ReviewQueue items={queueItems} onOpen={(item) => openDetail(item.row, item.stageId, "reviewer")} />
        </>
      )}
      {activeTab === "pipeline" && (
        <>
          <Filters rows={rows} names={names} memberRoles={memberRoles} filters={adminFilters} onChange={setAdminFilters} />
          <PipelineBoard rows={rows} names={names} filters={adminFilters}
            onOpen={(r) => openDetail(r as BoardRow, activeStage(r as Record<string, string>)?.id, "all")}
            canDelete={isAdmin}
            onDelete={(rowId, title) => void handleDelete(rowId, title)} />
        </>
      )}
      {activeTab === "team" && <TeamPanel onChanged={reload} />}

      {detailRow && (
        <CardDetail row={detailRow} columns={columns} roles={roles} names={names} memberRoles={memberRoles} readOnly={readOnly}
          contextStageId={detailStageId} perspective={detailPerspective}
          onDelete={() => void handleDelete(detailRow.row_id ?? "", detailRow.video_title ?? "")}
          categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions}
          onClose={() => { setDetailRow(null); setDetailStageId(undefined); }}
          onSaved={() => { reload(); void refreshQueue(); setDetailRow(null); setDetailStageId(undefined); }} />
      )}

      {newVideoModal}
      {toast && <Toast message={toast} />}
    </div>
  );
}
