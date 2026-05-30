/**
 * Filters.tsx — Admin filter bar for Pipeline and Board views.
 * Assignee, Category, Stage filters — all client-side.
 */

import type { Row } from "../shared/rbac";
import { displayName } from "./api";
import { overallStage, OVERALL_STAGES, type OverallStage } from "./pipeline";

export interface AdminFilters {
  assignee: string;   // email (lowercase) or ""
  category: string;   // raw category value or ""
  stage: OverallStage | "";
}

export const EMPTY_FILTERS: AdminFilters = {
  assignee: "",
  category: "",
  stage:    "",
};

interface FiltersProps {
  rows: Row[];
  names: Record<string, string>;
  filters: AdminFilters;
  onChange: (f: AdminFilters) => void;
}

export function Filters({ rows, names, filters, onChange }: FiltersProps) {
  // Collect distinct assignees (script writer + tutorial_maker + video_editor)
  const assigneeSet = new Map<string, string>(); // email → display name
  for (const row of rows) {
    const sw = (row.script_writer_email ?? "").trim().toLowerCase();
    if (sw) assigneeSet.set(sw, displayName(sw, names));
    const tm = (row.tutorial_maker_email ?? "").trim().toLowerCase();
    if (tm) assigneeSet.set(tm, displayName(tm, names));
    const ve = (row.video_editor_email ?? "").trim().toLowerCase();
    if (ve) assigneeSet.set(ve, displayName(ve, names));
  }
  const assignees = [...assigneeSet.entries()].sort((a, b) =>
    a[1].localeCompare(b[1])
  );

  // Collect distinct categories
  const catSet = new Set<string>();
  for (const row of rows) {
    const c = (row.category ?? "").trim();
    if (c) catSet.add(c);
  }
  const categories = [...catSet].sort();

  const hasFilters =
    filters.assignee !== "" ||
    filters.category !== "" ||
    filters.stage !== "";

  // Count of filtered rows (for feedback label)
  const filteredCount = rows.filter(row => {
    if (filters.stage && overallStage(row) !== filters.stage) return false;
    if (filters.assignee) {
      const sw = (row.script_writer_email ?? "").trim().toLowerCase();
      const tm = (row.tutorial_maker_email ?? "").trim().toLowerCase();
      const ve = (row.video_editor_email ?? "").trim().toLowerCase();
      if (sw !== filters.assignee && tm !== filters.assignee && ve !== filters.assignee) return false;
    }
    if (filters.category) {
      if ((row.category ?? "") !== filters.category) return false;
    }
    return true;
  }).length;

  return (
    <div className="admin-filters">
      {/* Assignee */}
      <div className="admin-filters__group">
        <label className="admin-filters__label" htmlFor="f-assignee">
          Assignee
        </label>
        <select
          id="f-assignee"
          className="admin-filters__select"
          value={filters.assignee}
          onChange={e =>
            onChange({ ...filters, assignee: e.target.value })
          }
        >
          <option value="">All</option>
          {assignees.map(([email, name]) => (
            <option key={email} value={email}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div className="admin-filters__group">
        <label className="admin-filters__label" htmlFor="f-category">
          Category
        </label>
        <select
          id="f-category"
          className="admin-filters__select"
          value={filters.category}
          onChange={e =>
            onChange({ ...filters, category: e.target.value })
          }
        >
          <option value="">All</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Stage */}
      <div className="admin-filters__group">
        <label className="admin-filters__label" htmlFor="f-stage">
          Stage
        </label>
        <select
          id="f-stage"
          className="admin-filters__select"
          value={filters.stage}
          onChange={e =>
            onChange({ ...filters, stage: e.target.value as OverallStage | "" })
          }
        >
          <option value="">All</option>
          {OVERALL_STAGES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Count + clear */}
      <div className="admin-filters__meta">
        <span className="admin-filters__count">
          {filteredCount} / {rows.length}
        </span>
        {hasFilters && (
          <button
            className="admin-filters__clear"
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
