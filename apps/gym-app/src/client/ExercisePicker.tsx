// Bottom sheet for adding a catalogue exercise to a day: search across every
// tab, grouped by muscle group. Read-only over the catalogue — picking never
// creates or edits an exercise, it only writes a plan row.

import { useMemo, useState } from "react";
import { accentFor } from "./ui";
import { useGym } from "./store";
import { gymBadge } from "./gym";
import { muscleOf } from "./plan";

export function ExercisePicker({
  alreadyIn,
  onPick,
  onClose,
}: {
  alreadyIn: string[];
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const { allExercises } = useGym();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = new Map<string, typeof allExercises>();
    for (const ex of allExercises) {
      if (needle && !ex.name.toLowerCase().includes(needle)) continue;
      const m = muscleOf(ex);
      if (!out.has(m)) out.set(m, []);
      out.get(m)!.push(ex);
    }
    return [...out.entries()];
  }, [allExercises, q]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet sheet-tall">
        <div className="grabber" />
        <h2>Add to day</h2>
        <input
          className="input"
          placeholder="Search exercises"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="picker">
          {groups.map(([muscle, list]) => (
            <div key={muscle}>
              <div className="picker-h" style={{ color: accentFor(muscle) }}>
                {muscle}
              </div>
              {list.map((ex) => {
                const added = alreadyIn.includes(ex.id);
                return (
                  <button
                    key={ex.id}
                    className={`picker-row${added ? " added" : ""}`}
                    disabled={added}
                    onClick={() => onPick(ex.id)}
                  >
                    <span className="picker-name">{ex.name || "Untitled"}</span>
                    <span className={`tag tag-${ex.gym}`}>
                      {gymBadge(ex.gym)}
                    </span>
                    <span className="picker-add num">{added ? "in plan" : "+"}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="empty">
              <div className="big">No match</div>
              Nothing in the catalogue matches "{q}".
            </div>
          )}
        </div>
      </div>
    </>
  );
}
