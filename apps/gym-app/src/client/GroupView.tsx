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
import { accentFor, IconBack, IconGrip, IconPlus, IconStar, IconTrash, useToast } from "./ui";
import { useGym } from "./store";
import { gymLabel, rebuildSliceOrder, specGym, type GroupSpec } from "./gym";

function summarise(ex: Exercise): string {
  return (
    ex.setsReps?.split(/[;\n]/)[0]?.trim() ||
    ex.setting?.split(/[;\n]/)[0]?.trim() ||
    "No log yet"
  );
}

function Row({
  ex,
  doneToday,
  sortable,
  onOpen,
  onStar,
  onDelete,
}: {
  ex: Exercise;
  doneToday: number;
  /** False in A-Z view: the order is computed, so dragging it means nothing. */
  sortable: boolean;
  onOpen: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.id });
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; lock: "" | "x" | "y" } | null>(null);

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

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`exrow${isDragging ? " dragging" : ""}${ex.starred ? " starred" : ""}`}
    >
      {dx !== 0 && (
        <div className="swipe-del" onClick={onDelete}>
          Delete
        </div>
      )}
      <div
        className="exrow-fg"
        style={{
          transform: `translateX(${dx}px)`,
          transition: start.current ? "none" : "transform 0.2s ease",
        }}
      >
        {sortable ? (
          <div className="grip" {...attributes} {...listeners} aria-label="Drag to reorder">
            <IconGrip size={20} />
          </div>
        ) : (
          /* Keeps the row's left inset identical, so nothing shifts on toggle. */
          <div className="grip" aria-hidden="true" />
        )}
        <div
          className="body"
          onClick={() => (dx === 0 ? onOpen() : setDx(0))}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="name">
            {doneToday > 0 && (
              <span className="done-badge num" title="Sets logged today">
                ✓ {doneToday}
              </span>
            )}
            {ex.name || "Untitled"}
          </div>
          <div className="meta">{summarise(ex)}</div>
        </div>
        <button
          className={`rowstar${ex.starred ? " on" : ""}`}
          onClick={onStar}
          title={ex.starred ? `Unstar ${ex.name}` : `Star ${ex.name}`}
          aria-label={ex.starred ? `Unstar ${ex.name}` : `Star ${ex.name}`}
          aria-pressed={ex.starred}
        >
          <IconStar size={18} on={ex.starred} />
        </button>
        {/* Mouse-reachable twin of the swipe gesture — Macs cannot swipe. */}
        <button className="rowdel" onClick={onDelete} title={`Delete ${ex.name}`} aria-label={`Delete ${ex.name}`}>
          <IconTrash size={18} />
        </button>
      </div>
    </div>
  );
}

export function GroupView({
  spec,
  onBack,
  onOpenExercise,
}: {
  spec: GroupSpec;
  onBack: () => void;
  onOpenExercise: (id: string) => void;
}) {
  const { exercisesFor, reorder, deleteExercise, addExercise, setsTodayFor, toggleStar } = useGym();
  const all = exercisesFor(spec.tab);
  const items = spec.muscle
    ? all.filter((e) => (e.muscleGroup || "Other") === spec.muscle)
    : all;
  const [adding, setAdding] = useState(false);
  // View-only. Never written back, and never the default - it resets every
  // time the screen is opened.
  const [alpha, setAlpha] = useState(false);
  const toast = useToast();
  const accent = accentFor(spec.muscle || spec.tab);
  const gym = specGym(spec);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const view = alpha
    ? [...items].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      )
    : items;

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (alpha || !over || active.id === over.id) return;
    const oldIdx = items.findIndex((x) => x.id === active.id);
    const newIdx = items.findIndex((x) => x.id === over.id);
    const nextIds = arrayMove(items, oldIdx, newIdx).map((x) => x.id);
    // For an Anu muscle slice, fold the new slice order back into the full tab.
    const fullOrder = spec.muscle ? rebuildSliceOrder(all, spec.muscle, nextIds) : nextIds;
    reorder(spec.tab, fullOrder);
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker" style={{ color: accent }}>
            {gymLabel(gym)} · {items.length} exercises
          </div>
          <h1 className="h1">{spec.label}</h1>
        </div>
      </div>

      {items.length > 1 && (
        <div className="seg seg-sm" style={{ ["--accent" as string]: accent }}>
          <button className={`seg-btn${alpha ? "" : " on"}`} onClick={() => setAlpha(false)}>
            My order
          </button>
          <button className={`seg-btn${alpha ? " on" : ""}`} onClick={() => setAlpha(true)}>
            A-Z
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className="empty">
          <div className="big">Empty rack</div>
          Add your first exercise below.
        </div>
      )}

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={view.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <div className="list">
              {view.map((ex) => (
                <Row
                  key={ex.id}
                  ex={ex}
                  doneToday={setsTodayFor(ex.id)}
                  sortable={!alpha}
                  onOpen={() => onOpenExercise(ex.id)}
                  onStar={() => toggleStar(ex)}
                  onDelete={() =>
                    deleteExercise(spec.tab, ex.id).then((undo) => {
                      if (undo) toast(`Deleted ${ex.name}`, false, { label: "Undo", onClick: undo });
                    })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="bottombar">
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <IconPlus size={22} /> Add Exercise
        </button>
      </div>

      {adding && (
        <AddSheet
          presetMuscle={spec.muscle}
          onClose={() => setAdding(false)}
          onAdd={async (input) => {
            const created = await addExercise(spec.tab, input);
            if (created) {
              setAdding(false);
              toast("Added");
            }
          }}
        />
      )}
    </div>
  );
}

function AddSheet({
  presetMuscle,
  onClose,
  onAdd,
}: {
  presetMuscle?: string;
  onClose: () => void;
  onAdd: (input: {
    name: string;
    muscleGroup?: string;
    setting?: string;
    setsReps?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [setting, setSetting] = useState("");
  const [setsReps, setSetsReps] = useState("");
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="grabber" />
        <h2>New Exercise</h2>
        {presetMuscle && <div className="kicker" style={{ marginBottom: 14 }}>{presetMuscle}</div>}
        <input
          className="input"
          placeholder="Exercise name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {more ? (
          <>
            <input className="input" placeholder="Setting / setup" value={setting} onChange={(e) => setSetting(e.target.value)} />
            <input className="input" placeholder="Sets / reps reference" value={setsReps} onChange={(e) => setSetsReps(e.target.value)} />
            <input className="input" placeholder="Notes / form cues" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        ) : (
          <button className="btn btn-ghost" style={{ height: 44, marginBottom: 12 }} onClick={() => setMore(true)}>
            + Add setting / notes
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={!name.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await onAdd({ name, muscleGroup: presetMuscle, setting, setsReps, notes });
            setBusy(false);
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
