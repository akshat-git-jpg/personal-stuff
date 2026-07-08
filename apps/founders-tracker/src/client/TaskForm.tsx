import { useState } from "react";
import type { Owner, Task } from "../shared";
import { api } from "./api";
import { tomorrowIST } from "./dates";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TaskForm({ initial, defaultOwner = "khushi", onClose, onSaved }: {
  /** Task being edited, or null to create a new one. */
  initial: Task | null;
  defaultOwner?: Owner;
  onClose: () => void;
  onSaved: (t: Task) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [owner, setOwner] = useState<Owner>(initial?.owner ?? defaultOwner);
  const [eta, setEta] = useState(initial?.eta ?? tomorrowIST());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const patch = { title: title.trim(), owner, eta: eta || null, notes: notes || null };
    try {
      const t = initial ? await api.patchTask(initial.id, patch) : await api.createTask(patch);
      onSaved(t);
      onClose();
    } catch (e) { alert(String(e)); setBusy(false); }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <h2>{initial ? "Edit task" : "New task"}</h2>

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

        <div className="field">
          <label>Deadline</label>
          <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
        </div>

        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra context (optional)" />
        </div>

        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy || !title.trim()} onClick={submit}>
            {initial ? "Save changes" : "Add task"}
          </button>
        </div>
      </div>
    </div>
  );
}

export { DOW };
