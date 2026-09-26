/**
 * Transactions — every payment from all four sources, filtered, with a live total.
 *
 * The totals strip is computed from exactly the rows shown, so a filter can never
 * show one number in the table and another on top.
 */
import { useMemo, useState } from "react";
import type { Ledger, Row, Source, Status } from "./api";
import { addDays, dayLabel, isIn, monthOf, rs, SOURCES, todayIso, totals } from "./lib";
import { TagEditor } from "./TagEditor";

type Range = "10d" | "month" | "last" | "all" | "custom";

const STATUS: Record<Status, string> = { proven: "Proven", confirmed: "Confirmed by you", needs: "Needs you" };

export function Transactions({ data, params, reload }: { data: Ledger; params: URLSearchParams; reload: () => Promise<void> }) {
  const newest = data.rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const pm = params.get("month");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range>(pm ? "custom" : "month");
  const [from, setFrom] = useState(pm ? `${pm}-01` : "");
  const [to, setTo] = useState(pm ? `${pm}-31` : "");
  const [src, setSrc] = useState<Set<Source>>(new Set(params.get("source") ? [params.get("source") as Source] : []));
  const [tags, setTags] = useState<Set<string>>(new Set(params.get("tag") ? [params.get("tag")!] : []));
  const [stat, setStat] = useState<Set<Status>>(new Set());
  const [hideBills, setHideBills] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [limit, setLimit] = useState(300);

  const today = todayIso();
  const [lo, hi] = useMemo<[string, string]>(() => {
    const cur = monthOf(newest || today);
    const [y, m] = cur.split("-").map(Number);
    const last = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
    switch (range) {
      case "10d": return [addDays(newest || today, -9), "9999"];
      case "month": return [`${cur}-01`, `${cur}-31`];
      case "last": return [`${last}-01`, `${last}-31`];
      case "custom": return [from || "0000", to || "9999"];
      default: return ["0000", "9999"];
    }
  }, [range, from, to, newest, today]);

  const tagCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of data.rows) for (const t of r.status === "needs" ? ["needs you"] : r.tags) c.set(t, (c.get(t) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [data]);

  const qq = q.trim().toLowerCase();
  const rows = data.rows.filter((r) => {
    if (r.date < lo || r.date > hi) return false;
    if (hideBills && (r.kind === "bill" || r.kind === "payment") && !tags.has("card bill")) return false;
    if (src.size && !src.has(r.source)) return false;
    if (stat.size && !stat.has(r.status)) return false;
    if (tags.size) {
      const mine = r.status === "needs" ? ["needs you"] : r.tags;
      if (!mine.some((t) => tags.has(t))) return false;
    }
    if (qq && !`${r.desc ?? ""} ${r.payee} ${r.text} ${r.tags.join(" ")}`.toLowerCase().includes(qq)) return false;
    return true;
  });
  const t = totals(rows);
  const filtered = !!(qq || src.size || tags.size || stat.size);
  const flip = <T,>(set: Set<T>, v: T, put: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    put(n);
  };
  const rangeText = range === "10d" ? "Last 10 days" : range === "month" ? "This month" : range === "last" ? "Last month"
    : range === "all" ? "All time" : `${from ? dayLabel(from) : "start"} – ${to ? dayLabel(to) : "now"}`;

  return (
    <main className="stack">
      <section className="panel filters">
        <div className="row">
          <label className="sr" htmlFor="q">Search</label>
          <input id="q" className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search shop, description or tag. Try: swiggy, uber, rent" />
          <div className="seg">
            {(["10d", "month", "last", "all", "custom"] as Range[]).map((k) => (
              <button key={k} className="mbtn" aria-pressed={range === k} onClick={() => setRange(k)}>
                {{ "10d": "Last 10 days", month: "This month", last: "Last month", all: "All", custom: "Dates…" }[k]}
              </button>
            ))}
          </div>
        </div>
        {range === "custom" && (
          <div className="row">
            <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        )}
        <div className="row">
          <span className="lbl">Paid by</span>
          {(Object.keys(SOURCES) as Source[]).map((s) => (
            <button key={s} className="chip" aria-pressed={src.has(s)} onClick={() => flip(src, s, setSrc)}>
              <span className="sq" style={{ background: SOURCES[s].color }} />{SOURCES[s].short}
            </button>
          ))}
        </div>
        <div className="row">
          <span className="lbl">Tags</span>
          {tagCounts.map((tg) => (
            <button key={tg} className="chip" aria-pressed={tags.has(tg)} onClick={() => flip(tags, tg, setTags)}>{tg}</button>
          ))}
        </div>
        <div className="row">
          <span className="lbl">Status</span>
          {(Object.keys(STATUS) as Status[]).map((s) => (
            <button key={s} className="chip" aria-pressed={stat.has(s)} onClick={() => flip(stat, s, setStat)}>{STATUS[s]}</button>
          ))}
          {filtered && (
            <button className="linkbtn" onClick={() => { setQ(""); setSrc(new Set()); setTags(new Set()); setStat(new Set()); }}>
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

      <section className="panel table">
        <div className="trow thead">
          <span>Date</span><span>Paid by</span><span>What it was</span><span>Tags</span><span>Status</span><span className="right">Amount</span>
        </div>
        {rows.slice(0, limit).map((r) => (
          <RowView key={r.id} r={r} open={open === r.id} editing={editing === r.id}
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

function RowView({ r, open, editing, toggle, edit, done }: {
  r: Row; open: boolean; editing: boolean; toggle: () => void; edit: () => void; done: () => Promise<void>;
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
        <span className="tags">{r.tags.map((t) => <span key={t} className="pill">{t}</span>)}</span>
        <span className="status">
          <span className={`st ${r.status}`}>{STATUS[r.status]}</span>
          {!r.final && <span className="nf">not final</span>}
        </span>
        <span className={`right mono amt ${r.amount !== null && isIn(r) ? "in" : muted ? "dim" : ""}`}>{amt}</span>
      </button>
      {open && (
        <div className="why">
          {!editing ? (
            <>
              <span className="grow"><b>Why:</b> {r.why}</span>
              <button className="btn-ghost" onClick={edit}>{r.status === "needs" ? "Tag it" : "Change tag"}</button>
            </>
          ) : (
            <TagEditor rowIds={[r.id]} payee={r.payee} initialTags={r.status === "needs" ? [] : r.tags}
              initialDesc={r.desc} alwaysDefault={false} onSaved={() => void done()} onCancel={toggle} />
          )}
        </div>
      )}
    </div>
  );
}
