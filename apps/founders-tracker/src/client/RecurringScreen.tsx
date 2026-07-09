import { useState } from "react";
import type { Cadence, Owner, Template, TemplateInput } from "../shared";
import { api } from "./api";
import { DOW } from "./dates";

function dueLabel(t: Template): string {
  if (t.cadence === "weekly") return `every ${DOW[t.dueDay] ?? "?"}`;
  const n = t.dueDay;
  const suff = n === 1 || n === 21 || n === 31 ? "st" : n === 2 || n === 22 ? "nd" : n === 3 || n === 23 ? "rd" : "th";
  return `the ${n}${suff}`;
}

export function RecurringScreen({ templates, onChanged }: {
  templates: Template[]; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  async function toggleActive(t: Template) {
    try { await api.patchTemplate(t.id, { active: !t.active }); onChanged(); } catch (e) { alert(String(e)); }
  }
  async function remove(t: Template) {
    if (!confirm(`Delete repeat job "${t.title}"? Already-generated tasks stay.`)) return;
    try { await api.deleteTemplate(t.id); onChanged(); } catch (e) { alert(String(e)); }
  }

  return (
    <div>
      <div className="crown-row" style={{ marginBottom: 16 }}>
        <span className="kicker" style={{ letterSpacing: ".18em" }}>Auto-generated tasks</span>
        <button className="btn btn-primary btn-add" onClick={() => setEditing("new")}>
          <span className="plus">+</span> New repeat
        </button>
      </div>
      {templates.length === 0 && (
        <p className="empty">No repeating jobs yet — add one to have it appear on schedule.</p>
      )}
      {templates.map((t) => (
        <div className="card rec-card" key={t.id}>
          <div className="body">
            <div className="title">{t.title}</div>
            <div className="meta">
              <span className="cadence-chip">{t.cadence}</span>
              {!t.active && <span className="paused-chip">paused</span>}
              <span>{t.owner[0].toUpperCase() + t.owner.slice(1)} · due {dueLabel(t)}</span>
            </div>
          </div>
          <div className="rec-actions">
            <button className="icon-btn" onClick={() => toggleActive(t)}>{t.active ? "Pause" : "Resume"}</button>
            <button className="icon-btn" onClick={() => setEditing(t)}>Edit</button>
            <button className="icon-btn danger" onClick={() => remove(t)} aria-label="delete">✕</button>
          </div>
        </div>
      ))}
      {editing && (
        <TemplateForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ initial, onClose, onSaved }: {
  initial: Template | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [owner, setOwner] = useState<Owner>(initial?.owner ?? "khushi");
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "monthly");
  const [dueDay, setDueDay] = useState<number>(initial?.dueDay ?? (initial?.cadence === "weekly" ? 4 : 1));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const input: TemplateInput = { title: title.trim(), owner, cadence, dueDay, notes: notes || null };
    try {
      if (initial) await api.patchTemplate(initial.id, input);
      else await api.createTemplate(input);
      onSaved();
    } catch (e) { alert(String(e)); setBusy(false); }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <h2>{initial ? "Edit repeat job" : "New repeat job"}</h2>
        <div className="field">
          <label>Title</label>
          <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
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
          <label>Cadence</label>
          <div className="row">
            {(["monthly", "weekly"] as Cadence[]).map((cd) => (
              <button key={cd} className={`pill ${cadence === cd ? "on" : ""}`}
                onClick={() => { setCadence(cd); setDueDay(cd === "weekly" ? 4 : 1); }}>
                {cd}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{cadence === "weekly" ? "Due weekday" : "Due day of month (1–31)"}</label>
          {cadence === "weekly" ? (
            <select value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))}>
              {DOW.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          ) : (
            <input type="number" min={1} max={31} value={dueDay}
              onChange={(e) => setDueDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
          )}
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={busy} onClick={save}>
            {initial ? "Save" : "Create repeat job"}
          </button>
        </div>
      </div>
    </div>
  );
}
