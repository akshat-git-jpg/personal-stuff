// Whole week as a sheet: one column per day. Click an exercise to highlight
// every day it appears on; drag to move it (hold Alt to copy); add, remove,
// star and edit the day note in place.

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Exercise } from "../shared";
import { accentFor, IconBack, IconMinusCircle, IconPlus, IconStar, useToast } from "./ui";
import { useGym } from "./store";
import { ExercisePicker } from "./ExercisePicker";
import { DayNote } from "./DayPlan";
import {
  DAY_LONG,
  DAY_SHORT,
  WEEK,
  addToDay,
  dayIds,
  isDayStarred,
  muscleOf,
  removeFromDay,
  setDayOrder,
  toggleDayStar,
  todayIdx,
  usePlan,
  type DayIdx,
} from "./plan";

type Drag = { day: DayIdx; ex: Exercise };
// Drop target: before a cell (`at` = its index) or the column's tail (`at` = null).
type Target = { day: DayIdx; at: number | null };

const cellKey = (day: DayIdx, id: string) => `cell:${day}:${id}`;
const colKey = (day: DayIdx) => `col:${day}`;

/** Move, copy or reorder one exercise; resolves once the server has the new row. */
async function moveExercise(
  from: DayIdx,
  id: string,
  to: DayIdx,
  at: number | null,
  copy = false,
): Promise<void> {
  const starred = isDayStarred(from, id);
  if (from !== to) {
    await addToDay(to, id);
    if (starred) toggleDayStar(to, id);
    if (!copy) {
      removeFromDay(from, id);
      setDayOrder(from, dayIds(from));
    }
  }
  const rest = dayIds(to).filter((x) => x !== id);
  const idx = at === null ? rest.length : Math.min(at, rest.length);
  rest.splice(idx, 0, id);
  setDayOrder(to, rest);
}

