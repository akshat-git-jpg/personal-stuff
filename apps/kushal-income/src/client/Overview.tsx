/**
 * Overview — the picked period at a glance: in, out, saved, what still needs you,
 * and where it went. Untagged money is never folded into a category.
 */
import type { Ledger, Row } from "./api";
import { inPick, type Pick } from "./DatePicker";
import { addDays, dayLabel, isSpend, mainTag, monthLabel, monthOf, rs, rsShort, SOURCES, totals } from "./lib";

const REGULAR = ["rent", "cook", "family", "loan", "subscription", "bills"];

/** The month before, when the pick is exactly one month. Other picks have nothing fair to compare with. */
function prevMonth(p: Pick) {
  if (p.kind !== "months" || p.months.length !== 1) return null;
  const [y, m] = p.months[0].split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function Overview({ data, pick, newest }: { data: Ledger; pick: Pick; newest: string }) {
  const rows = data.rows.filter((r) => inPick(pick, r.date, newest));
  const prevKey = prevMonth(pick);
  const prev = prevKey ? data.rows.filter((r) => monthOf(r.date) === prevKey) : [];
  const t = totals(rows);
  const pt = totals(prev);
  const saved = t.inn - t.spent;
  const loans = rows.filter((r) => r.tags[0] === "loan" && (r.amount ?? 0) > 0).reduce((a, r) => a + r.amount!, 0);

  const byTag = group(rows.filter(isSpend), mainTag);
  const prevTag = group(prev.filter(isSpend), mainTag);
  const tags = [...byTag.entries()].sort((a, b) => b[1] - a[1]);
  const max = tags.length ? tags[0][1] : 1;

  const bySrc = group<string>(rows.filter(isSpend), (r) => r.source);
  const days = daily(rows);
  const dmax = Math.max(1, ...days.map((d) => d.v));
  const regular = regulars(rows, prev);
  const vs = prevKey ? monthLabel(prevKey).slice(0, 3) : "";

  return (
    <main className="stack">
      <div className="kpis">
        <div className="panel kpi">
          <h2>Money in</h2>
          <div className="kpi-v in">{rs(t.inn)}</div>
          <div className="kpi-sub">{loans ? `Loans not counted: ${rs(loans)}` : "Salary, interest, refunds"}</div>
        </div>
        <div className="panel kpi">
          <h2>Spent</h2>
          <div className="kpi-v out">{rs(t.spent)}</div>
          <div className="kpi-sub">{prevKey && pt.spent ? `${vs} was ${rs(pt.spent)}` : "Card bills not counted twice"}</div>
        </div>
        <div className="panel kpi">
          <h2>Saved</h2>
          <div className="kpi-v">{saved < 0 ? "−" : ""}{rs(saved)}</div>
          <div className="kpi-sub">{t.inn ? `${Math.round((saved / t.inn) * 100)}% of money in` : "No money in yet"}</div>
        </div>
        <a className={`panel kpi ${t.needsN ? "alarm" : ""}`} href="#/review">
          <h2>Not tagged</h2>
          <div className="kpi-v">{t.needsN ? rs(t.needs) : "None"}</div>
          <div className="kpi-sub">{t.needsN ? `${t.needsN} payment${t.needsN > 1 ? "s" : ""}. Tag them →` : "Every payment is tagged"}</div>
        </a>
      </div>

      <div className="grid-3">
        <section className="panel span-2">
          <div className="head"><h2>Where it went</h2>{prevKey && <span className="muted">Change vs {vs}</span>}</div>
          {!tags.length && <div className="empty">No spending in this period.</div>}
          {tags.map(([tag, v]) => {
            const p = prevTag.get(tag) ?? 0;
            const d = v - p;
            return (
              <a key={tag} className="tagbar" href={`#/transactions?tag=${encodeURIComponent(tag)}`}>
                <span className="tagbar-name">{tag}</span>
                <span className="bar"><i className={tag === "needs you" ? "hatch" : ""} style={{ width: `${(v / max) * 100}%` }} /></span>
                <span className="num">{rs(v)}</span>
                <span className={`delta ${d > 0 ? "up" : ""}`}>
                  {!prevKey || tag === "needs you" ? "" : !p ? "new" : Math.abs(d) < 1 ? "same" : `${d > 0 ? "+" : "−"}${rsShort(d)}`}
                </span>
              </a>
            );
          })}
        </section>

        <div className="stack">
          <section className="panel">
            <h2>Regular payments</h2>
            {!regular.length && <div className="muted">None in this period.</div>}
            {regular.map((g) => (
              <div key={g.name} className="regular">
                <span className={`dot ${g.paid ? "done" : "due"}`} />
                <span className="grow">{g.name}</span>
                <span className="num">{rs(g.amount)}</span>
                <span className={`when ${g.paid ? "" : "due"}`}>{g.paid ? `paid ${dayLabel(g.paid)}` : "not yet"}</span>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Paid from</h2>
            <div className="srcbar">
              {Object.keys(SOURCES).map((s) => (
                <i key={s} style={{ width: `${((bySrc.get(s) ?? 0) / (t.spent || 1)) * 100}%`, background: SOURCES[s as keyof typeof SOURCES].color }} />
              ))}
            </div>
            <div className="srclist">
              {Object.entries(SOURCES).map(([s, m]) => (
                <div key={s}><span className="sq" style={{ background: m.color }} /><span className="grow">{m.short}</span><span className="num">{rs(bySrc.get(s) ?? 0)}</span></div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {days.length > 1 && days.length <= 92 && (
        <section className="panel">
          <div className="head"><h2>Spend by day</h2><span className="muted">Card bills left out</span></div>
          <div className="days">
            {days.map((d, i) => (
              <div key={d.day} className="day" title={`${dayLabel(d.day)}: ${rs(d.v)}`}>
                {d.v > dmax * 0.4 && <span className={`daylbl ${i < 3 ? "l" : i > days.length - 4 ? "r" : ""}`}>{rsShort(d.v)}</span>}
                <i style={{ height: `${Math.max(d.v ? 3 : 0, Math.sqrt(d.v / dmax) * 130)}px` }} />
              </div>
            ))}
          </div>
          <div className="axis"><span>{dayLabel(days[0].day)}</span><span>{dayLabel(days[days.length - 1].day)}</span></div>
        </section>
      )}
    </main>
  );
}

function group<K>(rows: Row[], key: (r: Row) => K) {
  const m = new Map<K, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) - (r.amount ?? 0));
  return m;
}

/** Spend per day, from the first to the last day the rows cover. */
function daily(rows: Row[]) {
  const ds = rows.map((r) => r.date).sort();
  if (!ds.length) return [];
  const v = new Map<string, number>();
  for (const r of rows) if (isSpend(r)) v.set(r.date, (v.get(r.date) ?? 0) - r.amount!);
  const out: { day: string; v: number }[] = [];
  for (let d = ds[0]; d <= ds[ds.length - 1] && out.length < 400; d = addDays(d, 1)) out.push({ day: d, v: v.get(d) ?? 0 });
  return out;
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
