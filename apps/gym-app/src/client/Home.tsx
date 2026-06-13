import { useMemo, useState } from "react";
import { accentFor, IconHistory } from "./ui";
import { useGym } from "./store";
import { buildSessions, fmtDuration, todayKey } from "./session";
import { ANU_TAB, anuMuscles, GYMS, gymOfId, type Gym, type GroupSpec } from "./gym";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const GYM_KEY = "gym.currentGym";

export function Home({
  onOpen,
  onOpenHistory,
  onOpenDay,
}: {
  onOpen: (spec: GroupSpec, gym: Gym) => void;
  onOpenHistory: (gym: Gym) => void;
  onOpenDay: (day: string, gym: Gym) => void;
}) {
  const { groups, ready, syncing, log, exercisesFor } = useGym();
  const [gym, setGymState] = useState<Gym>(
    () => (localStorage.getItem(GYM_KEY) as Gym) || "main",
  );
  const setGym = (g: Gym) => {
    setGymState(g);
    localStorage.setItem(GYM_KEY, g);
  };

  const now = new Date();
  const dateline = `${DOW[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]}`;

  // Tiles for the selected gym.
  const tiles = useMemo(() => {
    if (gym === "anu") {
      const anu = exercisesFor(ANU_TAB);
      return anuMuscles(anu).map((m) => ({
        spec: { tab: ANU_TAB, label: m, muscle: m } as GroupSpec,
        count: anu.filter((e) => (e.muscleGroup || "Other") === m).length,
        accentKey: m,
      }));
    }
    return groups
      .filter((g) => g.tab !== ANU_TAB)
      .map((g) => ({
        spec: { tab: g.tab, label: g.label } as GroupSpec,
        count: g.count,
        accentKey: g.tab,
      }));
  }, [gym, groups, exercisesFor]);

  // Today's session scoped to this gym.
  const today = useMemo(() => {
    const scoped = log.filter((l) => gymOfId(l.exerciseId) === gym);
    return buildSessions(scoped).find((x) => x.day === todayKey()) ?? null;
  }, [log, gym]);

  return (
    <div className="screen">
      <div className="topbar">
        <div style={{ flex: 1 }}>
          <div className="kicker">
            {dateline}
            {syncing && <span style={{ color: "var(--lime)" }}> · syncing</span>}
          </div>
          <h1 className="h1">
            Today's <span style={{ color: "var(--lime)" }}>Lift</span>
          </h1>
        </div>
        <button className="iconbtn" onClick={() => onOpenHistory(gym)} aria-label="Workout history">
          <IconHistory size={20} />
        </button>
      </div>

      {/* Gym switcher */}
      <div className="seg">
        {GYMS.map((g) => (
          <button
            key={g.id}
            className={`seg-btn${gym === g.id ? " on" : ""}`}
            onClick={() => setGym(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {!ready && <div className="spinner" />}

      {ready && today && (
        <button className="today-card" onClick={() => onOpenDay(today.day, gym)}>
          <div className="today-head">
            <span className="today-live">
              <span className="pulse" /> TODAY
            </span>
            <span className="today-meta num">
              {today.exercises.length} ex · {today.setCount} sets · {fmtDuration(today.durationMin)}
            </span>
          </div>
          <div className="today-flow">
            {today.exercises.map((ex, i) => (
              <span key={ex.exerciseId} className="today-step">
                <span className="today-stepno num">{i + 1}</span>
                {ex.exercise}
              </span>
            ))}
          </div>
        </button>
      )}

      {ready && (
        <div className="tiles">
          {tiles.map((t) => {
            const c = accentFor(t.accentKey);
            return (
              <button
                key={t.spec.label}
                className="tile"
                style={{ ["--accent" as string]: c }}
                onClick={() => onOpen(t.spec, gym)}
              >
                <span className="dot" />
                <div>
                  <div className="tname">{t.spec.label}</div>
                  <div className="tcount num">
                    {t.count} {t.count === 1 ? "move" : "moves"}
                  </div>
                </div>
                <span className="ghostnum num">{t.count}</span>
              </button>
            );
          })}
          {tiles.length === 0 && (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              <div className="big">Nothing here yet</div>
              {gym === "anu" ? "Add an Anu Gym exercise to get started." : "No exercises."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
