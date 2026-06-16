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
import { updateCell, ForbiddenError, getApprovals, displayName, createVideo, deleteVideo, type BoardData, type ApprovalItem } from "./api";
import { LANES, ADMIN_LANE_OPTIONS, groupByLane } from "./lanes";
import { Card } from "./Card";
import { CardDetail } from "./CardDetail";
import { laneLabel, laneColor, FIELD_LABELS } from "./labels";
import { PipelineBoard } from "./PipelineBoard";
import { TeamPanel } from "./TeamPanel";
import { Filters, EMPTY_FILTERS, type AdminFilters } from "./Filters";
import { overallStage } from "./pipeline";

// ── Admin view tabs ────────────────────────────────────────────────────────

type AdminTab = "pipeline" | "board" | "awaiting" | "team";

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

// ── Confirm-move dialog (freelancer submit / pull-back guardrail) ───────────

type MoveKind = "submit" | "pullback";

const MOVE_DIALOG: Record<MoveKind, { title: string; body: string; confirm: string; cancel: string }> = {
  submit: {
    title: "Submit for review?",
    body: "Once you submit, the reviewer is notified and this card locks — you won't be able to edit it until they approve or send it back.",
    confirm: "Submit for review",
    cancel: "Not yet",
  },
  pullback: {
    title: "Pull back to edit?",
    body: "This removes the card from the reviewer's queue and unlocks it so you can make changes.",
    confirm: "Move back",
    cancel: "Cancel",
  },
};

