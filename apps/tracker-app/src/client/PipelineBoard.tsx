/**
 * PipelineBoard.tsx — admin row-per-topic matrix. One column per pipeline stage
 * (derived from STAGES); each cell shows done ✓ / an active status pill / pending ✕.
 */
import { useState } from "react";
import type { Row } from "../shared/rbac";
import { statusOf, type StageDef, type PipelineDef } from "./stages";
import { displayName } from "./api";
import { statusMeta } from "./status";
import {
  stageStepState, activeAssigneeEmail,
} from "./pipeline";
import { rowMatchesFilters, type AdminFilters } from "./Filters";

function StageCell({ row, pipeline, stage }: { row: Row; pipeline: PipelineDef; stage: StageDef }) {
  const r = row as Record<string, string>;
  const state = stageStepState(pipeline, stage, r);
  if (state === "done") {
    return <td className="ptable__cell ptable__cell--done"><span className="ptable__check" title={`${stage.label}: done`}>✓</span></td>;
  }
  if (state === "pending") {
    return <td className="ptable__cell ptable__cell--pending"><span className="ptable__cross" title={`${stage.label}: not started`}>✕</span></td>;
  }
  const status = statusOf(stage, r);
  const meta = statusMeta(status);
  return (
    <td className="ptable__cell ptable__cell--active">
      <div className="ptable__active-wrap">
        <span className={`pill pill--${meta.tone}`}>{meta.label}</span>
      </div>
    </td>
  );
}

function TopicCell({ row, names }: { row: Row; names: Record<string, string> }) {
  const r = row as Record<string, string>;
  const title = r.video_title || "(no title)";
  const cat = r.category ?? "";
  const sub = r.subcategory ?? "";
  const catLabel = cat && sub ? `${cat} · ${sub}` : cat || sub;
  const email = activeAssigneeEmail(r);
  const name = email ? displayName(email, names) : "";
  return (
    <td className="ptable__topic">
      <div className="ptable__topic-title">{title}</div>
      {catLabel && <div className="ptable__topic-cat">{catLabel}</div>}
      {name && <div className="ptable__topic-assignee">{name}</div>}
    </td>
  );
}

const TOPIC_COL = "__topic__";
type SortState = { col: string; dir: "asc" | "desc" };

function sortValue(row: Row, col: string, pipeline: PipelineDef): string | number {
  const r = row as Record<string, string>;
  if (col === TOPIC_COL) return (r.video_title ?? "").toLowerCase();
  const stage = pipeline.stages.find((s) => s.id === col);
  if (!stage) return "";
  const s = stageStepState(pipeline, stage, r);
  return s === "done" ? 2 : s === "active" ? 1 : 0;
}

function compareRows(a: Row, b: Row, sort: SortState, pipeline: PipelineDef): number {
  const va = sortValue(a, sort.col, pipeline), vb = sortValue(b, sort.col, pipeline);
  let cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
  if (cmp === 0) {
    cmp = ((a as Record<string, string>).video_title ?? "").toLowerCase()
      .localeCompare(((b as Record<string, string>).video_title ?? "").toLowerCase());
  }
  return sort.dir === "asc" ? cmp : -cmp;
}

interface PipelineBoardProps {
  rows: Row[];
  pipeline: PipelineDef;   // the selected video type — drives the stage columns + row filter
  names: Record<string, string>;
  filters: AdminFilters;
  onOpen: (row: Row) => void;
  canDelete?: boolean;
  onDelete?: (rowId: string, title: string) => void;
}

export function PipelineBoard({ rows, pipeline, names, filters, onOpen, canDelete, onDelete }: PipelineBoardProps) {
  const [sort, setSort] = useState<SortState | null>(null);

  function toggleSort(col: string) {
    setSort((prev) => prev?.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: col === TOPIC_COL ? "asc" : "desc" });
  }

  // Only this video type's cards; then the admin filters.
  const filtered = rows.filter((r) => (r as Record<string, string>).pipeline === pipeline.id && rowMatchesFilters(r, filters));
  if (filtered.length === 0) {
    return <div className="ptable-wrap"><div className="ptable-empty">No videos match these filters.</div></div>;
  }
  const sorted = sort ? [...filtered].sort((a, b) => compareRows(a, b, sort, pipeline)) : filtered;

  const caret = (col: string) => sort?.col === col ? <span className="ptable__sort-caret">{sort.dir === "asc" ? "▲" : "▼"}</span> : null;
  const ariaSort = (col: string): "ascending" | "descending" | "none" =>
    sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div className="ptable-wrap">
      <table className="ptable">
        <thead>
          <tr className="ptable__header-row">
            <th className="ptable__th ptable__th--topic ptable__th--sortable" role="columnheader"
              aria-sort={ariaSort(TOPIC_COL)} tabIndex={0} onClick={() => toggleSort(TOPIC_COL)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(TOPIC_COL); } }}>
              Topic{caret(TOPIC_COL)}
            </th>
            {pipeline.stages.map((stage) => (
              <th key={stage.id} className="ptable__th ptable__th--stage ptable__th--sortable" role="columnheader"
                aria-sort={ariaSort(stage.id)} tabIndex={0} onClick={() => toggleSort(stage.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSort(stage.id); } }}>
                {stage.label}{caret(stage.id)}
              </th>
            ))}
            {canDelete && <th className="ptable__th ptable__th--actions" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const id = (row as Record<string, string>).row_id ?? "";
            const title = (row as Record<string, string>).video_title ?? "";
            return (
              <tr key={id || title} className="ptable__row" role="button" tabIndex={0}
                aria-label={`Open ${title || "topic"}`} onClick={() => onOpen(row)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(row); }}>
                <TopicCell row={row} names={names} />
                {pipeline.stages.map((stage) => <StageCell key={stage.id} row={row} pipeline={pipeline} stage={stage} />)}
                {canDelete && (
                  <td className="ptable__cell ptable__cell--actions">
                    <button type="button" className="ptable__delete-btn" title="Delete this video"
                      aria-label={`Delete ${title || id}`}
                      onClick={(e) => { e.stopPropagation(); onDelete?.(id, title); }}>🗑</button>
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
