/**
 * Transactions — every payment from all four sources, filtered, with a live total.
 *
 * The totals strip is computed from exactly the rows shown, so a filter can never
 * show one number in the table and another on top.
 */
import { useMemo, useState } from "react";
import type { Ledger, Row, Source, Status, TagNode } from "./api";
import { DatePicker, inPick, pickLabel, type Pick } from "./DatePicker";
import { chain, dayLabel, isIn, makeTree, monthOf, namesOf, rs, SOURCES, todayIso, totals, tripTag, within } from "./lib";
import { TagEditor } from "./TagEditor";

const STATUS: Record<Status, string> = { proven: "Proven", confirmed: "Confirmed by you", needs: "Needs you" };
const NEEDS = "\u0000needs";

export function Transactions({ data, params, reload }: { data: Ledger; params: URLSearchParams; reload: () => Promise<void> }) {
  const newest = data.rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const pm = params.get("month");
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<Set<Source>>(new Set(params.get("source") ? [params.get("source") as Source] : []));
  const tree = useMemo(() => makeTree(data.tags), [data]);
  // Where you are in the tag tree: null = all, "needs" = not tagged yet. "?tag=food" opens a top tag.
  const [at, setAt] = useState<string | null>(() => {
    const p = params.get("tag");
    if (p === "needs you") return NEEDS;
    return (tree.kids.get(null) ?? []).find((t) => t.name === p)?.id ?? null;
  });
  const [stat, setStat] = useState<Set<Status>>(new Set());
  const [inferredOnly, setInferredOnly] = useState(false);
  const [hideBills, setHideBills] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [limit, setLimit] = useState(300);
  const [bulk, setBulk] = useState(false);

  const anchor = newest || todayIso();
  const first = data.rows.reduce((m, r) => (r.date < m ? r.date : m), anchor).slice(0, 7);
  const last = monthOf(anchor);
  const [pick, setPick] = useState<Pick>({ kind: "months", months: [pm ?? last] });

  const nodeOf = (r: Row) => (r.status === "needs" ? null : r.tag_id ?? null);
  const atPath = at && at !== NEEDS ? namesOf(tree, at).join("/") : "";

  const qq = q.trim().toLowerCase();
  // Every filter except the tag ones, so each chip's total is what clicking it would show.
  const base = data.rows.filter((r) => {
    if (!inPick(pick, r.date, anchor)) return false;
    if (hideBills && (r.kind === "bill" || r.kind === "payment") && atPath !== "bank/card bill") return false;
    if (src.size && !src.has(r.source)) return false;
    if (stat.size && !stat.has(r.status)) return false;
    if (inferredOnly && !r.inferred) return false;
    if (qq && !`${r.desc ?? ""} ${r.payee} ${r.text} ${r.tags.join(" ")} ${(r.details ?? []).join(" ")}`.toLowerCase().includes(qq)) return false;
    return true;
  });
  // A tag's total includes every tag below it.
  const sums = sumBy(base, (r) => {
    const n = nodeOf(r);
    return n ? chain(tree, n).map((x) => x.id) : [NEEDS];
  });
  const direct = at && at !== NEEDS ? sumBy(base.filter((r) => nodeOf(r) === at), () => "x").get("x") : undefined;
  // The top tags always show; each picked tag opens a row of its own children below.
  const path = at && at !== NEEDS ? chain(tree, at) : [];
  const onPath = new Set(path.map((x) => x.id));
  const chipsOf = (parent: string | null) => (tree.kids.get(parent) ?? []).filter((k) => sums.has(k.id) || onPath.has(k.id))
    .map((k) => [k.id, k.name] as const)
    .sort((a, b) => (sums.get(b[0])?.amt ?? 0) - (sums.get(a[0])?.amt ?? 0));
  const levels = [
    { parent: null as TagNode | null, chips: [...chipsOf(null), ...(sums.has(NEEDS) || at === NEEDS ? [[NEEDS, "needs you"] as const] : [])] },
    ...path.map((x) => ({ parent: x, chips: chipsOf(x.id) })).filter((l) => l.chips.length),
  ];
  // Clicking the picked tag again closes it and goes back to its parent.
  const pickTag = (id: string) => setAt(id === at ? (id === NEEDS ? null : tree.byId.get(id)?.parent_id ?? null)
    : id);
  const inside = at && at !== NEEDS ? within(tree, at) : null;

  const rows = base.filter((r) => {
    if (at === NEEDS) return nodeOf(r) === null;
    if (inside) { const n = nodeOf(r); return !!n && inside.has(n); }
    return true;
  });
  const t = totals(rows);
  const filtered = !!(qq || src.size || at || stat.size || inferredOnly);
  const flip = <T,>(set: Set<T>, v: T, put: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    put(n);
  };
  const rangeText = pickLabel(pick, first, last);

  return (
    <main className="stack">
      <section className="panel filters">
        <div className="row">
          <label className="sr" htmlFor="q">Search</label>
          <input id="q" className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search shop, description or tag. Try: swiggy, uber, rent" />
          <DatePicker value={pick} onChange={setPick} first={first} last={last} />
        </div>
        <div className="row">
          <span className="lbl">Paid by</span>
          {(Object.keys(SOURCES) as Source[]).map((s) => (
            <button key={s} className="chip" aria-pressed={src.has(s)} onClick={() => flip(src, s, setSrc)}>
              <span className="sq" style={{ background: SOURCES[s].color }} />{SOURCES[s].short}
            </button>
          ))}
        </div>
        {levels.map((l, i) => (
          <div key={l.parent?.id ?? "top"} className={`row ${i ? "taglevel" : ""}`}>
            <span className="lbl">{i ? "" : "Tag"}</span>
            {i > 0 && <span className="lvlname">{l.parent!.name} ›</span>}
            {l.chips.map(([id, name]) => (
              <button key={id} className={`chip ${i ? "sub" : ""}`} aria-pressed={id === at || onPath.has(id)} onClick={() => pickTag(id)}>
                {name}<ChipAmt sum={sums.get(id)} />
              </button>
            ))}
            {i === levels.length - 1 && i > 0 && direct && direct.amt >= 1 && (
              <span className="muted small">{rs(direct.amt)} is on {path[path.length - 1].name} itself</span>
            )}
          </div>
        ))}
        <div className="row">
          <span className="lbl">Status</span>
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <button key={s} className="chip" aria-pressed={stat.has(s)} onClick={() => flip(stat, s, setStat)}>{STATUS[s]}</button>
          ))}
          <button className="chip" aria-pressed={inferredOnly} onClick={() => setInferredOnly(!inferredOnly)}>From ride pattern</button>
          {filtered && (
            <button className="linkbtn" onClick={() => { setQ(""); setSrc(new Set()); setAt(null); setStat(new Set()); setInferredOnly(false); }}>
              Clear filters
            </button>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={hideBills} onChange={(e) => setHideBills(e.target.checked)} />
          <span>Hide card bill payments. Each card purchase is already a row, so a bill would count it twice.</span>
        </label>
      </section>

      <div className="kpis">
        <div className="panel kpi dark">
          <h2>Spent in these rows</h2>
          <div className="kpi-v">{rs(t.spent)}</div>
          <div className="kpi-sub">{rangeText}{filtered ? ", filtered" : ""}{hideBills ? " · card bills hidden" : ""}</div>
        </div>
        <div className="panel kpi">
          <h2>Money in</h2>
          <div className="kpi-v in">{rs(t.inn)}</div>
          <div className="kpi-sub">Salary, interest, refunds</div>
        </div>
        <div className="panel kpi">
          <h2>Rows</h2>
          <div className="kpi-v">{rows.length}</div>
          <div className="kpi-sub">Newest first{t.fxOnly ? ` · ${t.fxOnly} in foreign money not in the total yet` : ""}</div>
        </div>
        <div className="panel kpi alarm">
          <h2>Not sure yet</h2>
          <div className="kpi-v">{rs(t.needs)}</div>
          <div className="kpi-sub">{t.needsN ? `${t.needsN} of these rows are not tagged yet` : "Every row here is tagged"}</div>
        </div>
      </div>

      {(() => {
        const open = rows.filter((r) => r.status === "needs" && r.kind !== "payment");
        if (!open.length || open.length > 500) return null;
        return (
          <section className="panel bulk">
            {!bulk ? (
              <div className="between">
                <span><b>{open.length}</b> rows here need you ({rs(open.reduce((a, r) => a - (r.amount ?? 0), 0))}). Filter them down, then tag them all at once.</span>
                <button className="btn-ghost" onClick={() => setBulk(true)}>Tag all {open.length} shown</button>
              </div>
            ) : (
              <TagEditor rowIds={open.map((r) => r.id)} payee="each of these payees" tags={data.tags} alwaysDefault={false}
                onSaved={async () => { setBulk(false); await reload(); }} onCancel={() => setBulk(false)} />
            )}
          </section>
        );
      })()}

      <section className="panel table">
        <div className="trow thead">
          <span>Date</span><span>Paid by</span><span>What it was</span><span>Tags</span><span>Status</span><span className="right">Amount</span>
        </div>
        {rows.slice(0, limit).map((r) => (
          <RowView key={r.id} r={r} tags={data.tags} open={open === r.id} editing={editing === r.id}
            toggle={() => { setOpen(open === r.id ? null : r.id); setEditing(null); }}
            edit={() => setEditing(r.id)} done={async () => { setEditing(null); await reload(); }} />
        ))}
        {!rows.length && <div className="empty">No rows match. Try fewer filters.</div>}
        {rows.length > limit && (
          <button className="linkbtn more" onClick={() => setLimit(limit + 500)}>Show {Math.min(500, rows.length - limit)} more of {rows.length - limit}</button>
        )}
      </section>
    </main>
  );
}

