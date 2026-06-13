import { useState } from "react";
import type { LogEntry } from "../shared";
import { IconTrash } from "./ui";

export function Stepper({
  label,
  unit,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
}) {
  function bump(d: number) {
    onChange(Math.max(min, Math.round((value + d) * 100) / 100));
    if (navigator.vibrate) navigator.vibrate(6);
  }
  return (
    <div className="stepper">
      <div className="slabel">{label}</div>
      <div className="srow">
        <button className="sbtn" onClick={() => bump(-step)}>
          −
        </button>
        <div>
          <span
            className="sval num"
            onClick={() => {
              const n = prompt(`${label} (${unit})`, String(value));
              if (n !== null && !isNaN(Number(n))) onChange(Math.max(min, Number(n)));
            }}
          >
            {value}
          </span>
          <span className="sunit"> {unit}</span>
        </div>
        <button className="sbtn" onClick={() => bump(step)}>
          +
        </button>
      </div>
    </div>
  );
}

export function LogEditSheet({
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  entry: LogEntry;
  onClose: () => void;
  onSave: (weight: number, reps: number) => void;
  onDelete: () => void;
}) {
  const [weight, setWeight] = useState(entry.weight);
  const [reps, setReps] = useState(entry.reps);
  const when = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="grabber" />
        <h2>Edit Set {entry.setNo}</h2>
        <div className="kicker" style={{ marginBottom: 16 }}>
          {entry.exercise} · {when}
        </div>
        <div className="steppers">
          <Stepper label="Weight" unit="kg" value={weight} step={2.5} min={0} onChange={setWeight} />
          <Stepper label="Reps" unit="" value={reps} step={1} min={1} onChange={setReps} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onSave(weight, reps)}>
          Save
        </button>
        <button className="btn btn-heat" style={{ marginTop: 10 }} onClick={onDelete}>
          <IconTrash size={20} /> Delete set
        </button>
      </div>
    </>
  );
}
