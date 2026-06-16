/**
 * PipelineBoard.tsx — Admin pipeline view as a row-per-topic matrix table.
 * Columns: Topic | Readiness | Script | Tutorial | Editing | Upload | Published
 * Each topic row shows its pipeline stage via done checks, an active pill, or pending dots.
 */

import { useState } from "react";
import type { Row } from "../shared/rbac";
import { displayName } from "./api";
import {
  overallStage,
  stageState,
  isStalled,
  isStuck,
  daysSince,
  assigneeFor,
  OVERALL_STAGES,
  type OverallStage,
} from "./pipeline";
import { LANE_LABELS } from "./labels";
import type { AdminFilters } from "./Filters";

// ── Stage metadata — 5 stages ─────────────────────────────────────────────────

interface StageMeta {
  /** "Readiness" is a display-only first stage backed by topic_status; the rest are real OverallStages. */
  stage: OverallStage | "Readiness";
  /** The row field that holds this stage's raw status string */
  statusField: keyof Row & string;
  solid: string;
  bg: string;
  border: string;
  laneKey: string;
}

const STAGE_META: StageMeta[] = [
  {
    stage:       "Readiness",
    statusField: "topic_status",
    solid:       "var(--todo)",
    bg:          "var(--todo-t)",
    border:      "var(--todo-b)",
    laneKey:     "topic_status",
  },
  {
    stage:       "Script",
    statusField: "script_status",
    solid:       "var(--t3, #64748b)",
    bg:          "rgba(100,116,139,0.08)",
    border:      "rgba(100,116,139,0.22)",
    laneKey:     "script_status",
  },
  {
    stage:       "Tutorial",
    statusField: "tutorial_status",
    solid:       "var(--prog)",
    bg:          "var(--prog-t)",
    border:      "var(--prog-b)",
    laneKey:     "tutorial_status",
  },
  {
    stage:       "Editing",
    statusField: "video_editor_status",
    solid:       "var(--review)",
    bg:          "var(--review-t)",
    border:      "var(--review-b)",
    laneKey:     "video_editor_status",
  },
  {
    stage:       "Upload",
    statusField: "yt_upload_status",
    solid:       "var(--warn)",
    bg:          "rgba(230,184,96,0.10)",
    border:      "rgba(230,184,96,0.28)",
    laneKey:     "yt_upload_status",
  },
  {
    stage:       "Published",
    statusField: "yt_upload_status",
    solid:       "var(--done)",
    bg:          "var(--done-t)",
    border:      "var(--done-b)",
    laneKey:     "",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Friendly label for a raw status value, falling back to the raw value. */
function friendlyStatus(laneKey: string, raw: string): string {
  if (!raw) return "";
  return LANE_LABELS[laneKey]?.[raw] ?? raw;
}

/**
 * Determine this stage's state for the given row:
 *   - "done"    if this stage is completed
 *   - "active"  if this stage is where the topic currently lives
 *   - "pending" if the topic hasn't reached this stage yet
 */
function stageCellState(
  row: Row,
  stageMeta: StageMeta,
): "done" | "active" | "pending" {
  // Readiness is the topic stage: "Ready" → done, anything else set → still drafting, blank → not started.
  if (stageMeta.stage === "Readiness") {
    const ts = ((row as Record<string, string>).topic_status ?? "").trim();
    if (ts === "Ready") return "done";
    return ts ? "active" : "pending";
  }

  const overall = overallStage(row as Record<string, string>);
  const stageIdx = OVERALL_STAGES.indexOf(stageMeta.stage);
  const overallIdx = OVERALL_STAGES.indexOf(overall);

  if (stageMeta.stage === "Published") {
    return (row as Record<string, string>).yt_upload_status === "Published"
      ? "done"
      : "pending";
  }

  if (stageIdx < overallIdx) return "done";
  if (stageIdx === overallIdx) {
    const raw = (row as Record<string, string>)[stageMeta.statusField] ?? "";
    // A topic still being drafted hasn't entered this stage yet, so it has no
    // status set — show the pending dot instead of an empty pill.
    if (!raw.trim()) return "pending";
    const s = stageState(raw);
    return s === "done" ? "done" : "active";
  }
  return "pending";
}

// ── Stage cell ────────────────────────────────────────────────────────────────

interface StageCellProps {
  row: Row;
  meta: StageMeta;
}

function StageCell({ row, meta }: StageCellProps) {
  const state = stageCellState(row, meta);

  if (state === "done") {
    return (
      <td className="ptable__cell ptable__cell--done">
        <span className="ptable__check" title={`${meta.stage}: done`}>✓</span>
      </td>
    );
  }

  if (state === "pending") {
    return (
      <td className="ptable__cell ptable__cell--pending">
        <span className="ptable__cross" title={`${meta.stage}: not started`}>✕</span>
      </td>
    );
  }

  // active — show the status pill
  const rawStatus =
    meta.stage === "Published"
      ? "Published"
      : (row as Record<string, string>)[meta.statusField] ?? "";
  const label = meta.stage === "Published"
    ? "Published"
    : friendlyStatus(meta.laneKey, rawStatus) || rawStatus;

  const stalled = isStalled(row as Record<string, string>);
  const stuck = isStuck(row as Record<string, string>);
  const d = stuck ? daysSince((row as Record<string, string>).last_updated) : null;

  return (
    <td className="ptable__cell ptable__cell--active">
      <div className="ptable__active-wrap">
        <span
          className="ptable__pill"
          style={{
            color: meta.solid,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          {label}
        </span>
        {stalled && (
          <span className="ptable__badge ptable__badge--stalled" title="Sent back for rework">
            ↩ sent back
          </span>
        )}
        {stuck && !stalled && d !== null && (
          <span
            className="ptable__badge ptable__badge--stuck"
            title={`No update in ${d} days`}
          >
            ⚠ {d}d
          </span>
        )}
      </div>
    </td>
  );
}

// ── Topic cell ────────────────────────────────────────────────────────────────

interface TopicCellProps {
  row: Row;
  names: Record<string, string>;
}

function TopicCell({ row, names }: TopicCellProps) {
  const title = (row as Record<string, string>).video_title || "(no title)";
  const cat = (row as Record<string, string>).category ?? "";
  const sub = (row as Record<string, string>).subcategory ?? "";
  const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;

  // Current assignee depends on overall stage
  const overall = overallStage(row as Record<string, string>);
  let assigneeEmail = "";
  if (overall === "Script") {
    assigneeEmail = assigneeFor(row as Record<string, string>, "Script Writer");
  } else if (overall === "Tutorial") {
    assigneeEmail = assigneeFor(row as Record<string, string>, "Tutorial Maker");
  } else if (overall === "Editing") {
    assigneeEmail = assigneeFor(row as Record<string, string>, "Video Editor");
  } else {
    // Upload / Published: reviewer
    assigneeEmail = (row as Record<string, string>).reviewer_email ?? "";
  }
  const name = assigneeEmail ? displayName(assigneeEmail, names) : "";

  return (
    <td className="ptable__topic">
      <div className="ptable__topic-title">{title}</div>
      {catLabel && <div className="ptable__topic-cat">{catLabel}</div>}
      {name && <div className="ptable__topic-assignee">{name}</div>}
    </td>
  );
}

// ── Sorting ─────────────────────────────────────────────────────────────────
// Columns are sortable by click. "Topic" sorts alphabetically by title; every
// stage column sorts by how far that stage has progressed (done > active > pending).

const TOPIC_COL = "Topic";
type SortState = { col: string; dir: "asc" | "desc" };

function sortValue(row: Row, col: string): string | number {
  if (col === TOPIC_COL) return ((row as Record<string, string>).video_title ?? "").toLowerCase();
  const meta = STAGE_META.find(m => m.stage === col);
  if (!meta) return "";
  const s = stageCellState(row, meta);
  return s === "done" ? 2 : s === "active" ? 1 : 0;
}

function compareRows(a: Row, b: Row, sort: SortState): number {
  const va = sortValue(a, sort.col);
  const vb = sortValue(b, sort.col);
  let cmp =
    typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va).localeCompare(String(vb));
  if (cmp === 0) {
    // Stable tiebreak by title so equal-state rows keep a predictable order.
    cmp = ((a as Record<string, string>).video_title ?? "")
      .toLowerCase()
      .localeCompare(((b as Record<string, string>).video_title ?? "").toLowerCase());
  }
  return sort.dir === "asc" ? cmp : -cmp;
}

// ── PipelineBoard (matrix table) ──────────────────────────────────────────────

interface PipelineBoardProps {
  rows: Row[];
  names: Record<string, string>;
  filters: AdminFilters;
  onOpen: (row: Row) => void;
  /** Admin-only: show a per-row delete button. */
  canDelete?: boolean;
  onDelete?: (rowId: string, title: string) => void;
}

export function PipelineBoard({ rows, names, filters, onOpen, canDelete, onDelete }: PipelineBoardProps) {
  const [sort, setSort] = useState<SortState | null>(null);

  // Clicking a header sorts by that column; clicking the active one flips direction.
  // First click on Topic goes A→Z; first click on a stage shows the most-complete rows first.
  function toggleSort(col: string) {
    setSort(prev =>
      prev?.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === TOPIC_COL ? "asc" : "desc" },
    );
  }

  // Apply filters
  const filtered = rows.filter(row => {
    if (filters.stage && overallStage(row as Record<string, string>) !== filters.stage) return false;
    if (filters.assignee) {
      const sw = ((row as Record<string, string>).script_writer_email ?? "").trim().toLowerCase();
      const tm = ((row as Record<string, string>).tutorial_maker_email ?? "").trim().toLowerCase();
      const ve = ((row as Record<string, string>).video_editor_email ?? "").trim().toLowerCase();
      if (sw !== filters.assignee && tm !== filters.assignee && ve !== filters.assignee) return false;
    }
    if (filters.category) {
      if (((row as Record<string, string>).category ?? "") !== filters.category) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="ptable-wrap">
        <div className="ptable-empty">No videos match these filters.</div>
      </div>
    );
  }

  const sorted = sort ? [...filtered].sort((a, b) => compareRows(a, b, sort)) : filtered;

  const caret = (col: string) =>
    sort?.col === col ? (
      <span className="ptable__sort-caret">{sort.dir === "asc" ? "▲" : "▼"}</span>
    ) : null;
  const ariaSort = (col: string): "ascending" | "descending" | "none" =>
    sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div className="ptable-wrap">
      <table className="ptable">
        <thead>
          <tr className="ptable__header-row">
            <th
              className="ptable__th ptable__th--topic ptable__th--sortable"
              onClick={() => toggleSort(TOPIC_COL)}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(TOPIC_COL); }
              }}
              role="columnheader"
              aria-sort={ariaSort(TOPIC_COL)}
            >
              Topic{caret(TOPIC_COL)}
            </th>
            {STAGE_META.map(meta => (
              <th
                key={meta.stage}
                className="ptable__th ptable__th--stage ptable__th--sortable"
                style={{ color: meta.solid }}
                onClick={() => toggleSort(meta.stage)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(meta.stage); }
                }}
                role="columnheader"
                aria-sort={ariaSort(meta.stage)}
              >
                <span
                  className="ptable__th-dot"
                  style={{ background: meta.solid }}
                />
                {meta.stage}{caret(meta.stage)}
              </th>
            ))}
            {canDelete && (
              <th className="ptable__th ptable__th--actions" aria-label="Actions" />
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const id = (row as Record<string, string>).row_id ?? Math.random().toString();
            const title = (row as Record<string, string>).video_title ?? "";
            return (
              <tr
                key={id}
                className="ptable__row"
                onClick={() => onOpen(row)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") onOpen(row);
                }}
                role="button"
                aria-label={`Open ${title || "topic"}`}
              >
                <TopicCell row={row} names={names} />
                {STAGE_META.map(meta => (
                  <StageCell key={meta.stage} row={row} meta={meta} />
                ))}
                {canDelete && (
                  <td className="ptable__cell ptable__cell--actions">
                    <button
                      type="button"
                      className="ptable__delete-btn"
                      title="Delete this video"
                      aria-label={`Delete ${title || id}`}
                      onClick={e => {
                        e.stopPropagation();
                        onDelete?.(id, title);
                      }}
                    >
                      🗑
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
