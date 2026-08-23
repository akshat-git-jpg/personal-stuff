import { useState } from "react";
import type { Owner, Task, TaskPatch } from "../shared";
import { AutoTextarea } from "./AutoTextarea";
import { DatePick } from "./DatePick";
import { metaLabel } from "./grouping";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props {
  task: Task;
  /** Cadence of the source template ('daily' …), or null for a manual task. */
  repeat?: string | null;
  todayYmd: string;
  onToggleDone: (t: Task) => void;
  onSetEta: (t: Task, value: string | null) => void;
  onSaveEdit: (t: Task, patch: TaskPatch) => void;
  onDelete: (t: Task) => void;
  /** dnd-kit listeners for the drag handle; omitted for done cards. */
  handleProps?: Record<string, unknown>;
}

export function TaskCard({ task, repeat, todayYmd, onToggleDone, onSetEta, onSaveEdit, onDelete, handleProps }: Props) {
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

  return (
    <div className={`card row ${task.status === "done" ? "done" : ""} ${editing ? "editing" : ""}`}>
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
            <div className="row-line">
              <button
                className="row-title"
                onClick={open ? startEdit : undefined}
                disabled={!open}
                title={task.title}
              >
                {task.title}
              </button>
              <span className="row-meta">{metaLabel(task.eta, todayYmd)}</span>
            </div>
            {repeat && (
              <div className="repeat-chip" title="generated from a repeat">
                <span className="ic">↻</span>{repeat}
              </div>
            )}
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
