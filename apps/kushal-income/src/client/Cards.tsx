/**
 * Credit cards — what was spent on each card in the picked period, by tag and row by row,
 * plus a one-line note on that card's latest bill.
 */
import { useState } from "react";
import type { Ledger, Row, Statement } from "./api";
import { inPick, type Pick } from "./DatePicker";
import { dayLabel, isSpend, mainTag, rs, SOURCES } from "./lib";

type Card = Statement["source"];
const CARDS: Card[] = ["sbic", "neu", "icici"];

export function Cards({ data, pick, newest }: { data: Ledger; pick: Pick; newest: string }) {
  const [card, setCard] = useState<Card>("sbic");
  const spends = (c: Card) => data.rows.filter((r) => r.source === c && inPick(pick, r.date, newest) && isSpend(r));
  const sum = (rs: Row[]) => rs.reduce((a, r) => a - r.amount!, 0);

  const rows = spends(card).sort((a, b) => b.date.localeCompare(a.date));
  const byTag = new Map<string, number>();
  for (const r of rows) byTag.set(mainTag(r), (byTag.get(mainTag(r)) ?? 0) - r.amount!);
  const tags = [...byTag.entries()].sort((a, b) => b[1] - a[1]);
  const tmax = tags.length ? tags[0][1] : 1;
  const notFinal = rows.filter((r) => !r.final).length;
  const bill = data.statements.filter((s) => s.source === card).sort((a, b) => b.period_to.localeCompare(a.period_to))[0];

  return (
    <main className="stack">
      <div className="cards">
        {CARDS.map((c) => (
          <button key={c} className="panel cardpick" aria-pressed={c === card} onClick={() => setCard(c)}>
            <span className="cardname"><span className="sq big" style={{ background: SOURCES[c].color }} />{SOURCES[c].short}</span>
            <span className="cardsub"><span className="muted">Spent</span><span className="num big">{rs(sum(spends(c)))}</span></span>
          </button>
        ))}
      </div>

      {bill && (
        <div className="billnote">
          <span className={`tick ${bill.paid ? "ok" : "wait"}`} aria-hidden>{bill.paid ? "✓" : "…"}</span>
          <span>
            Latest bill {rs(bill.due, true)} for {dayLabel(bill.period_from)} – {dayLabel(bill.period_to)}, due {dayLabel(bill.due_date)}.{" "}
            <span className="muted">{bill.paid ? (bill.paid.date ? `${bill.paid.note}, ${dayLabel(bill.paid.date)}` : bill.paid.note) : "Not paid yet"}</span>
          </span>
        </div>
      )}

      <div className="grid-3">
        <section className="panel span-2 table">
          {rows.map((r) => <MiniRow key={r.id} r={r} />)}
          {!rows.length && <div className="empty">Nothing spent on this card in this period.</div>}
          {notFinal > 0 && <div className="muted small pad">{notFinal} rows marked "not final" come from purchase emails. The next statement confirms them.</div>}
        </section>
        <section className="panel">
          <h2>By tag</h2>
          {!tags.length && <div className="muted">Nothing yet.</div>}
          {tags.map(([t, v]) => (
            <a key={t} className="minibar" href={`#/transactions?tag=${encodeURIComponent(t)}&source=${card}`}>
              <div className="between"><span>{t}</span><span className="num">{rs(v)}</span></div>
              <div className="bar"><i className={t === "needs you" ? "hatch" : ""} style={{ width: `${(v / tmax) * 100}%`, background: t === "needs you" ? undefined : SOURCES[card].color }} /></div>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}

function MiniRow({ r }: { r: Row }) {
  return (
    <div className="minirow">
      <span className="mono dim">{dayLabel(r.date)}</span>
      <span className="what">
        <span className={`desc ${r.status === "needs" ? "needs" : ""}`}>{r.desc ?? (r.status === "needs" ? `Who is this? ${r.payee}` : r.payee)}</span>
        <span className="raw">{r.text}{r.final ? "" : " · not final"}</span>
      </span>
      <span className="tags">{r.tags.map((t, i) => <span key={t} className={`pill ${i ? "sub" : ""}`}>{i ? `› ${t}` : t}</span>)}</span>
      <span className="right mono amt">{rs(r.amount!, true)}</span>
    </div>
  );
}
