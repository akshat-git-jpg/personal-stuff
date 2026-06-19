import type { OwnerScore, Scoreboard as ScoreboardData } from "../shared";

export function Scoreboard({ data }: { data: ScoreboardData }) {
  const lead = computeLeader(data.khushi, data.kushal);
  return (
    <div className="scoreboard">
      <ScoreCard score={data.khushi} label="Khushi" leading={lead === "khushi"} />
      <ScoreCard score={data.kushal} label="Kushal" leading={lead === "kushal"} />
    </div>
  );
}

/** Crown the better on-time record. Someone with no scored (completed-with-ETA)
 *  tasks isn't compared, and a 0%-on-time record never "leads" — so an all-late
 *  person doesn't get crowned over someone with nothing done yet. */
function computeLeader(k: OwnerScore, u: OwnerScore): "khushi" | "kushal" | null {
  const kp = k.scored > 0 ? (k.onTimePct ?? 0) : null;
  const up = u.scored > 0 ? (u.onTimePct ?? 0) : null;
  if (kp === null && up === null) return null;
  if (kp === null) return up! > 0 ? "kushal" : null;
  if (up === null) return kp > 0 ? "khushi" : null;
  if (kp === up) return null;
  return kp > up ? "khushi" : "kushal";
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
