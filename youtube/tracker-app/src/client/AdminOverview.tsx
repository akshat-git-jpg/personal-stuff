/**
 * AdminOverview.tsx — Landing dashboard for the Admin view.
 * Shows pipeline funnel stats, "Needs you" panel, and per-person workload.
 */

import type { Row } from "../shared/rbac";
import { displayName } from "./api";
import {
  overallStage,
  isStalled,
  isStuck,
  daysSince,
  OVERALL_STAGES,
  type OverallStage,
} from "./pipeline";

// Stage color mapping — 5 stages
const STAGE_COLORS: Record<OverallStage, { solid: string; bg: string; border: string }> = {
  Script:    { solid: "var(--t3, #64748b)",    bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.22)" },
  Tutorial:  { solid: "var(--prog)",   bg: "var(--prog-t)",   border: "var(--prog-b)"   },
  Editing:   { solid: "var(--review)", bg: "var(--review-t)", border: "var(--review-b)" },
  Upload:    { solid: "var(--warn)",   bg: "rgba(230,184,96,0.10)", border: "rgba(230,184,96,0.28)" },
  Published: { solid: "var(--done)",   bg: "var(--done-t)",   border: "var(--done-b)"   },
};

interface AdminOverviewProps {
  rows: Row[];
  names: Record<string, string>;
  awaitingCount: number;
  /** Jump to Pipeline tab, optionally pre-filtered to a stage */
  onGoPipeline: (stage?: OverallStage) => void;
  /** Open the Awaiting queue tab */
  onGoAwaiting: () => void;
  /** Open a specific card detail */
  onOpenRow: (row: Row) => void;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  count: number;
  color: { solid: string; bg: string; border: string };
  sub?: { label: string; count: number }[];
  onClick: () => void;
}

