/**
 * Overview — one month at a glance: in, out, saved, how sure, and where it went.
 *
 * "How sure" is the share of spending that is proven or confirmed by the owner.
 * Untagged money is never folded into a category; it is its own hatched bar.
 */
import { useMemo, useState } from "react";
import type { Ledger, Row } from "./api";
import { dayLabel, isSpend, mainTag, monthLabel, monthOf, rs, SOURCES, totals } from "./lib";

const REGULAR = ["rent", "cook", "family", "loan", "subscription", "bills"];

export function Overview({ data }: { data: Ledger }) {
  const months = useMemo(() => [...new Set(data.rows.map((r) => monthOf(r.date)))].sort().slice(-12), [data]);
  const [sel, setSel] = useState(months[months.length - 1]);
  const prevKey = months[months.indexOf(sel) - 1];

  const inMonth = (m: string | undefined) => data.rows.filter((r) => m && monthOf(r.date) === m);
  const rows = inMonth(sel);
  const prev = inMonth(prevKey);
  const t = totals(rows);
  const pt = totals(prev);
  const saved = t.inn - t.spent;
  const hasSalary = rows.some((r) => r.tags.includes("salary"));
  const sure = t.spent ? Math.round((1 - t.needs / t.spent) * 100) : 100;

  const byTag = group(rows.filter(isSpend), mainTag);
  const prevTag = group(prev.filter(isSpend), mainTag);
  const tags = [...byTag.entries()].sort((a, b) => b[1] - a[1]);
  const max = tags.length ? tags[0][1] : 1;

  const bySrc = group<string>(rows.filter(isSpend), (r) => r.source);
  const days = daily(rows, sel);
  const dmax = Math.max(1, ...days.map((d) => d.v));
  const regular = regulars(rows, prev);

  return (
    <main className="stack">
      <div className="months">
        {months.map((m) => (
          <button key={m} className="mbtn" aria-pressed={m === sel} onClick={() => setSel(m)}>
            {monthLabel(m).slice(0, 3)}
          </button>
        ))}
        <span className="muted">{monthLabel(sel)}</span>
      </div>

      <div className="kpis">
        <div className="panel kpi">
          <h2>Money in</h2>
          <div className="kpi-v in">{rs(t.inn)}</div>
          <div className="kpi-sub">Salary, interest, refunds</div>
        </div>
        <div className="panel kpi">
          <h2>Spent</h2>
          <div className="kpi-v out">{rs(t.spent)}</div>
          <div className="kpi-sub">All 4 sources. Card bills not counted twice</div>
        </div>
        <div className="panel kpi">
          <h2>Saved</h2>
          <div className="kpi-v">{saved < 0 ? "−" : ""}{rs(saved)}</div>
          <div className="kpi-sub">
            {!hasSalary ? "Salary not in yet: it usually lands on the last day"
              : `${Math.round((saved / t.inn) * 100)}% of money in`}
            {prevKey && pt.inn ? ` · ${monthLabel(prevKey).slice(0, 3)} was ${Math.round(((pt.inn - pt.spent) / pt.inn) * 100)}%` : ""}
          </div>
        </div>
        <a className="panel kpi alarm" href="#/review">
          <h2>How sure is this month</h2>
          <div className="kpi-v">{sure}%</div>
          <div className="kpi-sub">
            {t.needsN ? `${rs(t.needs)} in ${t.needsN} payments needs you. Tag them →` : "Every payment is proven or confirmed"}
            {t.fxOnly ? ` · ${t.fxOnly} in foreign money, counted when the statement comes` : ""}
          </div>
        </a>
      </div>

      <div className="grid-3">
        <section className="panel span-2">
          <div className="head"><h2>Where it went</h2><span className="muted">Click a tag to see its payments</span></div>
          {tags.map(([tag, v]) => {
            const p = prevTag.get(tag) ?? 0;
            const d = p ? Math.round(((v - p) / p) * 100) : null;
            return (
              <a key={tag} className="tagbar" href={`#/transactions?tag=${encodeURIComponent(tag)}&month=${sel}`}>
                <span className="tagbar-name">{tag}</span>
                <span className="bar"><i className={tag === "needs you" ? "hatch" : ""} style={{ width: `${(v / max) * 100}%` }} /></span>
                <span className="num">{rs(v)}</span>
                <span className={`delta ${d !== null && d > 0 ? "up" : ""}`}>
                  {tag === "needs you" ? "" : d === null ? (prevKey ? "new" : "") : `${d > 0 ? "+" : ""}${d}%`}
                </span>
              </a>
            );
          })}
        </section>

        <section className="panel">
          <h2>Regular payments</h2>
          {!regular.length && <div className="muted">None found yet.</div>}
          {regular.map((g) => (
            <div key={g.name} className="regular">
              <span className={`dot ${g.paid ? "done" : "due"}`} />
              <span className="grow">{g.name}</span>
              <span className="num">{rs(g.amount)}</span>
              <span className={`when ${g.paid ? "" : "due"}`}>{g.paid ? `paid ${dayLabel(g.paid)}` : "not yet"}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="panel">
        <div className="head"><h2>Spend by day</h2><span className="muted">Card bills left out</span></div>
        <div className="days">
          {days.map((d) => (
            <div key={d.day} className="day" title={`${dayLabel(d.day)}: ${rs(d.v)}`}>
              <i style={{ height: `${Math.max(d.v ? 3 : 0, Math.sqrt(d.v / dmax) * 150)}px` }} className={d.v > dmax * 0.4 ? "big" : ""} />
            </div>
          ))}
        </div>
        <div className="axis"><span>{dayLabel(days[0].day)}</span><span>{dayLabel(days[days.length - 1].day)}</span></div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Spent from each source</h2>
          <div className="srcbar">
            {Object.keys(SOURCES).map((s) => (
              <i key={s} style={{ width: `${((bySrc.get(s) ?? 0) / (t.spent || 1)) * 100}%`, background: SOURCES[s as keyof typeof SOURCES].color }} />
            ))}
          </div>
          <div className="srclist">
            {Object.entries(SOURCES).map(([s, m]) => (
              <div key={s}><span className="sq" style={{ background: m.color }} /><span className="grow">{m.label}</span><span className="num">{rs(bySrc.get(s) ?? 0)}</span></div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Is the data complete?</h2>
          {data.sources.map((s) => (
            <div key={s.source} className="srcstat">
              <span className={`tick ${s.ok ? "ok" : "warn"}`} aria-hidden>{s.ok ? "✓" : "!"}</span>
              <div className="grow">
                <div className="strong">{s.name}</div>
                <div className="muted small">{s.detail}</div>
                {s.errors.length > 0 && <div className="warn small">{s.errors.length} file(s) could not be read: {s.errors[0]}</div>}
              </div>
              {s.pending > 0 && <span className="pill gold">{s.pending} newer, not final</span>}
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function group<K>(rows: Row[], key: (r: Row) => K) {
  const m = new Map<K, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) - (r.amount ?? 0));
  return m;
}

function daily(rows: Row[], ym: string) {
  const [y, mo] = ym.split("-").map(Number);
  const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const v = new Array(n).fill(0);
  for (const r of rows) if (isSpend(r)) v[+r.date.slice(8, 10) - 1] -= r.amount!;
  return v.map((x, i) => ({ day: `${ym}-${String(i + 1).padStart(2, "0")}`, v: x }));
}

/** A regular is a payee tagged rent/cook/family/... in this month or the one before. */
function regulars(rows: Row[], prev: Row[]) {
  const key = (r: Row) => r.desc ?? r.payee;
  const pick = (rs: Row[]) => rs.filter((r) => isSpend(r) && r.status !== "needs" && r.tags.some((t) => REGULAR.includes(t)));
  const now = new Map<string, { amount: number; paid: string }>();
  for (const r of pick(rows)) {
    const g = now.get(key(r));
    now.set(key(r), { amount: (g?.amount ?? 0) - r.amount!, paid: g && g.paid > r.date ? g.paid : r.date });
  }
  const out = [...now.entries()].map(([name, g]) => ({ name, amount: g.amount, paid: g.paid as string | null }));
  for (const r of pick(prev)) {
    if (!now.has(key(r)) && !out.some((o) => o.name === key(r))) out.push({ name: key(r), amount: -r.amount!, paid: null });
  }
  return out.sort((a, b) => b.amount - a.amount).slice(0, 10);
}