function ConfirmMoveDialog({ kind, onConfirm, onCancel }: { kind: MoveKind; onConfirm: () => void; onCancel: () => void }) {
  const copy = MOVE_DIALOG[kind];
  return (
    <>
      <div className="confirm-overlay" onClick={onCancel} />
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        <h3 className="confirm-dialog__title">{copy.title}</h3>
        <p className="confirm-dialog__body">{copy.body}</p>
        <div className="confirm-dialog__actions">
          <button className="confirm-dialog__cancel" onClick={onCancel}>{copy.cancel}</button>
          <button className="confirm-dialog__confirm" onClick={onConfirm}>{copy.confirm}</button>
        </div>
      </div>
    </>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────

interface BoardProps extends Omit<BoardData, "viewingAs" | "readOnly" | "canEditAll" | "notice"> {
  reload: () => void;
  viewingAs?: { email: string; role: string | null } | null;
  readOnly?: boolean;
  canEditAll?: boolean;
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

export function Board({ role, roles, stages, columns, rows: initialRows, names, viewingAs, readOnly, canEditAll, reload }: BoardProps) {
  const isPreview = !!viewingAs;

  // Edit authority is separate from the board VIEW. When an admin previews a
  // member's board, `roles` reflects the member (so the view/lanes match what
  // they see) but `editRoles` keeps the admin's full edit power.
  const editRoles = canEditAll ? [...roles, "Admin"] : roles;

  // Multi-role derived flags — VIEW roles (drive layout, lanes, stages).
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
  const [adminTab, setAdminTab] = useState<AdminTab>("board");
  const [adminFilters, setAdminFilters] = useState<AdminFilters>(EMPTY_FILTERS);

  const [laneStatus, setLaneStatus] = useState<Column>(defaultLane);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  // detailLaneStatus overrides the board laneStatus when opening a card from the approvals queue
  const [detailLaneStatus, setDetailLaneStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Pending freelancer move awaiting confirmation (submit / pull-back)
  const [pendingMove, setPendingMove] = useState<
    { row: Row; oldLane: string; newLane: string; statusCol: Column; kind: MoveKind } | null
  >(null);

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
      setAdminTab("board");
      setShowAwaiting(false);
      reload();
    } catch (err) {
      setNvError(err instanceof Error ? err.message : String(err));
    } finally {
      setNvBusy(false);
    }
  }

  const newVideoModal = showNewVideo ? (
    <>
      <div className="confirm-overlay" onClick={() => !nvBusy && setShowNewVideo(false)} />
      <div className="confirm-dialog nv-dialog" role="dialog" aria-modal="true">
        <h3 className="confirm-dialog__title">New video</h3>
        <p className="confirm-dialog__body" style={{ marginBottom: 16 }}>
          Adds a topic to the pipeline. You can generate its links &amp; description from the card afterward.
        </p>
        <div className="nv-form">
          <div className="field">
            <label htmlFor="nv-title">Title</label>
            <input
              id="nv-title"
              type="text"
              value={nvTitle}
              placeholder="e.g. Best AI video editors in 2026"
              autoFocus
              onChange={e => setNvTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="nv-notes">Notes</label>
            <textarea
              id="nv-notes"
              rows={4}
              value={nvNotes}
              placeholder="Tools to cover, the angle, anything the script writer needs…"
              onChange={e => setNvNotes(e.target.value)}
            />
          </div>
          <div className="nv-form__row">
            <div className="field">
              <label htmlFor="nv-category">Category</label>
              <input id="nv-category" type="text" value={nvCategory} onChange={e => setNvCategory(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="nv-subcategory">Subcategory</label>
              <input id="nv-subcategory" type="text" value={nvSubcategory} onChange={e => setNvSubcategory(e.target.value)} />
            </div>
          </div>
        </div>
        {nvError && <p className="nv-form__error">{nvError}</p>}
        <div className="confirm-dialog__actions">
          <button type="button" className="confirm-dialog__cancel" onClick={() => setShowNewVideo(false)} disabled={nvBusy}>
            Cancel
          </button>
          <button type="button" className="confirm-dialog__confirm" onClick={() => void submitNewVideo()} disabled={nvBusy}>
            {nvBusy ? "Creating…" : "Create video"}
          </button>
        </div>
      </div>
    </>
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
  const editAllowed = !readOnly && canEditForRoles(editRoles, laneStatus);

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

  // Whether this lane move needs a freelancer confirmation, and which kind.
  // Only on the doer stage columns, and only for the submit / pull-back moves.
  function moveKind(statusCol: Column, oldLane: string, newLane: string): MoveKind | null {
    const stageCols = ["script_status", "tutorial_status", "video_editor_status"];
    if (!stageCols.includes(statusCol)) return null;
    if (newLane === "In Review") return "submit";
    if (oldLane === "In Review") return "pullback";
    return null;
  }

  // Apply a lane move (optimistic + persist + rollback on failure).
  async function commitMove(draggedRow: Row, oldLane: string, newLane: string, statusCol: Column) {
    if (!draggedRow.row_id) return;
    setRows(prev => prev.map(r =>
      r.row_id === draggedRow.row_id ? { ...r, [statusCol]: newLane } : r
    ));
    try {
      await updateCell(draggedRow.row_id, statusCol, newLane);
    } catch (err) {
      setRows(prev => prev.map(r =>
        r.row_id === draggedRow.row_id ? { ...r, [statusCol]: oldLane } : r
      ));
      if (err instanceof ForbiddenError) {
        showToast("You can't move this card");
      } else {
        showToast((err as Error).message ?? "Move failed");
      }
    }
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
    if (!canSetValueForRoles(editRoles, laneStatus, newLane)) {
      showToast("Only an admin/reviewer can approve. Drag to 'Submitted for review' to submit it.");
      return;
    }

    // Freelancers confirm before submitting or pulling back from review.
    const isFreelancer = !isApproverRoles(editRoles);
    const kind = isFreelancer ? moveKind(laneStatus, oldLane, newLane) : null;
    if (kind) {
      setPendingMove({ row: draggedRow, oldLane, newLane, statusCol: laneStatus, kind });
      return;
    }

    await commitMove(draggedRow, oldLane, newLane, laneStatus);
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
    const showFilters = adminTab === "pipeline" || adminTab === "board";

    return (
      <div className="board-root">
        {/* ── Admin view switcher ── */}
        <div className="admin-tabs">
          {(["board", "pipeline", "awaiting", "team"] as AdminTab[]).map(tab => {
            const label =
              tab === "pipeline" ? "Pipeline"
              : tab === "board"    ? "Board"
              : tab === "team"     ? "Team"
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
            className="btn-newvideo"
            onClick={() => setShowNewVideo(true)}
          >
            + New video
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

        {/* ── Team tab ── */}
        {adminTab === "team" && <TeamPanel onChanged={reload} />}

        {/* ── Pipeline tab ── */}
        {adminTab === "pipeline" && (
          <PipelineBoard
            rows={rows}
            names={names}
            filters={adminFilters}
            onOpen={openRowFromPipeline}
            canDelete={isAdmin}
            onDelete={async (rowId, title) => {
              if (!confirm(`Delete "${title || rowId}"? This removes the row from the sheet and can't be undone.`)) return;
              try {
                await deleteVideo(rowId);
                setToast("Video deleted");
                reload();
              } catch (err) {
                setToast(err instanceof Error ? err.message : "Couldn't delete the row");
              }
            }}
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
                      && !canSetValueForRoles(editRoles, laneStatus, lane);
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
                            const locked = isFieldLocked(editRoles, laneStatus, row);
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
                && !canSetValueForRoles(editRoles, laneStatus, lane);
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
                    const locked = isFieldLocked(editRoles, laneStatus, row);
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
          canEditAll={canEditAll}
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

      {pendingMove && (
        <ConfirmMoveDialog
          kind={pendingMove.kind}
          onConfirm={() => {
            const m = pendingMove;
            setPendingMove(null);
            void commitMove(m.row, m.oldLane, m.newLane, m.statusCol);
          }}
          onCancel={() => setPendingMove(null)}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
