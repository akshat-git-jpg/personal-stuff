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
import { canEdit, canSetValue, isRowLockedFor, isApprover } from "../shared/rbac";
import { POLICY, APPROVER_ONLY_VALUES } from "../shared/policy";
import { updateCell, ForbiddenError, getApprovals, type BoardData, type ApprovalItem } from "./api";
import { LANES, ADMIN_LANE_OPTIONS, groupByLane } from "./lanes";
import { Card } from "./Card";
import { CardDetail } from "./CardDetail";
import { laneLabel, laneColor, FIELD_LABELS } from "./labels";

// ── Role banner text ───────────────────────────────────────────────────────

const ROLE_BANNER: Record<string, string> = {
  "Tutorial Maker": "These are the tutorials assigned to you. Drag a card right as you make progress. Open a card to read the brief and paste your tutorial / script link.",
  "Editor":         "These are the videos assigned to you for editing. Drag a card as you progress. Open a card to read the script and paste your edited video link.",
  "Reviewer":       "Videos awaiting your review and upload. Open a card to review and add the YouTube link.",
  "Admin":          "All videos across the pipeline. Use the board-view selector to switch the grouping. You can edit any field.",
};

// ── Droppable lane column ──────────────────────────────────────────────────

interface LaneColumnProps {
  lane: string;
  stageKey: "todo" | "prog" | "review" | "done" | null;
  laneStatusCol: string;
  count: number;
  gated?: boolean;
  children: React.ReactNode;
}

function LaneColumn({ lane, stageKey, laneStatusCol, count, gated, children }: LaneColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: lane });
  const stageClass = stageKey ? ` lane--${stageKey}` : "";
  const friendlyLabel = laneLabel(laneStatusCol, lane);

  return (
    <div ref={setNodeRef} className={`lane${stageClass}${gated ? " lane--gated" : ""}${isOver && !gated ? " lane--over" : ""}`}>
      <div className="lane__bar" />
      <div className="lane__head">
        <span className="lane__title">{friendlyLabel}</span>
        {gated && <span className="lane__lock" title="Only an admin or reviewer can move cards here">🔒 Approver only</span>}
        <span className="lane__count">{count}</span>
      </div>
      <div className="lane__cards">{children}</div>
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
}

// ── Awaiting Approval queue (approver-driven, endpoint-sourced) ────────────

interface ApprovalQueueProps {
  items: ApprovalItem[];
  onOpenCard: (item: ApprovalItem) => void;
}

function ApprovalQueue({ items, onOpenCard }: ApprovalQueueProps) {
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
                <span className="awaiting-item__assignee">{item.assigneeEmail}</span>
              )}
            </div>
            <div className="awaiting-item__hint">Click to review →</div>
          </div>
        );
      })}
    </div>
  );
}

export function Board({ role, columns, rows: initialRows, viewingAs, readOnly, reload }: BoardProps) {
  const isPreview = !!viewingAs;
  const defaultLane = (role === "Admin"
    ? "topic_status"
    : (POLICY[role]?.laneStatus ?? "topic_status")) as Column;

  const [laneStatus, setLaneStatus] = useState<Column>(defaultLane);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  // detailLaneStatus overrides the board laneStatus when opening a card from the approvals queue
  const [detailLaneStatus, setDetailLaneStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAwaiting, setShowAwaiting] = useState(false);

  // Approvals queue — fetched from the server for approver roles
  const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>([]);
  const approverMode = isApprover(role) && !isPreview;

  async function fetchApprovals() {
    if (!approverMode) return;
    const data = await getApprovals();
    setApprovalItems(data.items);
  }

  // Fetch on mount and whenever reload is triggered (parent bumps a key or similar)
  useEffect(() => {
    void fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isPreview]);

  const awaitingCount = approvalItems.length;

  const lanes = LANES[laneStatus] ?? [];
  // In read-only preview mode, dragging is never allowed regardless of role.
  const editAllowed = !readOnly && canEdit(role, laneStatus);

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
    if (!canSetValue(role, laneStatus, newLane)) {
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
  const bannerText = ROLE_BANNER[role] ?? "";
  const visibleCols = columns as string[];

  return (
    <div className="board-root">
      {/* Role banner */}
      {bannerText && (
        <div className="banner">
          <p dangerouslySetInnerHTML={{ __html: bannerText.replace(/^([^.]+\.)/, "<b>$1</b>") }} />
        </div>
      )}

      {/* Admin lane picker + awaiting-approval toggle — full admin view */}
      {role === "Admin" && !isPreview && (
        <div className="board-controls">
          <label htmlFor="lane-select">Board view:</label>
          <select
            id="lane-select"
            value={laneStatus}
            onChange={e => { setLaneStatus(e.target.value as Column); setShowAwaiting(false); }}
          >
            {ADMIN_LANE_OPTIONS.map(col => (
              <option key={col} value={col}>{FIELD_LABELS[col] ?? col.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button
            className={`btn-awaiting${showAwaiting ? " btn-awaiting--active" : ""}`}
            onClick={() => setShowAwaiting(v => !v)}
            aria-pressed={showAwaiting}
          >
            Awaiting approval ({awaitingCount})
          </button>
        </div>
      )}

      {/* Reviewer awaiting-approval toggle — Reviewer has no lane picker, so just the button */}
      {role === "Reviewer" && !isPreview && (
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

      {/* Awaiting approval queue (approvers only, endpoint-sourced, click-to-open-card) */}
      {showAwaiting ? (
        <ApprovalQueue
          items={approvalItems}
          onOpenCard={item => {
            setDetailRow(item.row);
            setDetailLaneStatus(item.stageCol);
          }}
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board">
            {laneGroups.map(({ lane, rows: laneRows }, idx) => {
              // Only apply stage color to "real" lanes (not OTHER_LANE), and only within normal range
              const isKnownLane = idx < lanes.length;
              const stage = isKnownLane ? laneColor(idx, lanes.length) : null;
              // A lane is "gated" (approver-only) when the viewer can't set its value
              // (e.g. the Done lane for a Tutorial Maker / Editor). Approvers never see this.
              const gated = (APPROVER_ONLY_VALUES[laneStatus] ?? []).includes(lane)
                && !canSetValue(role, laneStatus, lane);
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
                >
                  {laneRows.map(row => {
                    const locked = isRowLockedFor(role, row);
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
