import { useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Owner, Task } from "../shared";
import { TaskCard } from "./TaskCard";

interface Props {
  owner: Owner;
  tasks: Task[];
  onReorder: (owner: Owner, orderedIds: number[]) => void;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onDelete: (t: Task) => void;
}

export function TaskList({ owner, tasks, onReorder, onToggleDone, onSetEta, onDelete }: Props) {
  const open = tasks.filter((t) => t.status === "open").sort((a, b) => a.sortOrder - b.sortOrder);
  const done = tasks.filter((t) => t.status === "done")
    .sort((a, b) => (a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1);
  const [showDone, setShowDone] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = open.map((t) => t.id);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from < 0 || to < 0) return;
    onReorder(owner, arrayMove(ids, from, to));
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {open.map((t) => (
            <SortableRow key={t.id} task={t}
              onToggleDone={onToggleDone} onSetEta={onSetEta} onDelete={onDelete} />
          ))}
        </SortableContext>
      </DndContext>
      {open.length === 0 && <p className="empty">Nothing open here — a clear slate.</p>}

      {done.length > 0 && (
        <div className="done-section">
          <div className="done-head" onClick={() => setShowDone((v) => !v)}>
            <span className="caret" style={{ transform: showDone ? "rotate(90deg)" : "none" }}>▶</span>
            Done · {done.length}
          </div>
          {showDone && done.map((t) => (
            <TaskCard key={t.id} task={t}
              onToggleDone={onToggleDone} onSetEta={onSetEta} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortableRow({ task, onToggleDone, onSetEta, onDelete }: {
  task: Task;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onDelete: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard task={task} handleProps={{ ...attributes, ...listeners }}
        onToggleDone={onToggleDone} onSetEta={onSetEta} onDelete={onDelete} />
    </div>
  );
}
