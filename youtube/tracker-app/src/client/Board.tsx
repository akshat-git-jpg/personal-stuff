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

// ── Droppable lane column ──────────────────────────────────────────────────

function LaneColumn({ lane, children }: { lane: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: lane });
  return (
    <div ref={setNodeRef} className={`lane${isOver ? " lane--over" : ""}`}>
      <div className="lane__header">{lane}</div>
      <div className="lane__cards">{children}</div>
    </div>
  );
}

// ── Draggable card wrapper ─────────────────────────────────────────────────

interface DraggableCardProps {
  row: Row;
  onCardClick: (row: Row) => void;
  canDrag: boolean;
}

function DraggableCard({ row, onCardClick, canDrag }: DraggableCardProps) {
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
      <Card row={row} onClick={() => !isDragging && onCardClick(row)} isDragging={isDragging} />
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────

interface ToastProps { message: string; }
function Toast({ message }: ToastProps) {
  return <div className="toast">{message}</div>;
}

// ── Board ──────────────────────────────────────────────────────────────────

interface BoardProps extends BoardData {
  reload: () => void;
}

export function Board({ role, columns, rows: initialRows, reload }: BoardProps) {
  // Admin lane picker
  const defaultLane = (role === "Admin"
    ? "topic_status"
    : (POLICY[role]?.laneStatus ?? "topic_status")) as Column;

  const [laneStatus, setLaneStatus] = useState<Column>(defaultLane);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [activeRow, setActiveRow] = useState<Row | null>(null);   // dragging
  const [detailRow, setDetailRow] = useState<Row | null>(null);   // detail panel
  const [toast, setToast] = useState<string | null>(null);

  const lanes = LANES[laneStatus] ?? [];
  const editAllowed = canEdit(role, laneStatus);

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
      // Revert
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

  return (
    <div className="board-root">
      {role === "Admin" && (
        <div className="board-controls">
          <label htmlFor="lane-select">Board view:</label>
          <select
            id="lane-select"
            value={laneStatus}
            onChange={e => setLaneStatus(e.target.value as Column)}
          >
            {ADMIN_LANE_OPTIONS.map(col => (
              <option key={col} value={col}>{col.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="board">
          {laneGroups.map(({ lane, rows: laneRows }) => (
            <LaneColumn key={lane} lane={lane}>
              {laneRows.map(row => (
                <DraggableCard
                  key={row.row_id}
                  row={row}
                  canDrag={editAllowed}
                  onCardClick={setDetailRow}
                />
              ))}
              {laneRows.length === 0 && (
                <div className="lane__empty">No items</div>
              )}
            </LaneColumn>
          ))}
        </div>

        <DragOverlay>
          {activeRow && (
            <Card row={activeRow} onClick={() => undefined} isDragging />
          )}
        </DragOverlay>
      </DndContext>

      {detailRow && (
        <CardDetail
          row={detailRow}
          columns={columns}
          role={role}
          onClose={() => setDetailRow(null)}
          onSaved={() => { reload(); setDetailRow(null); }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
