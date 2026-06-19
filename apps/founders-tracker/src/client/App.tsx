import { useEffect, useMemo, useState } from "react";
import type { Owner, Task } from "../shared";
import { api, type BootstrapData } from "./api";
import { Scoreboard } from "./Scoreboard";
import { TaskList } from "./TaskList";
import { AddTaskForm } from "./AddTaskForm";
import { RecurringScreen } from "./RecurringScreen";

type Screen = "tracker" | "recurring";

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("tracker");
  const [tab, setTab] = useState<Owner>("kushal");
  const [adding, setAdding] = useState(false);

  async function reload() {
    try { setData(await api.bootstrap()); } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { reload(); }, []);

  const noEtaCount = useMemo(
    () => data?.tasks.filter((t) => t.status === "open" && !t.eta).length ?? 0,
    [data],
  );

  if (err) return <div className="app"><p style={{ color: "#f87171" }}>{err}</p></div>;
  if (!data) return <div className="app"><p style={{ color: "var(--muted)" }}>Loading…</p></div>;

  const ownTasks = data.tasks.filter((t) => t.owner === tab);

  async function patchAndReload(id: number, patch: Parameters<typeof api.patchTask>[1]) {
    await api.patchTask(id, patch);
    await reload();
  }
  function toggleDone(t: Task) {
    patchAndReload(t.id, { status: t.status === "done" ? "open" : "done" });
  }
  function setEta(t: Task) {
    const v = prompt("Set ETA (YYYY-MM-DD), blank to clear:", t.eta ?? "");
    if (v === null) return;
    patchAndReload(t.id, { eta: v.trim() || null });
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
    try { await api.reorder(owner, "open", orderedIds); } catch (e) { setErr(String(e)); }
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🚀 Founders Tracker</h1>
        <div className="row">
          <span className={`alarm ${noEtaCount === 0 ? "hidden" : ""}`}>⚠ {noEtaCount} no ETA</span>
          <button className="btn" onClick={() => setScreen(screen === "tracker" ? "recurring" : "tracker")}>
            {screen === "tracker" ? "↻ Repeat jobs" : "← Tracker"}
          </button>
        </div>
      </div>

      {screen === "recurring" ? (
        <RecurringScreen templates={data.templates} onChanged={reload} />
      ) : (
        <>
          <Scoreboard data={data.scoreboard} />
          <div className="tabbar">
            {(["khushi", "kushal"] as Owner[]).map((o) => {
              const openCount = data.tasks.filter((t) => t.owner === o && t.status === "open").length;
              return (
                <div key={o} className={`tab ${tab === o ? "active" : ""}`} onClick={() => setTab(o)}>
                  {o[0].toUpperCase() + o.slice(1)} ({openCount})
                </div>
              );
            })}
          </div>
          <TaskList owner={tab} tasks={ownTasks}
            onReorder={reorder} onToggleDone={toggleDone} onSetEta={setEta} onDelete={del} />
          <button className="btn btn-primary" style={{ position: "fixed", right: 18, bottom: 18, borderRadius: 999, padding: "14px 18px" }}
            onClick={() => setAdding(true)}>+ Add</button>
        </>
      )}

      {adding && <AddTaskForm onClose={() => setAdding(false)} onCreated={reload} />}
    </div>
  );
}
