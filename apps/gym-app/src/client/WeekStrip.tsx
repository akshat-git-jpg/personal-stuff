// The "This Week" section on Home: seven columns, Monday first, each showing
// how loaded that day is and which muscle groups it hits. Reads the whole week
// at a glance; tap a column to open that day.

import { useMemo } from "react";
import { accentFor } from "./ui";
import { useGym } from "./store";
import { DAY_SHORT, WEEK, muscleOf, todayIdx, usePlan, type DayIdx } from "./plan";

export function WeekStrip({ onOpenDay }: { onOpenDay: (day: DayIdx) => void }) {
  const { exerciseById } = useGym();
  const plan = usePlan();
  const today = todayIdx();

  const cols = useMemo(
    () =>
      WEEK.map((day) => {
        const exs = (plan[String(day)] ?? [])
          .map((id) => exerciseById(id))
          .filter((e): e is NonNullable<typeof e> => !!e);
        const muscles: string[] = [];
        for (const ex of exs) {
          const m = muscleOf(ex);
          if (!muscles.includes(m)) muscles.push(m);
        }
        return { day, count: exs.length, muscles };
      }),
    [plan, exerciseById],
  );

  return (
    <>
      <div className="section-h">
        This Week
        <span className="section-sub num">
          {cols.filter((c) => c.count > 0).length}/7 days
        </span>
      </div>
      <div className="week">
        {cols.map((c) => (
          <button
            key={c.day}
            className={`week-col${c.day === today ? " today" : ""}${
              c.count === 0 ? " rest" : ""
            }`}
            onClick={() => onOpenDay(c.day)}
          >
            <span className="week-dow">{DAY_SHORT[c.day]}</span>
            {c.count > 0 ? (
              <>
                <span className="week-n num">{c.count}</span>
                <span className="week-dots">
                  {c.muscles.slice(0, 3).map((m) => (
                    <i key={m} className="week-dot" style={{ background: accentFor(m) }} />
                  ))}
                  {c.muscles.length > 3 && <i className="week-dot more" />}
                </span>
              </>
            ) : (
              <span className="week-rest">–</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
