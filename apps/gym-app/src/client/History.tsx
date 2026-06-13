import { useEffect, useMemo, useState } from "react";
import type { LogEntry } from "../shared";
import { accentFor, IconBack, useToast } from "./ui";
import { useGym } from "./store";
import { buildSessions, fmtDuration, fmtSessionDate } from "./session";
import { LogEditSheet } from "./LogEditSheet";
import { gymLabel, gymOfId, type Gym } from "./gym";

export function WorkoutHistory({
  gym,
  onBack,
  onOpenDay,
}: {
  gym: Gym;
  onBack: () => void;
  onOpenDay: (day: string) => void;
}) {
  const { log, loadFullLog, logComplete } = useGym();
  const sessions = useMemo(
    () => buildSessions(log.filter((l) => gymOfId(l.exerciseId) === gym)),
    [log, gym],
  );

  // Pull older history (beyond the recent window) once, on demand.
  useEffect(() => {
    loadFullLog();
  }, [loadFullLog]);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">
            {gymLabel(gym)} · {sessions.length} workouts
            {!logComplete && <span style={{ color: "var(--lime)" }}> · loading older…</span>}
          </div>
          <h1 className="h1">History</h1>
        </div>
      </div>

      {sessions.length === 0 && (
        <div className="empty">
          <div className="big">No workouts yet</div>
          Log a set and it'll show up here, day by day.
        </div>
      )}

      <div className="list">
        {sessions.map((s) => {
          const accent = accentFor(s.exercises[0]?.muscleGroup || "");
          return (
            <button
              key={s.day}
              className="day-row"
              style={{ ["--accent" as string]: accent }}
              onClick={() => onOpenDay(s.day)}
            >
              <span className="day-bar" />
              <div className="day-main">
                <div className="day-date">{fmtSessionDate(s.start)}</div>
                <div className="day-sub num">
                  {s.exercises.length} exercises · {s.setCount} sets · {fmtDuration(s.durationMin)}
                </div>
              </div>
              <div className="day-chips">
                {s.exercises.slice(0, 4).map((e) => (
                  <span key={e.exerciseId} className="mini-dot" style={{ background: accentFor(e.muscleGroup) }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SessionView({
  day,
  gym,
  onBack,
}: {
  day: string;
  gym: Gym;
  onBack: () => void;
}) {
  const { log, updateLog, deleteLog } = useGym();
  const sessions = useMemo(
    () => buildSessions(log.filter((l) => gymOfId(l.exerciseId) === gym)),
    [log, gym],
  );
  const session = sessions.find((s) => s.day === day);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!session) onBack();
  }, [session, onBack]);
  if (!session) return null;

  return (
    <div className="screen">
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker num">
            {session.setCount} sets · {fmtDuration(session.durationMin)}
          </div>
          <h1 className="h1">{fmtSessionDate(session.start)}</h1>
        </div>
      </div>

      <div className="list">
        {session.exercises.map((ex, i) => {
          const accent = accentFor(ex.muscleGroup || ex.exercise);
          return (
            <div key={ex.exerciseId} className="sx-card" style={{ ["--accent" as string]: accent }}>
              <div className="sx-head">
                <span className="sx-pos num">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sx-name">{ex.exercise}</div>
                  {ex.muscleGroup && <div className="sx-mg">{ex.muscleGroup}</div>}
                </div>
              </div>
              <div className="sx-sets">
                {ex.sets.map((s) => (
                  <button key={s.date} className="sx-set num" onClick={() => setEditing(s)}>
                    <span className="sx-setno">{s.setNo}</span>
                    <b>{s.weight}</b>
                    <span className="sx-unit">kg</span>
                    <span className="sx-x">×</span>
                    {s.reps}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
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
