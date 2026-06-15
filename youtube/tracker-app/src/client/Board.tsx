import { useState, useCallback, useEffect, Fragment } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";
import {
  canEditForRoles,
  canSetValueForRoles,
  isFieldLocked,
  isApproverRoles,
} from "../shared/rbac";
import { APPROVER_ONLY_VALUES } from "../shared/policy";
import { updateCell, ForbiddenError, getApprovals, displayName, createVideo, type BoardData, type ApprovalItem } from "./api";
import { LANES, ADMIN_LANE_OPTIONS, groupByLane } from "./lanes";
import { Card } from "./Card";
import { CardDetail } from "./CardDetail";
import { laneLabel, laneColor, FIELD_LABELS } from "./labels";
import { AdminOverview } from "./AdminOverview";
import { PipelineBoard } from "./PipelineBoard";
import { Filters, EMPTY_FILTERS, type AdminFilters } from "./Filters";
import { overallStage, type OverallStage } from "./pipeline";

// ── Admin view tabs ────────────────────────────────────────────────────────

type AdminTab = "overview" | "pipeline" | "board" | "awaiting";

// ── Role banner text ───────────────────────────────────────────────────────

const ROLE_BANNER: Record<string, string> = {
  "Script Writer":  "These are the scripts assigned to you. Drag a card right as you make progress. Open a card to read the brief and paste your script link.",
  "Tutorial Maker": "These are the tutorials assigned to you. Drag a card right as you make progress. Open a card to read the script and paste your recording link.",
  "Video Editor":   "These are the videos assigned to you for editing. Drag a card as you progress. Open a card to read the recording and paste your edited video link.",
  "Reviewer":       "Videos awaiting your review and upload. Open a card to review and add the YouTube link.",
  "Admin":          "All videos across the pipeline. Use the board-view selector to switch the grouping. You can edit any field.",
};

// Stage switcher labels
const STAGE_SWITCHER_LABEL: Record<string, string> = {
  script_status:       "Script",
  tutorial_status:     "Recording",
  video_editor_status: "Editing",
};

// ── Droppable lane column ──────────────────────────────────────────────────

interface LaneColumnProps {
  lane: string;
  stageKey: "todo" | "prog" | "review" | "done" | null;
  laneStatusCol: string;
  count: number;
  gated?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}

function LaneColumn({ lane, stageKey, laneStatusCol, count, gated, collapsible, collapsed, onToggle, children }: LaneColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: lane });
  const stageClass = stageKey ? ` lane--${stageKey}` : "";
  const friendlyLabel = laneLabel(laneStatusCol, lane);
  const isCollapsed = !!collapsible && !!collapsed;

  return (
    <div ref={setNodeRef} className={`lane${stageClass}${gated ? " lane--gated" : ""}${isOver && !gated ? " lane--over" : ""}${isCollapsed ? " lane--collapsed" : ""}`}>
      <div className="lane__bar" />
      <div
        className={`lane__head${collapsible ? " lane__head--toggle" : ""}`}
        onClick={collapsible ? onToggle : undefined}
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e => { if (e.key === "Enter" || e.key === " ") onToggle?.(); }) : undefined}
      >
        {collapsible && <span className="lane__caret">{isCollapsed ? "▸" : "▾"}</span>}
        <span className="lane__title">{friendlyLabel}</span>
        {gated && <span className="lane__lock" title="Only an admin or reviewer can move cards here">🔒 Approver only</span>}
        <span className="lane__count">{count}</span>
      </div>
      {!isCollapsed && <div className="lane__cards">{children}</div>}
    </div>
  );
}

// ── Draggable card wrapper ─────────────────────────────────────────────────

interface DraggableCardProps {
  row: Row;
  onCardClick: (row: Row) => void;
  canDrag: boolean;
  locked: boolean;
  laneStatus: string;
  visibleCols: string[];
}

