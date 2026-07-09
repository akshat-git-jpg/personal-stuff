import { useState } from "react";
import type { Owner, Task, TaskPatch } from "../shared";
import { AutoTextarea } from "./AutoTextarea";
import { DatePick } from "./DatePick";
import { daysLeft, etaUrgency, fmtEta, tomorrowIST } from "./dates";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props {
  task: Task;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onSaveEdit: (t: Task, patch: TaskPatch) => void;
  onDelete: (t: Task) => void;
  /** dnd-kit listeners for the drag handle; omitted for done cards. */
  handleProps?: Record<string, unknown>;
}

export function TaskCard({ task, onToggleDone, onSetEta, onSaveEdit, onDelete, handleProps }: Props) {
  const open = task.status === "open";

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftOwner, setDraftOwner] = useState<Owner>(task.owner);

  function startEdit() {
    setDraftTitle(task.title);
    setDraftOwner(task.owner);
    setEditing(true);
  }
  function save() {
    const title = draftTitle.trim();
    if (!title) return;
    onSaveEdit(task, { title, owner: draftOwner });
    setEditing(false);
  }
  function onEditKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
  }

  // Read view: date + countdown; tap the date to open the inline chip editor.
  const deadline = task.eta ? (
    <Deadline
      eta={task.eta}
      editable={open}
      onEdit={startEdit}
      onClear={() => onSetEta(task, null)}
    />
  ) : open ? (
    <button className="add-deadline" onClick={() => onSetEta(task, tomorrowIST())}>+ Add deadline</button>
  ) : null;

  return (
    <div className={`card ${task.status === "done" ? "done" : ""} ${editing ? "editing" : ""}`}>
      {open && !editing && <div className="handle" {...handleProps} aria-label="reorder">⠿</div>}
      <input
        className="check"
        type="checkbox"
        checked={task.status === "done"}
        onChange={() => onToggleDone(task)}
        aria-label={open ? "mark done" : "mark open"}
      />
      <div className="body">
        {editing ? (
          <div className="edit-inline">
            <AutoTextarea
              className="title-edit"
              value={draftTitle}
              autoFocus
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={onEditKey}
              placeholder="What needs doing"
            />
            <div className="owner-mini">
              {(["khushi", "kushal"] as Owner[]).map((o) => (
                <button key={o} className={`pill-mini ${draftOwner === o ? "on" : ""}`}
                  onClick={() => setDraftOwner(o)}>{cap(o)}</button>
              ))}
            </div>
            <DatePick value={task.eta} onChange={(v) => onSetEta(task, v)} />
            <div className="edit-actions">
              <button className="btn-mini" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-mini primary" disabled={!draftTitle.trim()} onClick={save}>Save</button>
            </div>
          </div>
        ) : (
          <>
            <div className={`title ${open ? "tappable" : ""}`}
              onClick={open ? startEdit : undefined}>{task.title}</div>
            {deadline}
          </>
        )}
      </div>
      {!editing && (
        <button className="edit" onClick={startEdit} aria-label="edit">✎</button>
      )}
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