type Sum = { amt: number; isIn: boolean };

/** Spend per group; a group with no spend (salary, interest) shows its money in instead. A row with several keys counts in each. */
function sumBy(rows: Row[], key: (r: Row) => string | string[]): Map<string, Sum> {
  const g = new Map<string, Row[]>();
  for (const r of rows) for (const k of [key(r)].flat()) g.set(k, [...(g.get(k) ?? []), r]);
  return new Map([...g].map(([k, rs]) => {
    const t = totals(rs);
    return [k, t.spent > 0 ? { amt: t.spent, isIn: false } : { amt: t.inn, isIn: t.inn > 0 }];
  }));
}

function ChipAmt({ sum }: { sum?: Sum }) {
  if (!sum || sum.amt < 1) return null;
  return <span className={`chip-amt ${sum.isIn ? "in" : ""}`}>{sum.isIn ? "+" : ""}{rs(sum.amt)}</span>;
}

function RowView({ r, tags, open, editing, toggle, edit, done }: {
  r: Row; tags: Ledger["tags"]; open: boolean; editing: boolean; toggle: () => void; edit: () => void; done: () => Promise<void>;
}) {
  const muted = r.kind === "bill" || r.kind === "payment";
  const amt = r.amount === null ? r.fx ?? "?" : `${r.amount > 0 ? "+" : ""}${rs(r.amount, true)}`;
  return (
    <div className="tr">
      <button className="trow" onClick={toggle} aria-expanded={open}>
        <span className="mono dim">{dayLabel(r.date)}{r.time ? <><br /><small>{r.time}</small></> : null}</span>
        <span className="src"><span className="sq" style={{ background: SOURCES[r.source].color }} />{SOURCES[r.source].short}</span>
        <span className="what">
          <span className={`desc ${r.status === "needs" ? "needs" : ""}`}>{r.desc ?? (r.status === "needs" ? `Who is this? ${r.payee}` : r.payee)}</span>
          <span className="raw">{r.text}</span>
        </span>
        <span className="tags">{r.tags.map((t, i) => <span key={i} className={`pill ${i ? "sub" : ""}`}>{i ? `› ${t}` : t}</span>)}</span>
        <span className="status">
          <span className={`st ${r.status}`}>{STATUS[r.status]}</span>
          {!r.final && <span className="nf">not final</span>}
          {r.inferred && <span className="nf">from pattern</span>}
        </span>
        <span className={`right mono amt ${r.amount !== null && isIn(r) ? "in" : muted ? "dim" : ""}`}>{amt}</span>
      </button>
      {open && (
        <div className="why">
          {!editing ? (
            <>
              <div className="grow">
                <div><b>Why:</b> {r.why}</div>
                {!!r.details?.length && <ul className="details">{r.details.map((d) => <li key={d}>{d}</li>)}</ul>}
              </div>
              <button className="btn-ghost" onClick={edit}>{r.status === "needs" ? "Tag it" : "Change tag"}</button>
            </>
          ) : (
            <TagEditor rowIds={[r.id]} payee={r.payee} tags={tags} startAt={tripTag(tags, r.trip_label)}
              initialTagId={r.status === "needs" ? null : r.tag_id}
              initialDesc={r.desc} alwaysDefault={false} onSaved={() => void done()} onCancel={toggle} />
          )}
        </div>
      )}
    </div>
  );
}
