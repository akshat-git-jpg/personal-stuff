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
import { canEdit } from "../shared/rbac";
import { POLICY } from "../shared/policy";
import { updateCell, ForbiddenError, type BoardData } from "./api";
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
  laneStatus: string;
  visibleCols: string[];
}

function DraggableCard({ row, onCardClick, canDrag, laneStatus, visibleCols }: DraggableCardProps) {
  const id = row.row_id ?? "";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: !canDrag,
    data: { row },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
    >
      <Card
        row={row}
        onClick={() => !isDragging && onCardClick(row)}
        isDragging={isDragging}
        laneStatus={laneStatus}
        visibleCols={visibleCols}
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

      {/* Admin lane picker — only in full admin view (not in per-user preview) */}
      {role === "Admin" && !isPreview && (
        <div className="board-controls">
          <label htmlFor="lane-select">Board view:</label>
          <select
            id="lane-select"
            value={laneStatus}
            onChange={e => setLaneStatus(e.target.value as Column)}
          >
            {ADMIN_LANE_OPTIONS.map(col => (
              <option key={col} value={col}>{FIELD_LABELS[col] ?? col.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      )}

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
                {laneRows.map(row => (
                  <DraggableCard
                    key={row.row_id}
                    row={row}
                    canDrag={editAllowed}
                    onCardClick={setDetailRow}
                    laneStatus={laneStatus}
                    visibleCols={visibleCols}
                  />
                ))}
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