function StatCard({ label, count, color, sub, onClick }: StatCardProps) {
  return (
    <button
      className="ov-stat-card"
      style={{
        background: color.bg,
        borderColor: color.border,
        cursor: "pointer",
      }}
      onClick={onClick}
      type="button"
    >
      <div className="ov-stat-card__bar" style={{ background: color.solid }} />
      <div className="ov-stat-card__count" style={{ color: color.solid }}>
        {count}
      </div>
      <div className="ov-stat-card__label">{label}</div>
      {sub && sub.length > 0 && (
        <div className="ov-stat-card__sub">
          {sub.map(s => (
            <span key={s.label} className="ov-stat-card__sub-item">
              {s.label} <b style={{ color: color.solid }}>{s.count}</b>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Work bar (per-person) ─────────────────────────────────────────────────────

interface WorkBarProps {
  name: string;
  email: string;
  scriptOpen: number;
  tutorialOpen: number;
  editOpen: number;
}

function WorkBar({ name, scriptOpen, tutorialOpen, editOpen }: WorkBarProps) {
  const total = scriptOpen + tutorialOpen + editOpen;
  return (
    <div className="ov-workbar">
      <div className="ov-workbar__name">{name}</div>
      <div className="ov-workbar__counts">
        {scriptOpen > 0 && (
          <span className="ov-workbar__tag ov-workbar__tag--script">
            Script ×{scriptOpen}
          </span>
        )}
        {tutorialOpen > 0 && (
          <span className="ov-workbar__tag ov-workbar__tag--tutorial">
            Recording ×{tutorialOpen}
          </span>
        )}
        {editOpen > 0 && (
          <span className="ov-workbar__tag ov-workbar__tag--edit">
            Edit ×{editOpen}
          </span>
        )}
        {total === 0 && <span className="ov-workbar__idle">No open items</span>}
      </div>
      {total > 0 && (
        <div className="ov-workbar__bar-bg">
          {scriptOpen > 0 && (
            <div
              className="ov-workbar__bar-fill ov-workbar__bar-fill--script"
              style={{ width: `${Math.min(100, (scriptOpen / Math.max(1, total)) * 100)}%` }}
            />
          )}
          {tutorialOpen > 0 && (
            <div
              className="ov-workbar__bar-fill ov-workbar__bar-fill--tutorial"
              style={{ width: `${Math.min(100, (tutorialOpen / Math.max(1, total)) * 100)}%` }}
            />
          )}
          {editOpen > 0 && (
            <div
              className="ov-workbar__bar-fill ov-workbar__bar-fill--edit"
              style={{ width: `${Math.min(100, (editOpen / Math.max(1, total)) * 100)}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Concern row (stalled/stuck item) ─────────────────────────────────────────

interface ConcernProps {
  row: Row;
  names: Record<string, string>;
  kind: "stalled" | "stuck";
  onOpen: (row: Row) => void;
}

function ConcernItem({ row, names, kind, onOpen }: ConcernProps) {
  const title = row.video_title || "(no title)";
  const d = daysSince(row.last_updated);
  const why =
    kind === "stalled"
      ? "Sent back for rework"
      : d !== null
      ? `No update in ${d} day${d === 1 ? "" : "s"}`
      : "No recent update";

  // Find who is currently working on it
  const assignee =
    row.script_status === "In Progress"
      ? displayName(row.script_writer_email ?? "", names)
      : row.tutorial_status === "In Progress"
      ? displayName(row.tutorial_maker_email ?? "", names)
      : row.video_editor_status === "In Progress"
      ? displayName(row.video_editor_email ?? "", names)
      : "";

  return (
    <button
      className="ov-concern-item"
      onClick={() => onOpen(row)}
      type="button"
    >
      <div className="ov-concern-item__title">{title}</div>
      <div className="ov-concern-item__meta">
        {assignee && <span className="ov-concern-item__who">{assignee}</span>}
        <span
          className={`ov-concern-item__why ov-concern-item__why--${kind}`}
        >
          {kind === "stalled" ? "↩" : "⏸"} {why}
        </span>
      </div>
    </button>
  );
}

// ── AdminOverview ─────────────────────────────────────────────────────────────

export function AdminOverview({
  rows,
  names,
  awaitingCount,
  onGoPipeline,
  onGoAwaiting,
  onOpenRow,
}: AdminOverviewProps) {
  // Compute stage counts
  const stageCounts = Object.fromEntries(
    OVERALL_STAGES.map(s => [s, 0])
  ) as Record<OverallStage, number>;
  for (const row of rows) {
    stageCounts[overallStage(row)]++;
  }

  // Finer breakdown for Script, Tutorial, Editing stages
  const scriptDoing  = rows.filter(r => r.script_status === "In Progress" && overallStage(r) === "Script").length;
  const scriptReview = rows.filter(r => r.script_status === "In Review"   && overallStage(r) === "Script").length;
  const tutDoing     = rows.filter(r => r.tutorial_status === "In Progress" && overallStage(r) === "Tutorial").length;
  const tutReview    = rows.filter(r => r.tutorial_status === "In Review"   && overallStage(r) === "Tutorial").length;
  const editDoing    = rows.filter(r => r.video_editor_status === "In Progress" && overallStage(r) === "Editing").length;
  const editReview   = rows.filter(r => r.video_editor_status === "In Review"   && overallStage(r) === "Editing").length;

  // Stalled + stuck
  const stalledRows = rows.filter(isStalled);
  const stuckRows = rows.filter(isStuck);

  // Worst few to show inline (top 3 each, deduplicated by preference for stalled)
  const stalledIds = new Set(stalledRows.map(r => r.row_id));
  const stuckNotStalled = stuckRows.filter(r => !stalledIds.has(r.row_id));
  const concerns = [
    ...stalledRows.slice(0, 3).map(r => ({ row: r, kind: "stalled" as const })),
    ...stuckNotStalled.slice(0, 3).map(r => ({ row: r, kind: "stuck" as const })),
  ].slice(0, 5);

  // Per-person workload: script writer, tutorial maker, video editor
  const personStats: Record<
    string,
    { name: string; email: string; scriptOpen: number; tutorialOpen: number; editOpen: number }
  > = {};

  function getOrCreate(email: string) {
    const key = email.trim().toLowerCase();
    if (!personStats[key]) {
      personStats[key] = {
        name: displayName(key, names),
        email: key,
        scriptOpen: 0,
        tutorialOpen: 0,
        editOpen: 0,
      };
    }
    return personStats[key];
  }

  for (const row of rows) {
    const swEmail = (row.script_writer_email ?? "").trim().toLowerCase();
    if (swEmail) {
      const p = getOrCreate(swEmail);
      if (row.script_status !== "Done") p.scriptOpen++;
    }

    const tmEmail = (row.tutorial_maker_email ?? "").trim().toLowerCase();
    if (tmEmail) {
      const p = getOrCreate(tmEmail);
      // Open for tutorial maker = script done AND tutorial not done
      if (row.script_status === "Done" && row.tutorial_status !== "Done") p.tutorialOpen++;
    }

    const veEmail = (row.video_editor_email ?? "").trim().toLowerCase();
    if (veEmail) {
      const p = getOrCreate(veEmail);
      // Open for editor = tutorial done AND video_editor not done
      if (row.tutorial_status === "Done" && row.video_editor_status !== "Done") p.editOpen++;
    }
  }

  const people = Object.values(personStats).sort(
    (a, b) => (b.scriptOpen + b.tutorialOpen + b.editOpen) - (a.scriptOpen + a.tutorialOpen + a.editOpen)
  );

  return (
    <div className="admin-overview">
      {/* ── Pipeline funnel ── */}
      <section className="ov-section">
        <h3 className="ov-section__title">Pipeline</h3>
        <div className="ov-stat-strip">
          <StatCard
            label="Script"
            count={stageCounts.Script}
            color={STAGE_COLORS.Script}
            sub={[
              { label: "Doing",     count: scriptDoing  },
              { label: "In review", count: scriptReview },
            ]}
            onClick={() => onGoPipeline("Script")}
          />
          <StatCard
            label="Tutorial"
            count={stageCounts.Tutorial}
            color={STAGE_COLORS.Tutorial}
            sub={[
              { label: "Doing",     count: tutDoing    },
              { label: "In review", count: tutReview   },
            ]}
            onClick={() => onGoPipeline("Tutorial")}
          />
          <StatCard
            label="Editing"
            count={stageCounts.Editing}
            color={STAGE_COLORS.Editing}
            sub={[
              { label: "Doing",     count: editDoing  },
              { label: "In review", count: editReview },
            ]}
            onClick={() => onGoPipeline("Editing")}
          />
          <StatCard
            label="Upload"
            count={stageCounts.Upload}
            color={STAGE_COLORS.Upload}
            onClick={() => onGoPipeline("Upload")}
          />
          <StatCard
            label="Published"
            count={stageCounts.Published}
            color={STAGE_COLORS.Published}
            onClick={() => onGoPipeline("Published")}
          />
        </div>
      </section>

      {/* ── Needs you ── */}
      <section className="ov-section">
        <h3 className="ov-section__title">Needs your attention</h3>
        <div className="ov-needs">
          {/* Awaiting approval */}
          <button
            className="ov-needs-chip ov-needs-chip--review"
            onClick={onGoAwaiting}
            type="button"
          >
            <span className="ov-needs-chip__count">{awaitingCount}</span>
            <span className="ov-needs-chip__label">
              {awaitingCount === 1 ? "item" : "items"} awaiting approval
            </span>
            <span className="ov-needs-chip__arrow">→</span>
          </button>

          {/* Stalled */}
          <button
            className="ov-needs-chip ov-needs-chip--warn"
            onClick={() => onGoPipeline()}
            type="button"
          >
            <span className="ov-needs-chip__count">{stalledRows.length}</span>
            <span className="ov-needs-chip__label">
              {stalledRows.length === 1 ? "video" : "videos"} sent back / stalled
            </span>
          </button>

          {/* Stuck */}
          <button
            className="ov-needs-chip ov-needs-chip--stuck"
            onClick={() => onGoPipeline()}
            type="button"
          >
            <span className="ov-needs-chip__count">{stuckRows.length}</span>
            <span className="ov-needs-chip__label">
              {stuckRows.length === 1 ? "video" : "videos"} stuck (&gt;3 days no update)
            </span>
          </button>
        </div>

        {/* Worst concerns inline */}
        {concerns.length > 0 && (
          <div className="ov-concerns">
            <div className="ov-concerns__label">Worst offenders</div>
            {concerns.map(({ row, kind }) => (
              <ConcernItem
                key={row.row_id}
                row={row}
                names={names}
                kind={kind}
                onOpen={onOpenRow}
              />
            ))}
          </div>
        )}

        {concerns.length === 0 && awaitingCount === 0 && stalledRows.length === 0 && stuckRows.length === 0 && (
          <div className="ov-clean">Pipeline is clean. Nothing needs immediate action.</div>
        )}
      </section>

      {/* ── Per-person workload ── */}
      {people.length > 0 && (
        <section className="ov-section">
          <h3 className="ov-section__title">Team workload</h3>
          <div className="ov-people">
            {people.map(p => (
              <WorkBar
                key={p.email}
                name={p.name}
                email={p.email}
                scriptOpen={p.scriptOpen}
                tutorialOpen={p.tutorialOpen}
                editOpen={p.editOpen}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
