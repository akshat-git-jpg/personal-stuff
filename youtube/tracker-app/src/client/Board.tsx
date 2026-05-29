import { useState, useCallback } from "react";
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
import { canEdit, canSetValue, isRowLockedFor } from "../shared/rbac";
import { POLICY } from "../shared/policy";
import { updateCell, ForbiddenError, type BoardData } from "./api";
import { LANES, ADMIN_LANE_OPTIONS, groupByLane } from "./lanes";
import { Card } from "./Card";
import { CardDetail } from "./CardDetail";
import { laneLabel, laneColor, FIELD_LABELS, FEEDBACK_COL } from "./labels";

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
  children: React.ReactNode;
}

function LaneColumn({ lane, stageKey, laneStatusCol, count, children }: LaneColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: lane });
  const stageClass = stageKey ? ` lane--${stageKey}` : "";
  const friendlyLabel = laneLabel(laneStatusCol, lane);

  return (
    <div ref={setNodeRef} className={`lane${stageClass}${isOver ? " lane--over" : ""}`}>
      <div className="lane__bar" />
      <div className="lane__head">
        <span className="lane__title">{friendlyLabel}</span>
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

// ── Awaiting Approval list (Admin full view only) ──────────────────────────

const STAGE_LABEL: Record<string, string> = {
  tutorial_status:     "Script",
  video_editor_status: "Editing",
};

const ASSIGNEE_FOR_STATUS: Record<string, string> = {
  tutorial_status:     "tutorial_maker_email",
  video_editor_status: "video_editor_email",
};

interface AwaitingItem {
  row: Row;
  stageCol: string;
  stageLabel: string;
  assigneeEmail: string;
}

function buildAwaitingList(rows: Row[]): AwaitingItem[] {
  const items: AwaitingItem[] = [];
  for (const row of rows) {
    for (const col of ["tutorial_status", "video_editor_status"] as const) {
      if ((row[col] ?? "") === "In Review") {
        const assigneeCol = ASSIGNEE_FOR_STATUS[col];
        items.push({
          row,
          stageCol: col,
          stageLabel: STAGE_LABEL[col],
          assigneeEmail: (row[assigneeCol as keyof Row] ?? "") as string,
        });
      }
    }
  }
  return items;
}

interface AwaitingListProps {
  items: AwaitingItem[];
  onDone: () => void;
}

function AwaitingList({ items, onDone }: AwaitingListProps) {
  const [actingOn, setActingOn] = useState<string | null>(null); // "<row_id>:<col>"
  const [sendBackNote, setSendBackNote] = useState<Record<string, string>>({});
  const [showSendBack, setShowSendBack] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function approve(row: Row, stageCol: string) {
    if (!row.row_id) return;
    const key = `${row.row_id}:${stageCol}`;
    setActingOn(key); setBusy(true);
    try {
      await updateCell(row.row_id, stageCol as Column, "Done");
      onDone();
    } catch {
      // ignore, reload anyway
      onDone();
    }
    setBusy(false); setActingOn(null);
  }

  async function sendBack(row: Row, stageCol: string) {
    if (!row.row_id) return;
    const key = `${row.row_id}:${stageCol}`;
    setActingOn(key); setBusy(true);
    const note = sendBackNote[key] ?? "";
    try {
      await updateCell(row.row_id, stageCol as Column, "In Progress");
      const fbCol = FEEDBACK_COL[stageCol];
      if (fbCol && note.trim()) {
        await updateCell(row.row_id, fbCol as Column, note.trim());
      }
      onDone();
    } catch {
      onDone();
    }
    setBusy(false); setActingOn(null);
  }

  if (items.length === 0) {
    return <div className="awaiting-empty">No items awaiting approval.</div>;
  }

  return (
    <div className="awaiting-list">
      {items.map(({ row, stageCol, stageLabel, assigneeEmail }) => {
        const key = `${row.row_id}:${stageCol}`;
        const isActing = actingOn === key;
        const isSendBack = showSendBack[key];
        return (
          <div key={key} className="awaiting-item">
            <div className="awaiting-item__meta">
              <span className="awaiting-item__title">{row.video_title ?? "(no title)"}</span>
              <span className="awaiting-item__stage">{stageLabel}</span>
              {assigneeEmail && (
                <span className="awaiting-item__assignee">{assigneeEmail}</span>
              )}
            </div>
            <div className="awaiting-item__actions">
              <button
                className="btn-approve"
                onClick={() => void approve(row, stageCol)}
                disabled={busy}
              >
                {isActing && !isSendBack ? "…" : "✓ Approve"}
              </button>
              <button
                className="btn-sendback"
                onClick={() => setShowSendBack(s => ({ ...s, [key]: !s[key] }))}
                disabled={busy}
              >
                ↩ Send back
              </button>
            </div>
            {isSendBack && (
              <div className="awaiting-item__sendback">
                <textarea
                  className="sendback-textarea"
                  placeholder="Feedback for the freelancer…"
                  value={sendBackNote[key] ?? ""}
                  onChange={e => setSendBackNote(n => ({ ...n, [key]: e.target.value }))}
                  rows={3}
                />
                <button
                  className="btn-sendback-confirm"
                  onClick={() => void sendBack(row, stageCol)}
                  disabled={busy}
                >
                  {isActing ? "…" : "Confirm send back"}
                </button>
              </div>
            )}
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
  const [toast, setToast] = useState<string | null>(null);
  const [showAwaiting, setShowAwaiting] = useState(false);

  const lanes = LANES[laneStatus] ?? [];
  // In read-only preview mode, dragging is never allowed regardless of role.
  const editAllowed = !readOnly && canEdit(role, laneStatus);

  // Awaiting approval count (Admin full view only)
  const awaitingItems = (role === "Admin" && !isPreview) ? buildAwaitingList(rows) : [];
  const awaitingCount = awaitingItems.length;

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

      {/* Admin lane picker + awaiting-approval toggle — only in full admin view */}
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

      {/* Awaiting approval list (Admin only, toggleable) */}
      {showAwaiting ? (
        <AwaitingList
          items={awaitingItems}
          onDone={() => { reload(); setShowAwaiting(false); }}
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="board">
            {laneGroups.map(({ lane, rows: laneRows }, idx) => {
              // Only apply stage color to "real" lanes (not OTHER_LANE), and only within normal range
              const isKnownLane = idx < lanes.length;
              const stage = isKnownLane ? laneColor(idx, lanes.length) : null;
              return (
                <LaneColumn
                  key={lane}
                  lane={lane}
                  stageKey={stage}
                  laneStatusCol={laneStatus}
                  count={laneRows.length}
                >
                  {laneRows.map(row => {
                    const locked = isRowLockedFor(role, row);
                    return (
                      <DraggableCard
                        key={row.row_id}
                        row={row}
                        canDrag={editAllowed}
                        locked={locked}
                        onCardClick={r => setDetailRow(r)}
                        laneStatus={laneStatus}
                        visibleCols={visibleCols}
                      />
                    );
                  })}
                  {laneRows.length === 0 && (
                    <div className="lane__empty">No items</div>
                  )}
                </LaneColumn>
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
          laneStatus={laneStatus}
          readOnly={readOnly}
          onClose={() => setDetailRow(null)}
          onSaved={() => { reload(); setDetailRow(null); }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
