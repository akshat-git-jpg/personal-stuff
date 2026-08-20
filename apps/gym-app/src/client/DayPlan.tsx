// One day of the week plan. Rows point at catalogue exercises; the Sets/Reps
// field edits the CATALOGUE value, so it reflects everywhere that exercise
// appears. Drag to reorder, swipe left to remove from the day (never from the
// catalogue).

import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Exercise } from "../shared";
import { accentFor, IconBack, IconGrip, IconPlus, useToast } from "./ui";
import { useGym } from "./store";
import { gymBadge, gymOfTab } from "./gym";
import { ExercisePicker } from "./ExercisePicker";
import {
  DAY_LONG,
  addToDay,
  dayIds,
  muscleOf,
  removeFromDay,
  setDayOrder,
  todayIdx,
  usePlan,
  type DayIdx,
} from "./plan";

function Row({
  ex,
  doneToday,
  onSetsReps,
  onOpen,
  onRemove,
}: {
  ex: Exercise;
  doneToday: number;
  onSetsReps: (value: string) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.id,
  });
  const [dx, setDx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ex.setsReps);
  const start = useRef<{ x: number; y: number; lock: "" | "x" | "y" } | null>(null);
  const muscle = muscleOf(ex);

  function onTouchStart(e: React.TouchEvent) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, lock: "" };
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!start.current) return;
    const ddx = e.touches[0].clientX - start.current.x;
    const ddy = e.touches[0].clientY - start.current.y;
    if (!start.current.lock) {
      if (Math.abs(ddx) > 10 || Math.abs(ddy) > 10)
        start.current.lock = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
    }
    if (start.current.lock === "x") setDx(Math.max(-88, Math.min(0, ddx)));
  }
  function onTouchEnd() {
    if (start.current?.lock === "x") setDx(dx < -50 ? -88 : 0);
    start.current = null;
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== ex.setsReps) onSetsReps(next);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`exrow${isDragging ? " dragging" : ""}`}
    >
      <div className="swipe-del" onClick={onRemove}>
        Remove
      </div>
      <div
        className="exrow-fg"
        style={{
          transform: `translateX(${dx}px)`,
          transition: start.current ? "none" : "transform 0.2s ease",
        }}
      >
        <div className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">
          <IconGrip size={20} />
        </div>
        <div
          className="body"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="name" onClick={() => (dx === 0 ? onOpen() : setDx(0))}>
            {doneToday > 0 && (
              <span className="done-badge num" title="Sets logged today">
                ✓ {doneToday}
              </span>
            )}
            {ex.name || "Untitled"}
          </div>
          <div className="plan-meta">
            <span className="tag" style={{ ["--accent" as string]: accentFor(muscle) }}>
              {muscle}
            </span>
            {/* Always shown, both gyms — an absent tag reads as "no idea". */}
            <span className={`tag tag-${gymOfTab(ex.tab)}`}>{gymBadge(gymOfTab(ex.tab))}</span>
            {editing ? (
              <input
                className="plan-sr-input num"
                autoFocus
                value={draft}
                placeholder="e.g. 4 x 8"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setDraft(ex.setsReps);
                    setEditing(false);
                  }
                }}
              />
            ) : (
              <button
                className={`plan-sr num${ex.setsReps ? "" : " unset"}`}
                onClick={() => {
                  setDraft(ex.setsReps);
                  setEditing(true);
                }}
              >
                {ex.setsReps || "set reps"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayPlan({
  day,
  onBack,
  onOpenExercise,
}: {
  day: DayIdx;
  onBack: () => void;
  onOpenExercise: (ex: Exercise) => void;
}) {
  const { exerciseById, updateExercise, setsTodayFor } = useGym();
  usePlan(); // re-render on every plan change
  const ids = dayIds(day);
  const items = ids
    .map((id) => exerciseById(id))
    .filter((e): e is Exercise => !!e);
  const [picking, setPicking] = useState(false);
  const toast = useToast();

  const muscles: string[] = [];
  for (const ex of items) {
    const m = muscleOf(ex);
    if (!muscles.includes(m)) muscles.push(m);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((x) => x.id === active.id);
    const newIdx = items.findIndex((x) => x.id === over.id);
    setDayOrder(
      day,
      arrayMove(items, oldIdx, newIdx).map((x) => x.id),
    );
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">
            {day === todayIdx() ? "TODAY · " : ""}
            {items.length} {items.length === 1 ? "exercise" : "exercises"}
          </div>
          <h1 className="h1">{DAY_LONG[day]}</h1>
        </div>
      </div>

      {muscles.length > 0 && (
        <div className="day-muscles">
          {muscles.map((m) => (
            <span key={m} className="tag" style={{ ["--accent" as string]: accentFor(m) }}>
              {m}
            </span>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <div className="empty">
          <div className="big">Nothing planned</div>
          Add exercises below to fill {DAY_LONG[day]}.
        </div>
      )}

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="list">
              {items.map((ex) => (
                <Row
                  key={ex.id}
                  ex={ex}
                  doneToday={setsTodayFor(ex.id)}
                  onSetsReps={(value) => {
                    updateExercise(ex.tab, ex.id, { name: ex.name, setsReps: value });
                    toast("Sets/reps updated everywhere");
                  }}
                  onOpen={() => onOpenExercise(ex)}
                  onRemove={() => {
                    removeFromDay(day, ex.id);
                    toast("Removed from " + DAY_LONG[day]);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="bottombar">
        <button className="btn btn-primary" onClick={() => setPicking(true)}>
          <IconPlus size={22} /> Add Exercise
        </button>
      </div>

      {picking && (
        <ExercisePicker
          alreadyIn={ids}
          onPick={(id) => {
            addToDay(day, id);
            toast("Added");
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
