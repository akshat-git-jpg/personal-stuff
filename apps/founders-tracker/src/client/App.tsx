import { useEffect, useState } from "react";
import type { Owner, Task, TaskPatch } from "../shared";
import { api, type BootstrapData } from "./api";
import { TaskList } from "./TaskList";
import { RecurringScreen } from "./RecurringScreen";

type Screen = "tracker" | "recurring";

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("tracker");
  const [tab, setTab] = useState<Owner>("khushi");

  async function reload() {
    try { setData(await api.bootstrap()); } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { reload(); }, []);

  if (err) return <div className="app"><div className="errbox">{err}</div></div>;
  if (!data) return <div className="app"><p className="empty">Opening the ledger…</p></div>;

  const ownTasks = data.tasks.filter((t) => t.owner === tab);

  async function patchAndReload(id: number, patch: Parameters<typeof api.patchTask>[1]) {
    await api.patchTask(id, patch);
    await reload();
  }
  function toggleDone(t: Task) {
    patchAndReload(t.id, { status: t.status === "done" ? "open" : "done" });
  }
  function setEta(t: Task, value: string | null) {
    patchAndReload(t.id, { eta: value });
  }
  async function addTask(title: string, eta: string | null) {
    await api.createTask({ title, owner: tab, eta });
    await reload();
  }
  function saveEdit(t: Task, patch: TaskPatch) {
    patchAndReload(t.id, patch);
  }
  async function del(t: Task) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await api.deleteTask(t.id);
    await reload();
  }
  async function reorder(owner: Owner, orderedIds: number[]) {
    // optimistic: apply locally, then persist
    setData((d) => {
      if (!d) return d;
      const order = new Map(orderedIds.map((id, i) => [id, i + 1]));
      return { ...d, tasks: d.tasks.map((t) => order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t) };
    });
    try { await api.reorder(owner, "open", orderedIds); } catch (e) { alert(String(e)); reload(); }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="crown-row">
          <div className="wordmark">
            <span className="kicker">Khushi &amp; Kushal</span>
            <h1>Founders <em>Ledger</em></h1>
          </div>
        </div>
        <div className="rule" />
      </header>

      <nav className="segnav" style={{ marginBottom: 18 }}>
        <button className={screen === "tracker" ? "active" : ""} onClick={() => setScreen("tracker")}>
          Tracker
        </button>
        <button className={screen === "recurring" ? "active" : ""} onClick={() => setScreen("recurring")}>
          Repeats
        </button>
      </nav>

      {screen === "recurring" ? (
        <RecurringScreen templates={data.templates} onChanged={reload} />
      ) : (
        <>
          <div className="ownerbar">
            {(["khushi", "kushal"] as Owner[]).map((o) => {
              const openCount = data.tasks.filter((t) => t.owner === o && t.status === "open").length;
              return (
                <div key={o} className={`ownertab ${tab === o ? "active" : ""}`} onClick={() => setTab(o)}>
                  {o[0].toUpperCase() + o.slice(1)}
                  <span className="count">{openCount}</span>
                </div>
              );
            })}
          </div>
          <TaskList owner={tab} tasks={ownTasks}
            onReorder={reorder} onAdd={addTask} onToggleDone={toggleDone} onSetEta={setEta}
            onSaveEdit={saveEdit} onDelete={del} />
        </>
      )}
    </div>
  );
}
