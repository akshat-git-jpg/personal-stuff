import { useMemo, useState } from "react";
import { accentFor, IconHistory } from "./ui";
import { useGym } from "./store";
import { buildSessions, fmtDuration, todayKey } from "./session";
import {
  GYMS,
  specGym,
  gymBadge,
  gymLabel,
    mixedMuscles,
  tabOfGym,
  type Gym,
  type GroupSpec,
} from "./gym";
import { WeekStrip } from "./WeekStrip";
import { DAY_SHORT, dayIds, todayIdx, usePlan, type DayIdx } from "./plan";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const GYM_KEY = "gym.currentGym";

export function Home({
  onOpen,
  onOpenHistory,
  onOpenDay,
  onOpenPlanDay,
}: {
  onOpen: (spec: GroupSpec, gym: Gym) => void;
  onOpenHistory: (gym: Gym) => void;
  onOpenDay: (day: string, gym: Gym) => void;
  onOpenPlanDay: (day: DayIdx, gym: Gym) => void;
}) {
  const { groups, ready, syncing, log, exercisesFor, exerciseById, setsTodayFor } =
    useGym();
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
    const mixedTab = tabOfGym(gym);
    if (mixedTab) {
      const list = exercisesFor(mixedTab);
      return mixedMuscles(list).map((m) => ({
        spec: { tab: mixedTab, label: m, muscle: m } as GroupSpec,
        count: list.filter((e) => (e.muscleGroup || "Other") === m).length,
        accentKey: m,
      }));
    }
    return groups
      .filter((g) => specGym({ tab: g.tab, label: g.label }) === "main")
      .map((g) => ({
        spec: { tab: g.tab, label: g.label } as GroupSpec,
        count: g.count,
        accentKey: g.tab,
      }));
  }, [gym, groups, exercisesFor]);

  // Today's session scoped to this gym.
  const today = useMemo(() => {
    const scoped = log.filter((l) => exerciseById(l.exerciseId)?.gym === gym);
    return buildSessions(scoped).find((x) => x.day === todayKey()) ?? null;
  }, [log, gym]);


  usePlan();
  const todayPlanIds = dayIds(todayIdx());
  const plannedToday = useMemo(
    () => todayPlanIds.map((id) => exerciseById(id)).filter((e): e is NonNullable<typeof e> => !!e),
    [todayPlanIds, exerciseById],
  );
  const doneCount = plannedToday.filter((ex) => setsTodayFor(ex.id) > 0).length;
  // If the whole day is one gym, say it once in the header instead of tagging
  // every row — the tag is only worth a row's width when a day is mixed.
  const planGyms = [...new Set(plannedToday.map((ex) => ex.gym))];
  const mixedGyms = planGyms.length > 1;
  // Anything logged today that the plan does not mention.
  const extras = (today?.exercises ?? []).filter((e) => !todayPlanIds.includes(e.exerciseId));

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

      {ready && plannedToday.length > 0 && (
        <button className="today-card" onClick={() => onOpenPlanDay(todayIdx(), gym)}>
          <div className="today-head">
            <span className="today-live">
              <span className="pulse" /> TODAY · {DAY_SHORT[todayIdx()]}
              {planGyms.length === 1 && (
                <span className="today-gym">· {gymBadge(planGyms[0])}</span>
              )}
            </span>
            <span className="today-meta num">
              {doneCount}/{plannedToday.length} done
              {today ? ` · ${today.setCount} sets · ${fmtDuration(today.durationMin)}` : ""}
            </span>
          </div>
          <div className="plan-ticks">
            {plannedToday.map((ex) => {
              const n = setsTodayFor(ex.id);
              return (
                <span key={ex.id} className={`plan-tick${n > 0 ? " done" : ""}`}>
                  <i className="tickbox">{n > 0 ? "✓" : ""}</i>
                  <span className="plan-tick-name">{ex.name}</span>
                  {mixedGyms && (
                    <span className={`tag tag-${ex.gym}`}>
                      {gymBadge(ex.gym)}
                    </span>
                  )}
                  {ex.setsReps && <em className="num">{ex.setsReps}</em>}
                </span>
              );
            })}
            {extras.map((e) => (
              <span key={e.exerciseId} className="plan-tick extra">
                <i className="tickbox">+</i>
                <span className="plan-tick-name">{e.exercise}</span>
                {mixedGyms && (
                  <span className={`tag tag-${exerciseById(e.exerciseId)?.gym ?? "main"}`}>
                    {gymBadge(exerciseById(e.exerciseId)?.gym ?? "main")}
                  </span>
                )}
              </span>
            ))}
          </div>
        </button>
      )}

      {ready && plannedToday.length === 0 && today && (
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

      {ready && <WeekStrip onOpenDay={(d) => onOpenPlanDay(d, gym)} />}

      {ready && (
        <div className="section-h">Muscle groups</div>
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
              {gym === "main"
                ? "No exercises."
                : `Add a ${gymLabel(gym)} exercise to get started.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
