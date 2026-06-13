import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise, LogEntry } from "../shared";
import { accentFor, IconBack, IconCheck, IconHistory, IconRepeat, useToast } from "./ui";
import { useGym } from "./store";
import { LogEditSheet, Stepper } from "./LogEditSheet";

/* ---- auto-saving multiline field ---- */
function Field({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  function grow() {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }
  useEffect(grow, [v]);
  return (
    <textarea
      ref={ref}
      className="field"
      rows={1}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

function Chart({ log }: { log: LogEntry[] }) {
  const pts = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of log) {
      const day = e.date.slice(0, 10);
      byDay.set(day, Math.max(byDay.get(day) ?? 0, e.weight));
    }
    return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-12);
  }, [log]);

  if (pts.length < 2) return null;
  const W = 320,
    H = 110,
    pad = 14;
  const ws = pts.map((p) => p[1]);
  const min = Math.min(...ws),
    max = Math.max(...ws);
  const rng = max - min || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (w: number) => H - pad - ((w - min) / rng) * (H - 2 * pad);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[1])}`).join(" ");
  const area = `${d} L${x(pts.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#g)" />
      <path d={d} fill="none" stroke="var(--lime)" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p[1])} r={i === pts.length - 1 ? 4 : 2.5} fill="var(--lime)" />
      ))}
    </svg>
  );
}

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export function ExerciseDetail({
  tab,
  id,
  onBack,
}: {
  tab: string;
  id: string;
  onBack: () => void;
}) {
  const { exercisesFor, logFor, updateExercise, addLog, updateLog, deleteLog, loadFullLog } =
    useGym();
  const ex: Exercise | undefined = exercisesFor(tab).find((e) => e.id === id);
  const log = logFor(id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const toast = useToast();
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const [weight, setWeight] = useState(() => {
    const last = logFor(id)[0];
    if (last) return last.weight;
    const m = /(\d+(?:\.\d+)?)\s*kg/i.exec(ex?.setsReps ?? "");
    return m ? Number(m[1]) : 0;
  });
  const [reps, setReps] = useState(() => {
    const last = logFor(id)[0];
    if (last) return last.reps;
    const m = /(\d+)\s*reps?/i.exec(ex?.setsReps ?? "");
    return m ? Number(m[1]) : 10;
  });
  const [name, setName] = useState(ex?.name ?? "");

  // Ensure the full progression history (beyond the recent window) is loaded.
  useEffect(() => {
    loadFullLog();
  }, [loadFullLog]);

  // Exercise was deleted elsewhere — bounce back.
  useEffect(() => {
    if (!ex) onBack();
  }, [ex, onBack]);
  useEffect(() => {
    if (ex) setName(ex.name);
  }, [ex?.name]);

  if (!ex) return null;

  const accent = accentFor(ex.muscleGroup || ex.tab);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySets = log
    .filter((e) => e.date.slice(0, 10) === todayKey)
    .sort((a, b) => a.setNo - b.setNo);

  function logSet() {
    addLog({
      exerciseId: ex!.id,
      exercise: ex!.name,
      muscleGroup: ex!.muscleGroup || ex!.tab,
      setNo: todaySets.length + 1,
      weight,
      reps,
    });
    if (navigator.vibrate) navigator.vibrate([10, 40, 20]);
    toast(`Logged ${weight}kg × ${reps}`);
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker" style={{ color: accent }}>
            {ex.muscleGroup || ex.tab} · {ex.id}
          </div>
        </div>
      </div>

      <input
        className="detail-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== ex.name && updateExercise(tab, ex.id, { name })}
      />

      <div className="logger">
        <div className="steppers">
          <Stepper label="Weight" unit="kg" value={weight} step={2.5} min={0} onChange={setWeight} />
          <Stepper label="Reps" unit="" value={reps} step={1} min={1} onChange={setReps} />
        </div>
        {log[0] && (
          <button
            className="repeat-chip"
            onClick={() => {
              setWeight(log[0].weight);
              setReps(log[0].reps);
            }}
          >
            <IconRepeat size={14} /> Last {log[0].weight}×{log[0].reps}
          </button>
        )}
        {todaySets.length > 0 && (
          <div className="today-sets">
            {todaySets.map((s, i) => (
              <button key={i} className="set-pill num tappable" onClick={() => setEditing(s)}>
                <b>{s.weight}</b>kg · {s.reps}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="label">Setting</div>
        <Field value={ex.setting} placeholder="Machine setup, seat, grip…" onSave={(v) => updateExercise(tab, ex.id, { name: ex.name, setting: v })} />
      </div>
      <div className="card">
        <div className="label">Working sets / reps</div>
        <Field value={ex.setsReps} placeholder="e.g. 17.5 kg 8 reps" onSave={(v) => updateExercise(tab, ex.id, { name: ex.name, setsReps: v })} />
      </div>
      <div className="card">
        <div className="label">Notes</div>
        <Field value={ex.notes} placeholder="Form cues, reminders…" onSave={(v) => updateExercise(tab, ex.id, { name: ex.name, notes: v })} />
      </div>

      {log.length > 0 && (
        <>
          <div className="section-h">
            <IconHistory size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Progression
          </div>
          <div className="card">
            <Chart log={log} />
            <div className="sessions">
              {Object.entries(
                log.reduce<Record<string, LogEntry[]>>((acc, e) => {
                  const k = e.date.slice(0, 10);
                  (acc[k] ??= []).push(e);
                  return acc;
                }, {}),
              )
                .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                .slice(0, 12)
                .map(([day, sets]) => {
                  const top = Math.max(...sets.map((s) => s.weight));
                  const open = openDay === day;
                  const ordered = sets.slice().sort((a, b) => a.setNo - b.setNo);
                  return (
                    <div key={day}>
                      <button
                        className="session as-button"
                        onClick={() => setOpenDay(open ? null : day)}
                      >
                        <span className="num">
                          <span className="caret">{open ? "▾" : "▸"}</span> {sets.length}{" "}
                          {sets.length === 1 ? "set" : "sets"} · top <b>{top}kg</b>
                        </span>
                        <span className="date">{fmtDay(day)}</span>
                      </button>
                      {open && (
                        <div className="setlist">
                          {ordered.map((s) => (
                            <button key={s.date} className="setline num" onClick={() => setEditing(s)}>
                              <span className="setno">SET {s.setNo}</span>
                              <span>
                                <b>{s.weight}</b>kg × {s.reps}
                              </span>
                              <span className="edit-hint">edit</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}

      <div className="bottombar">
        <button className="btn btn-primary" onClick={logSet}>
          <IconCheck size={22} /> Log Set {todaySets.length + 1}
        </button>
      </div>

      {editing && (
        <LogEditSheet
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(w, r) => {
            updateLog(editing.date, { weight: w, reps: r });
            setEditing(null);
            toast("Updated");
          }}
          onDelete={() => {
            deleteLog(editing.date);
            setEditing(null);
            toast("Set deleted");
          }}
        />
      )}
    </div>
  );
}
