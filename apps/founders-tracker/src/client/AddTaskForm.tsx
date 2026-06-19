import { useState } from "react";
import type { Owner, Task } from "../shared";
import { api } from "./api";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AddTaskForm({ defaultOwner = "khushi", onClose, onCreated }: {
  defaultOwner?: Owner; onClose: () => void; onCreated: (t: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<Owner>(defaultOwner);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [eta, setEta] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const t = await api.createTask({
        title: title.trim(),
        owner,
        eta: hasDeadline && eta ? eta : null,
        notes: notes || null,
      });
      onCreated(t);
      onClose();
    } catch (e) { alert(String(e)); setBusy(false); }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <h2>New task</h2>

        <div className="field">
          <label>What needs doing</label>
          <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Send the investor update" />
        </div>

        <div className="field">
          <label>Owner</label>
          <div className="row">
            {(["khushi", "kushal"] as Owner[]).map((o) => (
              <button key={o} className={`pill ${owner === o ? "on" : ""}`} onClick={() => setOwner(o)}>
                {o[0].toUpperCase() + o.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <label className="toggle-row">
          <span className="tl">
            <b>Has a deadline?</b>
            <span>Optional — leave off for an open-ended task.</span>
          </span>
          <span className="switch">
            <input type="checkbox" checked={hasDeadline}
              onChange={(e) => setHasDeadline(e.target.checked)} />
            <span className="track" /><span className="knob" />
          </span>
        </label>

        {hasDeadline && (
          <div className="field">
            <label>Deadline</label>
            <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra context (optional)" />
        </div>

        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy || !title.trim()} onClick={submit}>
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}

export { DOW };
