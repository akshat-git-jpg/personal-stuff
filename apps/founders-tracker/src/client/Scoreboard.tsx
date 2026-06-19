import type { OwnerScore, Scoreboard as ScoreboardData } from "../shared";

export function Scoreboard({ data }: { data: ScoreboardData }) {
  const lead =
    (data.khushi.onTimePct ?? -1) === (data.kushal.onTimePct ?? -1)
      ? null
      : (data.khushi.onTimePct ?? -1) > (data.kushal.onTimePct ?? -1)
        ? "khushi"
        : "kushal";
  return (
    <div className="scoreboard">
      <ScoreCard score={data.khushi} label="Khushi" leading={lead === "khushi"} />
      <ScoreCard score={data.kushal} label="Kushal" leading={lead === "kushal"} />
    </div>
  );
}

function ScoreCard({ score, label, leading }: { score: OwnerScore; label: string; leading: boolean }) {
  return (
    <div className={`scorecard ${leading ? "leading" : ""}`}>
      {leading && <div className="crown">👑</div>}
      <div className="pct">{score.onTimePct === null ? "—" : `${score.onTimePct}%`}</div>
      <div className="who">{label} · on time</div>
      <div className="stats">
        ✅ {score.onTime} on time · ⏰ {score.late} late<br />
        avg {score.avgDaysLate}d late<br />
        ⚠ {score.noEta} done w/o ETA
      </div>
    </div>
  );
}
