import { useRef } from "react";
import type { Task } from "../shared";
import { daysLeft, etaUrgency, fmtEta } from "./dates";

interface Props {
  task: Task;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  /** dnd-kit listeners for the drag handle; omitted for done cards. */
  handleProps?: Record<string, unknown>;
}

export function TaskCard({ task, onToggleDone, onSetEta, onEdit, onDelete, handleProps }: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const open = task.status === "open";

  function pickDeadline() {
    const el = dateRef.current;
    if (!el) return;
    el.value = task.eta ?? "";
    // showPicker is the clean native path; fall back to focus on older engines.
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.() ?? el.focus(); }
    catch { el.focus(); }
  }

  return (
    <div className={`card ${task.status === "done" ? "done" : ""}`}>
      {open && <div className="handle" {...handleProps} aria-label="reorder">⠿</div>}
      <input
        className="check"
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggleDone(task)}
        aria-label={open ? "mark done" : "mark open"}
      />
      <div className="body">
        <div className="title">{task.title}</div>
        {task.notes && <div className="notes">{task.notes}</div>}

        {task.eta ? (
          <Deadline
            eta={task.eta}
            editable={open}
            onEdit={pickDeadline}
            onClear={() => onSetEta(task, null)}
          />
        ) : open ? (
          <button className="add-deadline" onClick={pickDeadline}>+ Add deadline</button>
        ) : null}

        {/* hidden native date control, driven by pickDeadline() */}
        <input
          ref={dateRef}
          className="eta-input"
          type="date"
          tabIndex={-1}
          aria-hidden
          defaultValue={task.eta ?? ""}
          onChange={(e) => onSetEta(task, e.target.value || null)}
        />
      </div>
      <button className="edit" onClick={() => onEdit(task)} aria-label="edit">✎</button>
      <button className="del" onClick={() => onDelete(task)} aria-label="delete">✕</button>
    </div>
  );
}

function Deadline({ eta, editable, onEdit, onClear }: {
  eta: string; editable: boolean; onEdit: () => void; onClear: () => void;
}) {
  const d = daysLeft(eta);
  const u = etaUrgency(d);
  // bar fills as the deadline approaches: ~full 14+ days out, empty at the wire.
  const fill = d < 0 ? 100 : Math.max(6, Math.min(100, Math.round((d / 14) * 100)));
  const label = d < 0 ? `${-d}d overdue` : d === 0 ? "due today" : `${d} day${d === 1 ? "" : "s"} left`;

  return (
    <div className="deadline">
      <button className="date" onClick={editable ? onEdit : undefined} disabled={!editable}>
        <span className="ic">◷</span>{fmtEta(eta)}
      </button>
      <span className={`bar ${u}`}><span style={{ width: `${fill}%` }} /></span>
      <span className={`days ${u}`}>{label}</span>
      {editable && (
        <button className="clear-eta" onClick={onClear} aria-label="clear deadline" title="clear deadline">✕</button>
      )}
    </div>
  );
}
