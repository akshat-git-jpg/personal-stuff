import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Owner, Task, TaskPatch, Template } from "../shared";
import { TaskCard } from "./TaskCard";
import { QuickAdd } from "./QuickAdd";
import { flattenOrder, groupOpen } from "./grouping";

interface Props {
  owner: Owner;
  tasks: Task[];
  templates: Template[];
  todayYmd: string;
  onReorder: (owner: Owner, orderedIds: number[]) => void;
  onAdd: (title: string, eta: string | null) => Promise<void>;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onSaveEdit: (t: Task, patch: TaskPatch) => void;
  onDelete: (t: Task) => void;
}

export function TaskList({ owner, tasks, templates, todayYmd, onReorder, onAdd, onToggleDone, onSetEta, onSaveEdit, onDelete }: Props) {
  const cadenceOf = useMemo(() => {
    const byId = new Map(templates.map((t) => [t.id, t.cadence]));
    // A deleted template leaves its generated tasks behind: still a repeat, cadence unknown.
    return (t: Task) =>
      t.templateId == null ? null : byId.get(t.templateId) ?? "repeat";
  }, [templates]);

  const groups = useMemo(() => groupOpen(tasks, todayYmd), [tasks, todayYmd]);
  const openCount = groups.reduce((n, g) => n + g.tasks.length, 0);

  const done = tasks.filter((t) => t.status === "done")
    .sort((a, b) => (a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1);
  const [showDone, setShowDone] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const group = groups.find((g) => g.tasks.some((t) => t.id === Number(active.id)));
    if (!group) return;
    const from = group.tasks.findIndex((t) => t.id === Number(active.id));
    const to = group.tasks.findIndex((t) => t.id === Number(over.id));
    if (from < 0 || to < 0) return; // dropped outside its own group — ignore
    const moved = groups.map((g) =>
      g === group ? { ...g, tasks: arrayMove(g.tasks, from, to) } : g,
    );
    onReorder(owner, flattenOrder(moved));
  }

  return (
    <div>
      <QuickAdd owner={owner} onAdd={onAdd} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {groups.map((g) => (
          <section className="bucket" key={g.bucket} data-bucket={g.bucket}>
            <h2 className={`bucket-head ${g.tone}`}>
              {g.label}
              <span className="bucket-count">{g.tasks.length}</span>
            </h2>
            <SortableContext items={g.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {g.tasks.map((t) => (
                <SortableRow key={t.id} task={t} repeat={cadenceOf(t)} todayYmd={todayYmd}
                  onToggleDone={onToggleDone} onSetEta={onSetEta} onSaveEdit={onSaveEdit} onDelete={onDelete} />
              ))}
            </SortableContext>
          </section>
        ))}
      </DndContext>
      {openCount === 0 && <p className="empty">Nothing open here — a clear slate.</p>}

      {done.length > 0 && (
        <div className="done-section">
          <div className="done-head" onClick={() => setShowDone((v) => !v)}>
            <span className="caret" style={{ transform: showDone ? "rotate(90deg)" : "none" }}>▶</span>
            Done · {done.length}
          </div>
          {showDone && done.map((t) => (
            <TaskCard key={t.id} task={t} repeat={cadenceOf(t)} todayYmd={todayYmd}
              onToggleDone={onToggleDone} onSetEta={onSetEta} onSaveEdit={onSaveEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function SortableRow({ task, repeat, todayYmd, onToggleDone, onSetEta, onSaveEdit, onDelete }: {
  task: Task;
  repeat: string | null;
  todayYmd: string;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onSaveEdit: (t: Task, patch: TaskPatch) => void;
  onDelete: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard task={task} repeat={repeat} todayYmd={todayYmd} handleProps={{ ...attributes, ...listeners }}
        onToggleDone={onToggleDone} onSetEta={onSetEta} onSaveEdit={onSaveEdit} onDelete={onDelete} />
    </div>
  );
}
