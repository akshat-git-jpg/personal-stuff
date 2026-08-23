import type { HabitToday } from "../shared";

interface Props {
  habits: HabitToday[];
  todayLabel: string;
  /** Fired on tick/untick; the parent calls the API and reloads. */
  onToggle: (h: HabitToday) => void;
  /** Template ids with a toggle in flight — their rows are disabled. */
  busy: ReadonlySet<number>;
}

/** The rhythm board: one line per active habit, both owners together, above the
 *  task list. A habit is never a task — this strip is the only place they live,
 *  and a missed day shows as a reset streak, not as an overdue item. */
export function HabitStrip({ habits, todayLabel, onToggle, busy }: Props) {
  if (habits.length === 0) return null;

  return (
    <section className="habit-strip" aria-label="Today's habits">
      <div className="habit-strip-head">
        <span className="kicker">Today</span>
        <span className="habit-date">{todayLabel}</span>
      </div>
      {habits.map((h) => (
        <div className={`habit-row ${h.keptNow ? "kept" : ""}`} key={h.templateId}>
          <input
            className="check"
            type="checkbox"
            checked={h.keptNow}
            disabled={busy.has(h.templateId)}
            onChange={() => onToggle(h)}
            aria-label={h.keptNow ? `un-tick ${h.title}` : `tick ${h.title}`}
          />
          <span className="habit-title" title={h.title}>{h.title}</span>
          <span className="habit-who">{h.owner[0].toUpperCase()}</span>
          <span className={`streak ${h.streak > 0 ? "live" : "cold"}`}>
            {h.streak > 0 ? `${h.streak}${h.cadence === "weekly" ? "w" : "d"}` : "—"}
          </span>
          <span className="habit-best">best {h.best}</span>
        </div>
      ))}
    </section>
  );
}
