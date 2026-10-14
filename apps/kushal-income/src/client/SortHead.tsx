import type { Sort, SortKey } from "./lib";

/** A column heading that sorts the table. */
export function SortHead({ k, label, sort, onSort, right }: {
  k: SortKey; label: string; sort: Sort; onSort: (k: SortKey) => void; right?: boolean;
}) {
  const on = sort.key === k;
  return (
    <span className={right ? "right" : ""} aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button className={`sorth ${on ? "on" : ""}`} onClick={() => onSort(k)}>
        {label}<span className="sortarrow" aria-hidden>{on ? (sort.desc ? "↓" : "↑") : "↕"}</span>
      </button>
    </span>
  );
}
