import type { OwnerScore, Scoreboard as ScoreboardData } from "../shared";

export function Scoreboard({ data }: { data: ScoreboardData }) {
  return (
    <div className="scoreboard">
      <ScoreCard score={data.khushi} label="Khushi" />
      <ScoreCard score={data.kushal} label="Kushal" />
    </div>
  );
}

/** On-time record over tasks that *had* a deadline. No-deadline done tasks are
 *  ignored (not scored, not penalized). Both people shown equally — no winner. */
function ScoreCard({ score, label }: { score: OwnerScore; label: string }) {
  const { scored, onTime, late, avgDaysLate, onTimePct } = score;
  const hasData = onTimePct !== null;
  const onPctWidth = scored ? (onTime / scored) * 100 : 0;

  return (
    <div className="scorecard">
      <div className="who">{label}</div>
      <div className={`pct ${hasData ? "" : "none"}`}>
        {hasData ? <>{onTimePct}<span className="sym">%</span></> : "—"}
      </div>

      {hasData ? (
        <>
          <div className="ratio">
            {onTime} <span className="lbl">of {scored} on time</span>
          </div>
          <div className="splitbar" aria-hidden>
            <i className="on" style={{ width: `${onPctWidth}%` }} />
            <i className="lt" style={{ width: `${100 - onPctWidth}%` }} />
          </div>
          <div className="foot">
            {late > 0 ? <>{late} late · <span className="late">avg {avgDaysLate}d over</span></> : "all on time"}
          </div>
        </>
      ) : (
        <>
          <div className="ratio"><span className="lbl">no dated tasks done yet</span></div>
          <div className="splitbar" aria-hidden><i className="on" style={{ width: "0%" }} /></div>
          <div className="foot" />
        </>
      )}
    </div>
  );
}
