// Whole week as a read-only sheet: one column per day. Click an exercise to
// highlight every day it appears on. Laptop-width view; no editing here.

import { useEffect, useMemo, useState } from "react";
import { accentFor, IconBack, IconStar } from "./ui";
import { useGym } from "./store";
import { DAY_LONG, DAY_SHORT, WEEK, isDayStarred, muscleOf, todayIdx, usePlan } from "./plan";

export function WeekGrid({ onBack }: { onBack: () => void }) {
  const { exerciseById, dayNotes } = useGym();
  const plan = usePlan();
  const today = todayIdx();
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const focus = picked ?? hover;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicked(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cols = useMemo(
    () =>
      WEEK.map((day) => ({
        day,
        items: (plan[String(day)] ?? [])
          .map((id) => exerciseById(id))
          .filter((e): e is NonNullable<typeof e> => !!e),
      })),
    [plan, exerciseById],
  );

  const pickedEx = picked ? exerciseById(picked) : undefined;
  const pickedDays = picked
    ? cols.filter((c) => c.items.some((e) => e.id === picked)).map((c) => DAY_SHORT[c.day])
    : [];

  return (
    <div className="screen grid-screen" onClick={() => setPicked(null)}>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack} aria-label="Back">
          <IconBack size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="kicker">Week grid</div>
          <h1 className="h1">All days</h1>
        </div>
        <div className="grid-pick" aria-live="polite">
          {pickedEx ? (
            <>
              <b>{pickedEx.name}</b>
              <span>
                {pickedDays.length} {pickedDays.length === 1 ? "day" : "days"} · {pickedDays.join(", ")}
              </span>
            </>
          ) : (
            <span>Click an exercise to see every day it is on</span>
          )}
        </div>
      </div>

      <div className={`wgrid${focus ? " focusing" : ""}`}>
        {cols.map((c) => (
          <section key={c.day} className={`wcol${c.day === today ? " today" : ""}`}>
            <header className="wcol-h">
              <span className="wcol-day">{DAY_LONG[c.day]}</span>
              <span className="wcol-n num">{c.items.length || "Rest"}</span>
              {dayNotes[String(c.day)] && <p className="wcol-note">{dayNotes[String(c.day)]}</p>}
            </header>
            {c.items.map((ex) => {
              const on = focus === ex.id;
              return (
                <button
                  key={ex.id}
                  className={`wcell${on ? " on" : ""}${picked === ex.id ? " locked" : ""}`}
                  style={{ ["--accent" as string]: accentFor(muscleOf(ex)) }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked((p) => (p === ex.id ? null : ex.id));
                  }}
                  onMouseEnter={() => setHover(ex.id)}
                  onMouseLeave={() => setHover(null)}
                >
                  <span className="wcell-name">{ex.name}</span>
                  <span className="wcell-meta">
                    {muscleOf(ex)}
                    {isDayStarred(c.day, ex.id) && <IconStar size={12} on />}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
