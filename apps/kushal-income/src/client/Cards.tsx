/**
 * Credit cards — one card at a time: its statement as a sum, the tally checks,
 * the rows since the statement (not final), and past statements.
 */
import { useState } from "react";
import type { Ledger, Row, Statement } from "./api";
import { dayLabel, mainTag, rs, SOURCES } from "./lib";

type Card = Statement["source"];
const CARDS: Card[] = ["sbic", "neu", "icici"];

export function Cards({ data }: { data: Ledger }) {
  const [card, setCard] = useState<Card>("sbic");
  const stmts = data.statements.filter((s) => s.source === card).sort((a, b) => b.period_to.localeCompare(a.period_to));
  const [pick, setPick] = useState<string | null>(null);
  const s = stmts.find((x) => x.id === pick) ?? stmts[0];

  const pending = data.rows.filter((r) => r.source === card && !r.final);
  const inStmt = s ? data.rows.filter((r) => r.stmt === s.id) : [];
  const byTag = new Map<string, number>();
  for (const r of inStmt) if (r.kind === "spend" && r.amount !== null) byTag.set(mainTag(r), (byTag.get(mainTag(r)) ?? 0) - r.amount);
  const tags = [...byTag.entries()].sort((a, b) => b[1] - a[1]);
  const tmax = tags.length ? tags[0][1] : 1;

  return (
    <main className="stack">
      <div className="cards">
        {CARDS.map((c) => {
          const since = data.rows.filter((r) => r.source === c && !r.final && r.amount !== null)
            .reduce((a, r) => a - (r.amount ?? 0), 0);
          return (
            <button key={c} className="panel cardpick" aria-pressed={c === card} onClick={() => { setCard(c); setPick(null); }}>
              <span className="cardname"><span className="sq big" style={{ background: SOURCES[c].color }} />{SOURCES[c].label}</span>
              <span className="cardsub"><span className="muted">Spent since last statement</span><span className="num big">{rs(since)}</span></span>
            </button>
          );
        })}
      </div>

      {!s ? <div className="panel empty">No statement for this card yet.</div> : (
        <>
          <div className="grid-3">
            <section className="panel span-2">
              <div className="head">
                <h2>Statement · {dayLabel(s.period_from)} – {dayLabel(s.period_to)} {s.period_to.slice(0, 4)}</h2>
                <span className="muted">Due {dayLabel(s.due_date)}</span>
              </div>
              <div className="equation">
                {([["Previous balance", s.prev, "+"], ["Purchases", s.purchases, "+"], ["Fees", s.fees, "−"],
                   ["Payments + refunds", s.payments, "="], ["Total due", s.due, ""]] as const).map(([l, v, op], i) => (
                  <div key={l} className="eq">
                    <div className={`eqbox ${i === 4 ? "total" : ""}`}><span className="muted small">{l}</span><span className="num">{rs(v, true)}</span></div>
                    {op && <span className="op">{op}</span>}
                  </div>
                ))}
              </div>
              <div className="muted small">Previous balance + purchases + fees − payments = total due. Checked for every statement.</div>
            </section>
            <section className="panel">
              <h2>Tally checks</h2>
              {s.checks.map((k) => (
                <div key={k.text} className="check-row">
                  <span className={`tick ${k.ok ? "ok" : k.wait ? "wait" : "warn"}`} aria-hidden>{k.ok ? "✓" : k.wait ? "…" : "!"}</span>
                  <span><span>{k.text}</span><br /><span className="muted small">{k.sub}</span></span>
                </div>
              ))}
            </section>
          </div>

          <div className="grid-3">
            <section className="panel span-2 table">
              {s === stmts[0] && (
                <>
                  <div className="band gold">
                    <span>Since last statement · not final yet</span>
                    <span className="small">From purchase emails. The next statement replaces these rows.</span>
                  </div>
                  {pending.map((r) => <MiniRow key={r.id} r={r} />)}
                  {!pending.length && <div className="empty small">Nothing since the last statement.</div>}
                </>
              )}
              <div className="band">In this statement · {s.rows} rows</div>
              {inStmt.map((r) => <MiniRow key={r.id} r={r} />)}
              <a className="linkbtn more" href={`#/transactions?source=${card}`}>See all {SOURCES[card].short} rows in Transactions →</a>
            </section>

            <div className="stack">
              <section className="panel">
                <h2>By tag · this statement</h2>
                {tags.map(([t, v]) => (
                  <div key={t} className="minibar">
                    <div className="between"><span>{t}</span><span className="num">{rs(v)}</span></div>
                    <div className="bar"><i className={t === "needs you" ? "hatch" : ""} style={{ width: `${(v / tmax) * 100}%`, background: t === "needs you" ? undefined : SOURCES[card].color }} /></div>
                  </div>
                ))}
              </section>
              <section className="panel">
                <h2>Statements</h2>
                {stmts.map((x) => (
                  <button key={x.id} className="hist" aria-pressed={x.id === s.id} onClick={() => setPick(x.id)}>
                    <span className={`tick ${x.paid ? "ok" : "wait"}`} aria-hidden>{x.paid ? "✓" : "…"}</span>
                    <span className="grow"><span className="strong">{dayLabel(x.period_from)} – {dayLabel(x.period_to)} {x.period_to.slice(2, 4)}</span><br />
                      <span className="muted small">{x.paid ? (x.paid.date ? `${x.paid.note}, ${dayLabel(x.paid.date)}` : x.paid.note) : "Not paid yet"}</span></span>
                    <span className="num">{rs(x.due)}</span>
                  </button>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function MiniRow({ r }: { r: Row }) {
  return (
    <div className="minirow">
      <span className="mono dim">{dayLabel(r.date)}</span>
      <span className="what">
        <span className={`desc ${r.status === "needs" ? "needs" : ""}`}>{r.desc ?? (r.status === "needs" ? `Who is this? ${r.payee}` : r.payee)}</span>
        <span className="raw">{r.text}</span>
      </span>
      <span className="tags">{r.tags.map((t) => <span key={t} className="pill">{t}</span>)}</span>
      <span className={`right mono amt ${r.amount !== null && r.amount > 0 ? "in" : ""}`}>
        {r.amount === null ? r.fx : `${r.amount > 0 ? "+" : ""}${rs(r.amount, true)}`}
      </span>
    </div>
  );
}