function DraggableCard({ row, onCardClick, canDrag, locked, laneStatus, visibleCols }: DraggableCardProps) {
  const id = row.row_id ?? "";
  // Locked cards are never draggable even if editAllowed is true
  const draggable = canDrag && !locked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: !draggable,
    data: { row },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
    >
      <Card
        row={row}
        onClick={() => !isDragging && onCardClick(row)}
        isDragging={isDragging}
        laneStatus={laneStatus}
        visibleCols={visibleCols}
        locked={locked}
      />
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return <div className="toast">{message}</div>;
}

// ── Board ──────────────────────────────────────────────────────────────────

interface BoardProps extends Omit<BoardData, "viewingAs" | "readOnly" | "notice"> {
  reload: () => void;
  viewingAs?: { email: string; role: string | null } | null;
  readOnly?: boolean;
  names: Record<string, string>;
  roles: string[];
  stages: { statusCol: string; role: string }[];
}

// ── Awaiting Approval queue (approver-driven, endpoint-sourced) ────────────

interface ApprovalQueueProps {
  items: ApprovalItem[];
  names: Record<string, string>;
  onOpenCard: (item: ApprovalItem) => void;
}

function ApprovalQueue({ items, names, onOpenCard }: ApprovalQueueProps) {
  if (items.length === 0) {
    return <div className="awaiting-empty">No items awaiting approval.</div>;
  }

  return (
    <div className="awaiting-list">
      {items.map((item) => {
        const key = `${item.row_id}:${item.stageCol}`;
        return (
          <div
            key={key}
            className="awaiting-item awaiting-item--clickable"
            onClick={() => onOpenCard(item)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenCard(item); }}
          >
            <div className="awaiting-item__meta">
              <span className="awaiting-item__title">{item.video_title || "(no title)"}</span>
              <span className="awaiting-item__stage">{item.stage}</span>
              {item.assigneeEmail && (
                <span className="awaiting-item__assignee">{displayName(item.assigneeEmail, names)}</span>
              )}
            </div>
            <div className="awaiting-item__hint">Click to review →</div>
          </div>
        );
      })}
    </div>
  );
}

