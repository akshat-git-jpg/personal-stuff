/**
 * Needs you — payments nothing proves, grouped by payee so one answer can tag
 * every payment to the same person. Nothing here is ever guessed or pre-filled.
 */
import { useState } from "react";
import type { Ledger, Row } from "./api";
import { inPick, type Pick } from "./DatePicker";
import { dayLabel, rs, SOURCES, tripTag } from "./lib";
import { TagEditor } from "./TagEditor";

export function Review({ data, pick, newest, setPick, reload }: {
  data: Ledger; pick: Pick; newest: string; setPick: (p: Pick) => void; reload: () => Promise<void>;
}) {
  const [later, setLater] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(15);

  const needs = data.rows.filter((r) => r.status === "needs" && r.kind !== "payment");
  const groups = new Map<string, Row[]>();
  for (const r of needs) groups.set(r.payee_key, [...(groups.get(r.payee_key) ?? []), r]);
  const list = [...groups.values()]
    .filter((g) => g.some((r) => inPick(pick, r.date, newest)))
    .filter((g) => !later.has(g[0].payee_key))
    .sort((a, b) => b[0].date.localeCompare(a[0].date));

  return (
    <main className="stack narrow">
      <div>
        <h1 className="title">{list.length ? `${list.length} payees need you` : "Nothing needs you"}</h1>
        <p className="lead">Nothing proves what these were. One answer tags every payment to that payee.</p>        <div className="months">
          {pick.kind !== "all" && groups.size > list.length + later.size && (
            <button className="linkbtn" onClick={() => setPick({ kind: "all" })}>{groups.size - list.length - later.size} more in other months. Show all time</button>
          )}
          {later.size > 0 && <button className="linkbtn" onClick={() => setLater(new Set())}>Show {later.size} skipped</button>}
        </div>
      </div>

      {list.slice(0, limit).map((g) => {
        const total = g.reduce((a, r) => a - (r.amount ?? 0), 0);
        const first = g[0];
        return (
          <section key={first.payee_key} className="panel review">
            <div className="review-left">
              <span className="num big">{rs(total, true)}</span>
              <span className="muted">{g.length === 1 ? dayLabel(first.date) : `${g.length} payments · latest ${dayLabel(first.date)}`}
                {" · "}{SOURCES[first.source].short}</span>
              <span className="raw">{first.text}</span>
              <span className="hint">{first.why}</span>
              {!!first.details?.length && <ul className="details">{first.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              {g.length > 1 && (
                <ul className="dates">
                  {g.slice(0, 6).map((r) => <li key={r.id}>{dayLabel(r.date)}{r.time ? ` ${r.time}` : ""} · {r.amount === null ? r.fx : rs(r.amount, true)}</li>)}
                  {g.length > 6 && <li>+{g.length - 6} more</li>}
                </ul>
              )}
            </div>
            <div className="review-right">
              <div className="between">
                <h2>What was it? · {first.payee}</h2>
                <button className="btn-ghost" onClick={() => setLater(new Set([...later, first.payee_key]))}>Ask me later</button>
              </div>
              <TagEditor rowIds={g.map((r) => r.id)} payee={first.payee} tags={data.tags} startAt={tripTag(data.tags, first.trip_label)}
                alwaysDefault={first.kind !== "bill" && !first.trip}
                onSaved={() => void reload()} />
            </div>
          </section>
        );
      })}
      {list.length > limit && <button className="linkbtn more" onClick={() => setLimit(limit + 15)}>Show more ({list.length - limit} left)</button>}
      {!list.length && (
        <section className="panel done">
          <span className="tick ok" aria-hidden>✓</span>
          <div><div className="strong">All caught up</div><div className="muted">Every payment in this period is proven or confirmed by you.</div></div>
        </section>
      )}
    </main>
  );
}
