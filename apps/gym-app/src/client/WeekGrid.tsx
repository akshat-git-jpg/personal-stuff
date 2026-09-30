// Whole week as a sheet: one column per day. Click an exercise to highlight
// every day it appears on; drag it to move it to another day or slot.

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
import { accentFor, IconBack, IconStar, useToast } from "./ui";
import { useGym } from "./store";
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

/** Move (or reorder) one exercise; resolves once the server has the new row. */
async function moveExercise(from: DayIdx, id: string, to: DayIdx, at: number | null): Promise<void> {
  const starred = isDayStarred(from, id);
  if (from !== to) {
    await addToDay(to, id);
    if (starred) toggleDayStar(to, id);
    removeFromDay(from, id);
    setDayOrder(from, dayIds(from));
  }
  const rest = dayIds(to).filter((x) => x !== id);
  const idx = at === null ? rest.length : Math.min(at, rest.length);
  rest.splice(idx, 0, id);
  setDayOrder(to, rest);
}

export function WeekGrid({ onBack }: { onBack: () => void }) {
  const { exerciseById, dayNotes } = useGym();
  const toast = useToast();
  const plan = usePlan();
  const today = todayIdx();
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const focus = drag ? drag.ex.id : picked ?? hover;

  // A 6px move starts a drag, so a plain click still highlights.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  const onDragStart = (e: DragStartEvent) => setDrag(e.active.data.current as Drag);

  const onDragEnd = (e: DragEndEvent) => {
    const d = drag;
    setDrag(null);
    const t = e.over?.data.current as Target | undefined;
    if (!d || !t) return;
    const id = d.ex.id;
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
    void moveExercise(d.day, id, t.day, t.at).then(() =>
      toast(`Moved to ${DAY_LONG[t.day]}`, false, {
        label: "Undo",
        onClick: () => void moveExercise(t.day, id, d.day, fromIdx),
      }),
    );
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
            <span>Click to highlight · drag to move</span>
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
            <Column key={c.day} day={c.day} today={c.day === today} note={dayNotes[String(c.day)]} count={c.items.length}>
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
                />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {drag && (
            <div className="wcell overlay" style={{ ["--accent" as string]: accentFor(muscleOf(drag.ex)) }}>
              <span className="wcell-name">{drag.ex.name}</span>
              <span className="wcell-meta">{muscleOf(drag.ex)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  day,
  today,
  note,
  count,
  children,
}: {
  day: DayIdx;
  today: boolean;
  note?: string;
  count: number;
  children: React.ReactNode;
}) {
  const target: Target = { day, at: null };
  const { setNodeRef, isOver } = useDroppable({ id: colKey(day), data: target });
  return (
    <section className={`wcol${today ? " today" : ""}`}>
      <header className="wcol-h">
        <span className="wcol-day">{DAY_LONG[day]}</span>
        <span className="wcol-n num">{count || "Rest"}</span>
        {note && <p className="wcol-note">{note}</p>}
      </header>
      {children}
      <div ref={setNodeRef} className={`wcol-tail${isOver ? " over" : ""}`} />
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
}: {
  day: DayIdx;
  index: number;
  ex: Exercise;
  on: boolean;
  locked: boolean;
  onPick: () => void;
  onHover: (id: string | null) => void;
}) {
  const key = cellKey(day, ex.id);
  const drag = useDraggable({ id: key, data: { day, ex } satisfies Drag });
  const target: Target = { day, at: index };
  const drop = useDroppable({ id: key, data: target });
  return (
    <button
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
      <span className="wcell-meta">
        {muscleOf(ex)}
        {isDayStarred(day, ex.id) && <IconStar size={12} on />}
      </span>
    </button>
  );
}
