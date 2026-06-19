import type { Task } from "../shared";
import { daysLeft, etaUrgency, fmtEta } from "./dates";

interface Props {
  task: Task;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task) => void;
  onDelete: (t: Task) => void;
  /** dnd-kit listeners for the drag handle; omitted for done cards. */
  handleProps?: Record<string, unknown>;
}

export function TaskCard({ task, onToggleDone, onSetEta, onDelete, handleProps }: Props) {
  const hazard = task.status === "open" && !task.eta;

  return (
    <div className={`card ${hazard ? "hazard" : ""} ${task.status === "done" ? "done" : ""}`}>
      {task.status === "open" && (
        <div className="handle" {...handleProps} aria-label="drag">⠿</div>
      )}
      <input
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggleDone(task)}
        aria-label="done"
      />
      <div className="body">
        {hazard && <div className="banner">⚠ NO DEADLINE SET</div>}
        <div className="title">{task.title}</div>
        {task.notes && <div className="notes">{task.notes}</div>}
        {hazard ? (
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => onSetEta(task)}>
            SET AN ETA
          </button>
        ) : task.eta ? (
          <Countdown eta={task.eta} />
        ) : null}
      </div>
      <button className="btn" onClick={() => onDelete(task)} aria-label="delete">✕</button>
    </div>
  );
}

function Countdown({ eta }: { eta: string }) {
  const d = daysLeft(eta);
  const u = etaUrgency(d);
  // fill: 100% at >=14 days out, shrinking toward the deadline.
  const fill = u === "overdue" ? 100 : Math.max(8, Math.min(100, Math.round((d / 14) * 100)));
  const label = d < 0 ? "OVERDUE" : d === 0 ? "DUE TODAY" : `${d} DAY${d === 1 ? "" : "S"} LEFT`;
  return (
    <div className="countdown">
      <span className="date">📅 {fmtEta(eta)}</span>
      <span className={`bar ${u}`}><span style={{ width: `${fill}%` }} /></span>
      <span className={`days ${u}`}>{label}</span>
    </div>
  );
}