export function WeekGrid({ onBack }: { onBack: () => void }) {
  const { exerciseById } = useGym();
  const toast = useToast();
  const plan = usePlan();
  const today = todayIdx();
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [alt, setAlt] = useState(false);
  const [adding, setAdding] = useState<DayIdx | null>(null);
  const focus = drag ? drag.ex.id : picked ?? hover;

  // A 6px move starts a drag, so a plain click still highlights.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      setAlt(e.altKey);
      if (e.type === "keydown" && e.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const cols = useMemo(
    () =>
      WEEK.map((day) => ({
        day,
        items: (plan[String(day)] ?? [])
          .map((id) => exerciseById(id))
          .filter((e): e is NonNullable<typeof e> => !!e),
      })),
    [plan, exerciseById],
  );

  const pickedEx = picked ? exerciseById(picked) : undefined;
  const pickedDays = picked
    ? cols.filter((c) => c.items.some((e) => e.id === picked)).map((c) => DAY_SHORT[c.day])
    : [];

  const onDragStart = (e: DragStartEvent) => {
    setAlt((e.activatorEvent as PointerEvent).altKey);
    setDrag(e.active.data.current as Drag);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const d = drag;
    setDrag(null);
    const t = e.over?.data.current as Target | undefined;
    if (!d || !t) return;
    const id = d.ex.id;
    const copy = alt;
    const fromIdx = dayIds(d.day).indexOf(id);
    if (t.day === d.day) {
      // Same day: index is in the list WITHOUT the dragged row.
      const at = t.at === null ? null : t.at > fromIdx ? t.at - 1 : t.at;
      if (at === fromIdx || (at === null && fromIdx === dayIds(d.day).length - 1)) return;
      void moveExercise(d.day, id, d.day, at);
      return;
    }
    if (dayIds(t.day).includes(id)) {
      toast(`${d.ex.name} is already on ${DAY_LONG[t.day]}`, true);
      return;
    }
    void moveExercise(d.day, id, t.day, t.at, copy).then(() =>
      toast(`${copy ? "Copied" : "Moved"} to ${DAY_LONG[t.day]}`, false, {
        label: "Undo",
        onClick: () =>
          copy ? removeFromDay(t.day, id) : void moveExercise(t.day, id, d.day, fromIdx),
      }),
    );
  };

  const onRemove = (day: DayIdx, ex: Exercise) => {
    const orderBefore = dayIds(day);
    const starred = isDayStarred(day, ex.id);
    if (picked === ex.id) setPicked(null);
    removeFromDay(day, ex.id);
    toast(`Removed from ${DAY_LONG[day]}`, false, {
      label: "Undo",
      // Reorder only after the row is back on the server, or the day scrambles.
      onClick: () =>
        void addToDay(day, ex.id).then(() => {
          if (starred) toggleDayStar(day, ex.id);
          setDayOrder(day, orderBefore);
        }),
    });
  };

  return (
    <div className="screen grid-screen" onClick={() => setPicked(null)}>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">Week grid</div>
          <h1 className="h1">All days</h1>
        </div>
        <div className="grid-pick" aria-live="polite">
          {pickedEx ? (
            <>
              <b>{pickedEx.name}</b>
              <span>
                {pickedDays.length} {pickedDays.length === 1 ? "day" : "days"} · {pickedDays.join(", ")}
              </span>
            </>
          ) : (
            <span>Click to highlight · drag to move · Alt + drag to copy</span>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <div className={`wgrid${focus ? " focusing" : ""}${drag ? " dragging" : ""}`}>
          {cols.map((c) => (
            <Column
              key={c.day}
              day={c.day}
              today={c.day === today}
              count={c.items.length}
              onAdd={() => setAdding(c.day)}
            >
              {c.items.map((ex, i) => (
                <Cell
                  key={ex.id}
                  day={c.day}
                  index={i}
                  ex={ex}
                  on={focus === ex.id}
                  locked={picked === ex.id}
                  onPick={() => setPicked((p) => (p === ex.id ? null : ex.id))}
                  onHover={setHover}
                  onRemove={() => onRemove(c.day, ex)}
                />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {drag && (
            <div className="wcell overlay" style={{ ["--accent" as string]: accentFor(muscleOf(drag.ex)) }}>
              <span className="wcell-name">{drag.ex.name}</span>
              <span className="wcell-meta">{alt ? "Copy" : muscleOf(drag.ex)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {adding !== null && (
        <ExercisePicker
          alreadyIn={dayIds(adding)}
          onPick={(id) => {
            void addToDay(adding, id);
            toast(`Added to ${DAY_LONG[adding]}`);
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

function Column({
  day,
  today,
  count,
  onAdd,
  children,
}: {
  day: DayIdx;
  today: boolean;
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const target: Target = { day, at: null };
  const { setNodeRef, isOver } = useDroppable({ id: colKey(day), data: target });
  return (
    <section className={`wcol${today ? " today" : ""}`}>
      <header className="wcol-h">
        <span className="wcol-day">{DAY_LONG[day]}</span>
        <span className="wcol-n num">{count || "Rest"}</span>
        <div className="wcol-note" onClick={(e) => e.stopPropagation()}>
          <DayNote day={day} />
        </div>
      </header>
      {children}
      <div ref={setNodeRef} className={`wcol-tail${isOver ? " over" : ""}`}>
        <button
          className="wcol-add"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          <IconPlus size={14} /> Add
        </button>
      </div>
    </section>
  );
}

function Cell({
  day,
  index,
  ex,
  on,
  locked,
  onPick,
  onHover,
  onRemove,
}: {
  day: DayIdx;
  index: number;
  ex: Exercise;
  on: boolean;
  locked: boolean;
  onPick: () => void;
  onHover: (id: string | null) => void;
  onRemove: () => void;
}) {
  const key = cellKey(day, ex.id);
  const drag = useDraggable({ id: key, data: { day, ex } satisfies Drag });
  const target: Target = { day, at: index };
  const drop = useDroppable({ id: key, data: target });
  const starred = isDayStarred(day, ex.id);
  return (
    <div
      ref={(n) => {
        drag.setNodeRef(n);
        drop.setNodeRef(n);
      }}
      {...drag.attributes}
      {...drag.listeners}
      className={`wcell${on ? " on" : ""}${locked ? " locked" : ""}${drag.isDragging ? " ghost" : ""}${
        drop.isOver && !drag.isDragging ? " over" : ""
      }`}
      style={{ ["--accent" as string]: accentFor(muscleOf(ex)) }}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      onMouseEnter={() => onHover(ex.id)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="wcell-name">{ex.name}</span>
      <span className="wcell-meta">{muscleOf(ex)}</span>
      {/* Inner buttons stop pointerdown so they never start a drag. */}
      <span className="wcell-acts" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className={`wcell-star${starred ? " is-on" : ""}`}
          aria-label={starred ? "Unstar" : "Star"}
          onClick={(e) => {
            e.stopPropagation();
            toggleDayStar(day, ex.id);
          }}
        >
          <IconStar size={14} on={starred} />
        </button>
        <button
          className="wcell-del"
          aria-label="Remove from day"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <IconMinusCircle size={14} />
        </button>
      </span>
    </div>
  );
}