export function Board({ role, roles, stages, columns, rows: initialRows, names, viewingAs, readOnly, reload }: BoardProps) {
  const isPreview = !!viewingAs;

  // Multi-role derived flags
  const isApprover = isApproverRoles(roles);
  const isAdmin = roles.includes("Admin");

  // Worker stages from the API (each {statusCol, role})
  const workerStages = stages ?? [];

  // For a worker with multiple stages, default to the first one
  const defaultWorkerStageIdx = 0;
  const [workerStageIdx, setWorkerStageIdx] = useState(defaultWorkerStageIdx);

  // Derive the laneStatus from the active worker stage (or legacy fallback)
  const activeWorkerStage = workerStages[workerStageIdx];
  const defaultLane = isAdmin
    ? ("topic_status" as Column)
    : isApprover
    ? ("yt_upload_status" as Column)
    : activeWorkerStage
    ? (activeWorkerStage.statusCol as Column)
    : ("topic_status" as Column);

  // Admin view switcher state — only used when isAdmin && !isPreview
  const isFullAdmin = isAdmin && !isPreview;
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const [adminFilters, setAdminFilters] = useState<AdminFilters>(EMPTY_FILTERS);

  const [laneStatus, setLaneStatus] = useState<Column>(defaultLane);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  // detailLaneStatus overrides the board laneStatus when opening a card from the approvals queue
  const [detailLaneStatus, setDetailLaneStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Approver-mode: non-admin approvers default to awaiting queue
  const approverMode = isApprover && !isPreview;
  const [showAwaiting, setShowAwaiting] = useState(approverMode && !isAdmin);

  // Freelancers' "Done" (approved) lane is collapsed by default
  const [doneOpen, setDoneOpen] = useState(false);

  // Approvals queue — fetched from the server for approver roles
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([]);
  const [approvalNames, setApprovalNames] = useState<Record<string, string>>(names);

  async function fetchApprovals() {
    if (!approverMode) return;
    const data = await getApprovals();
    setApprovalItems(data.items);
    if (data.names) setApprovalNames(data.names);
  }

  // New Video modal (Admin-only)
  const [showNewVideo, setShowNewVideo] = useState(false);
  const [nvTitle, setNvTitle] = useState("");
  const [nvNotes, setNvNotes] = useState("");
  const [nvCategory, setNvCategory] = useState("");
  const [nvSubcategory, setNvSubcategory] = useState("");
  const [nvBusy, setNvBusy] = useState(false);
  const [nvError, setNvError] = useState<string | null>(null);

  async function submitNewVideo() {
    if (!nvTitle.trim()) { setNvError("Title is required"); return; }
    setNvBusy(true);
    setNvError(null);
    try {
      await createVideo({
        video_title: nvTitle.trim(),
        video_notes: nvNotes.trim(),
        category: nvCategory.trim(),
        subcategory: nvSubcategory.trim(),
      });
      setShowNewVideo(false);
      setNvTitle(""); setNvNotes(""); setNvCategory(""); setNvSubcategory("");
      reload();
    } catch (err) {
      setNvError(err instanceof Error ? err.message : String(err));
    } finally {
      setNvBusy(false);
    }
  }

  const newVideoModal = showNewVideo ? (
    <div
      className="detail-overlay"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={() => !nvBusy && setShowNewVideo(false)}
    >
      <div
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg, #1e1e1e)", padding: 20, borderRadius: 10, width: 480, maxWidth: "90vw" }}
      >
        <h2>New Video</h2>
        <div className="field">
          <label htmlFor="nv-title">Title</label>
          <input id="nv-title" type="text" value={nvTitle} onChange={e => setNvTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nv-notes">Notes</label>
          <textarea id="nv-notes" value={nvNotes} onChange={e => setNvNotes(e.target.value)} rows={4} style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label htmlFor="nv-category">Category</label>
          <input id="nv-category" type="text" value={nvCategory} onChange={e => setNvCategory(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nv-subcategory">Subcategory</label>
          <input id="nv-subcategory" type="text" value={nvSubcategory} onChange={e => setNvSubcategory(e.target.value)} />
        </div>
        {nvError && <p style={{ color: "var(--review, #e06c75)" }}>{nvError}</p>}
        <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setShowNewVideo(false)} disabled={nvBusy}>Cancel</button>
          <button type="button" className="btn-save" onClick={() => void submitNewVideo()} disabled={nvBusy}>
            {nvBusy ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  useEffect(() => {
    void fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isPreview]);

  // When the worker stage switcher changes, update laneStatus
  useEffect(() => {
    if (!isAdmin && !isApprover && activeWorkerStage) {
      setLaneStatus(activeWorkerStage.statusCol as Column);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerStageIdx]);

  const awaitingCount = approvalItems.length;

  const lanes = LANES[laneStatus] ?? [];
  // In read-only preview mode, dragging is never allowed regardless of role.
  const editAllowed = !readOnly && canEditForRoles(roles, laneStatus);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const row = event.active.data.current?.row as Row | undefined;
    if (row) setActiveRow(row);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveRow(null);
    const { active, over } = event;
    if (!over) return;
    if (!editAllowed) {
      showToast("This board is read-only for your role");
      return;
    }

    const draggedRow = active.data.current?.row as Row | undefined;
    if (!draggedRow?.row_id) return;
    const newLane = over.id as string;
    const oldLane = draggedRow[laneStatus] ?? "";
    if (newLane === oldLane) return;

    // Client-side guard: prevent doers from dragging into lanes they can't set
    if (!canSetValueForRoles(roles, laneStatus, newLane)) {
      showToast("Only an admin/reviewer can approve. Drag to 'Submitted for review' to submit it.");
      return;
    }

    // Optimistic update
    setRows(prev => prev.map(r =>
      r.row_id === draggedRow.row_id ? { ...r, [laneStatus]: newLane } : r
    ));

    try {
      await updateCell(draggedRow.row_id, laneStatus, newLane);
    } catch (err) {
      setRows(prev => prev.map(r =>
        r.row_id === draggedRow.row_id ? { ...r, [laneStatus]: oldLane } : r
      ));
      if (err instanceof ForbiddenError) {
        showToast("You can't move this card");
      } else {
        showToast((err as Error).message ?? "Move failed");
      }
    }
  }

  const laneGroups = groupByLane(rows, laneStatus, lanes);
  const visibleCols = columns as string[];

  // ── Helper: open card from Pipeline/Overview ──────────────────────────────
  function openRowFromPipeline(row: Row) {
    let ls: string = laneStatus;
    if ((row.yt_upload_status ?? "") === "In Review") ls = "yt_upload_status";
    else if ((row.video_editor_status ?? "") === "In Review") ls = "video_editor_status";
    else if ((row.tutorial_status ?? "") === "In Review") ls = "tutorial_status";
    else if ((row.script_status ?? "") === "In Review") ls = "script_status";
    else {
      const stage = overallStage(row as Record<string, string>);
      if (stage === "Published" || stage === "Upload") ls = "yt_upload_status";
      else if (stage === "Editing") ls = "video_editor_status";
      else if (stage === "Tutorial") ls = "tutorial_status";
      else ls = "script_status";
    }
    setDetailRow(row);
    setDetailLaneStatus(ls);
  }

  // ── Full Admin rendering ───────────────────────────────────────────────────

  if (isFullAdmin) {
    function goToPipeline(stage?: OverallStage) {
      setAdminFilters(stage ? { ...EMPTY_FILTERS, stage } : EMPTY_FILTERS);
      setAdminTab("pipeline");
    }

    const showFilters = adminTab === "pipeline" || adminTab === "board";

    return (
      <div className="board-root">
        {/* ── Admin view switcher ── */}
        <div className="admin-tabs">
          {(["overview", "pipeline", "board", "awaiting"] as AdminTab[]).map(tab => {
            const label =
              tab === "overview"  ? "Overview"
              : tab === "pipeline" ? "Pipeline"
              : tab === "board"    ? "Board"
              : `Awaiting (${awaitingCount})`;
            return (
              <button
                key={tab}
                type="button"
                className={`admin-tab${adminTab === tab ? " admin-tab--active" : ""}`}
                onClick={() => {
                  setAdminTab(tab);
                  if (tab !== "board") setShowAwaiting(false);
                }}
                aria-pressed={adminTab === tab}
              >
                {label}
              </button>
            );
          })}
          <button
            type="button"
            className="admin-tab"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowNewVideo(true)}
          >
            + New Video
          </button>
        </div>

        {/* ── Filter bar (Pipeline + Board) ── */}
        {showFilters && (
          <Filters
            rows={rows}
            names={names}
            filters={adminFilters}
            onChange={setAdminFilters}
          />
        )}

        {/* ── Overview tab ── */}
        {adminTab === "overview" && (
          <AdminOverview
            rows={rows as Row[]}
            names={names}
            awaitingCount={awaitingCount}
            onGoPipeline={goToPipeline}
            onGoAwaiting={() => setAdminTab("awaiting")}
            onOpenRow={openRowFromPipeline}
          />
        )}

        {/* ── Pipeline tab ── */}
        {adminTab === "pipeline" && (
          <PipelineBoard
            rows={rows}
            names={names}
            filters={adminFilters}
            onOpen={openRowFromPipeline}
          />
        )}

        {/* ── Board tab (existing kanban + lane picker) ── */}
        {adminTab === "board" && (
          <>
            <div className="board-controls">
              <label htmlFor="lane-select">Board view:</label>
              <select
                id="lane-select"
                value={laneStatus}
                onChange={e => { setLaneStatus(e.target.value as Column); }}
              >
                {ADMIN_LANE_OPTIONS.map(col => (
                  <option key={col} value={col}>{FIELD_LABELS[col] ?? col.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="board">
                {(() => {
                  // Apply filters to board rows too
                  const filteredRows = rows.filter(row => {
                    if (adminFilters.stage && overallStage(row as Record<string,string>) !== adminFilters.stage) return false;
                    if (adminFilters.assignee) {
                      const sw = (row.script_writer_email ?? "").trim().toLowerCase();
                      const tm = (row.tutorial_maker_email ?? "").trim().toLowerCase();
                      const ve = (row.video_editor_email ?? "").trim().toLowerCase();
                      if (sw !== adminFilters.assignee && tm !== adminFilters.assignee && ve !== adminFilters.assignee) return false;
                    }
                    if (adminFilters.category) {
                      if ((row.category ?? "") !== adminFilters.category) return false;
                    }
                    return true;
                  });
                  const filteredGroups = groupByLane(filteredRows, laneStatus, lanes);
                  return filteredGroups.map(({ lane, rows: laneRows }, idx) => {
                    const isKnownLane = idx < lanes.length;
                    const stageKey = isKnownLane ? laneColor(idx, lanes.length) : null;
                    const gated = (APPROVER_ONLY_VALUES[laneStatus] ?? []).includes(lane)
                      && !canSetValueForRoles(roles, laneStatus, lane);
                    return (
                      <Fragment key={lane}>
                        {gated && (
                          <div className="board-divider" aria-hidden="true">
                            <span>approver only</span>
                          </div>
                        )}
                        <LaneColumn
                          lane={lane}
                          stageKey={stageKey}
                          laneStatusCol={laneStatus}
                          count={laneRows.length}
                          gated={gated}
                        >
                          {laneRows.map(row => {
                            const locked = isFieldLocked(roles, laneStatus, row);
                            return (
                              <DraggableCard
                                key={row.row_id}
                                row={row}
                                canDrag={editAllowed}
                                locked={locked}
                                onCardClick={r => { setDetailRow(r); setDetailLaneStatus(null); }}
                                laneStatus={laneStatus}
                                visibleCols={visibleCols}
                              />
                            );
                          })}
                          {laneRows.length === 0 && (
                            <div className="lane__empty">No items</div>
                          )}
                        </LaneColumn>
                      </Fragment>
                    );
                  });
                })()}
              </div>
              <DragOverlay>
                {activeRow && (
                  <Card
                    row={activeRow}
                    onClick={() => undefined}
                    isDragging
                    laneStatus={laneStatus}
                    visibleCols={visibleCols}
                  />
                )}
              </DragOverlay>
            </DndContext>
          </>
        )}

        {/* ── Awaiting tab ── */}
        {adminTab === "awaiting" && (
          <ApprovalQueue
            items={approvalItems}
            names={approvalNames}
            onOpenCard={item => {
              setDetailRow(item.row);
              setDetailLaneStatus(item.stageCol);
            }}
          />
        )}

        {detailRow && (
          <CardDetail
            row={detailRow}
            columns={columns}
            role={role}
            roles={roles}
            names={names}
            laneStatus={detailLaneStatus ?? laneStatus}
            readOnly={readOnly}
            onClose={() => { setDetailRow(null); setDetailLaneStatus(null); }}
            onSaved={() => {
              void fetchApprovals();
              reload();
              setDetailRow(null);
              setDetailLaneStatus(null);
            }}
          />
        )}

        {newVideoModal}

        {toast && <Toast message={toast} />}
      </div>
    );
  }

  // ── Non-admin (Reviewer / worker roles / preview) rendering ─────────────

  // Role banner: for multi-role workers, use the active stage's role banner
  const primaryRole = activeWorkerStage?.role ?? role;
  const bannerText = ROLE_BANNER[primaryRole] ?? "";

  return (
    <div className="board-root">
      {/* Role banner */}
      {bannerText && (
        <div className="banner">
          <p dangerouslySetInnerHTML={{ __html: bannerText.replace(/^([^.]+\.)/, "<b>$1</b>") }} />
        </div>
      )}

      {/* Reviewer awaiting-approval toggle */}
      {isApprover && !isAdmin && !isPreview && (
        <div className="board-controls">
          <button
            className={`btn-awaiting${showAwaiting ? " btn-awaiting--active" : ""}`}
            onClick={() => setShowAwaiting(v => !v)}
            aria-pressed={showAwaiting}
          >
            Awaiting approval ({awaitingCount})
          </button>
        </div>
      )}

      {/* Worker stage switcher (shown for multi-role non-approver workers) */}
      {!isApprover && !isPreview && workerStages.length > 1 && (
        <div className="board-controls stage-switcher">
          {workerStages.map((ws, idx) => (
            <button
              key={ws.statusCol}
              type="button"
              className={`stage-switch-btn${workerStageIdx === idx ? " stage-switch-btn--active" : ""}`}
              onClick={() => setWorkerStageIdx(idx)}
              aria-pressed={workerStageIdx === idx}
            >
              {STAGE_SWITCHER_LABEL[ws.statusCol] ?? ws.statusCol}
            </button>
          ))}
        </div>
      )}

      {/* Awaiting approval queue (approvers only, endpoint-sourced, click-to-open-card) */}
      {showAwaiting ? (
        <ApprovalQueue
          items={approvalItems}
          names={approvalNames}
          onOpenCard={item => {
            setDetailRow(item.row);
            setDetailLaneStatus(item.stageCol);
          }}
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board">
            {laneGroups.map(({ lane, rows: laneRows }, idx) => {
              const isKnownLane = idx < lanes.length;
              const stage = isKnownLane ? laneColor(idx, lanes.length) : null;
              const gated = (APPROVER_ONLY_VALUES[laneStatus] ?? []).includes(lane)
                && !canSetValueForRoles(roles, laneStatus, lane);
              return (
                <Fragment key={lane}>
                  {gated && (
                    <div className="board-divider" aria-hidden="true">
                      <span>approver only</span>
                    </div>
                  )}
                <LaneColumn
                  lane={lane}
                  stageKey={stage}
                  laneStatusCol={laneStatus}
                  count={laneRows.length}
                  gated={gated}
                  collapsible={gated}
                  collapsed={gated && !doneOpen}
                  onToggle={() => setDoneOpen(o => !o)}
                >
                  {laneRows.map(row => {
                    const locked = isFieldLocked(roles, laneStatus, row);
                    return (
                      <DraggableCard
                        key={row.row_id}
                        row={row}
                        canDrag={editAllowed}
                        locked={locked}
                        onCardClick={r => { setDetailRow(r); setDetailLaneStatus(null); }}
                        laneStatus={laneStatus}
                        visibleCols={visibleCols}
                      />
                    );
                  })}
                  {laneRows.length === 0 && (
                    <div className="lane__empty">No items</div>
                  )}
                </LaneColumn>
                </Fragment>
              );
            })}
          </div>

          <DragOverlay>
            {activeRow && (
              <Card
                row={activeRow}
                onClick={() => undefined}
                isDragging
                laneStatus={laneStatus}
                visibleCols={visibleCols}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {detailRow && (
        <CardDetail
          row={detailRow}
          columns={columns}
          role={role}
          roles={roles}
          names={names}
          laneStatus={detailLaneStatus ?? laneStatus}
          readOnly={readOnly}
          onClose={() => { setDetailRow(null); setDetailLaneStatus(null); }}
          onSaved={() => {
            void fetchApprovals();
            reload();
            setDetailRow(null);
            setDetailLaneStatus(null);
            if (detailLaneStatus) setShowAwaiting(false);
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
