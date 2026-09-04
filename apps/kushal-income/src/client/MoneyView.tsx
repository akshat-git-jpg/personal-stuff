/**
 * MoneyView — what came in, what went out, and where it went.
 *
 * Two rules this file exists to hold:
 *
 *  1. **Every category is real.** There is no catch-all bucket. `unnamed` is
 *     money no rule has matched YET, shown hatched and loud, and it is meant to
 *     shrink as the owner names payees in rules.json.
 *  2. **The chart folds by value, the list never folds.** Only six hues can be
 *     told apart at a glance, so the smallest categories share one neutral slot
 *     in the stacked chart — but they are always listed separately below, and a
 *     category that grows takes a colour back automatically.
 */
import { useEffect, useMemo, useState } from "react";
import {
  fetchMoney, UnauthorizedError,
  type MoneyResponse, type MonthMoney,
} from "./api";
import { FOLD, HATCH_CSS, HUES, ORDER } from "./palette";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const rs = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const shrt = (n: number) =>
  n === 0 ? "0"
  : n >= 100000 ? "₹" + (n / 100000).toFixed(1).replace(/\.0$/, "") + "L"
  : "₹" + Math.round(n / 1000) + "k";
const label = (key: string) => `${MONTHS[+key.slice(5, 7) - 1]}`;
const spend = (m: MonthMoney) => Object.values(m.categories).reduce((s, v) => s + v, 0);

type Tip = { x: number; y: number; head: string; hue: string | null;
             rows: [string, number][]; foot?: string };

export function MoneyView() {
  const [data, setData] = useState<MoneyResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | "all" | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    fetchMoney().then(setData).catch((e) => {
      if (!(e instanceof UnauthorizedError)) setErr(String(e));
    });
  }, []);

  const keys = useMemo(() => (data ? Object.keys(data.months).sort() : []), [data]);

  // Default to the newest month we have, not "all" — that is the month the
  // owner is living in, and it is what he opens the page to check.
  useEffect(() => {
    if (keys.length && sel === null) setSel(keys[keys.length - 1]);
  }, [keys, sel]);

  if (err) return <div className="empty">{err}</div>;
  if (!data || sel === null) return <div className="empty">Loading…</div>;
  if (!keys.length) {
    return (
      <div className="empty">
        Nothing ingested yet. Drop a statement into
        <code> pipelines/personal-finance/data/raw/ </code> and run
        <code> summarise.py</code>.
      </div>
    );
  }

  const view = sel === "all" ? keys : [sel];
  const cat = data.categories;
  const tot = (k: string, ms: string[]) =>
    ms.reduce((s, m) => s + (data.months[m].categories[k] ?? 0), 0);
  const totalIn = view.reduce((s, m) => s + data.months[m].in, 0);
  const totalOut = view.reduce((s, m) => s + spend(data.months[m]), 0);
  const net = totalIn - totalOut;
  const endBal = data.months[view[view.length - 1]].balance;

  // Order categories by their whole-period size so a hue never moves when the
  // month picker changes. Colour must follow the entity, never its rank today.
  const ranked = ORDER.filter((k) => k in cat)
    .concat(Object.keys(cat).filter((k) => !ORDER.includes(k)))
    .filter((k) => tot(k, keys) > 0)
    .sort((a, b) => tot(b, keys) - tot(a, keys));

  const hue: Record<string, string | null> = {};
  let hi = 0;
  for (const k of ranked) {
    if (k === "unnamed") { hue[k] = null; continue; }   // always hatched
    hue[k] = hi < HUES.length ? HUES[hi++] : FOLD;
  }
  const folded = ranked.filter((k) => hue[k] === FOLD && tot(k, view) > 0);
  const paint = (k: string) => (k === "unnamed" ? HATCH_CSS : hue[k] ?? FOLD);

  const at = (e: React.PointerEvent, t: Omit<Tip, "x" | "y">) =>
    setTip({ ...t, x: e.clientX, y: e.clientY });
  const hoverProps = (t: Omit<Tip, "x" | "y">) => ({
    onPointerEnter: (e: React.PointerEvent) => at(e, t),
    onPointerMove: (e: React.PointerEvent) => at(e, t),
    onPointerLeave: () => setTip(null),
  });

  return (
    <div className="mv">
      <div className="months" role="group" aria-label="Month">
        {[...keys].reverse().map((k) => (
          <button key={k} className="mbtn" aria-pressed={sel === k}
            onClick={() => setSel(k)}
            {...hoverProps({ head: `${label(k)} ${k.slice(0, 4)}`, hue: null,
              rows: [["In", data.months[k].in], ["Out", spend(data.months[k])],
                     ["Balance after", data.months[k].balance]] })}>
            {label(k)}
          </button>
        ))}
        <button className="mbtn" aria-pressed={sel === "all"} onClick={() => setSel("all")}
          {...hoverProps({ head: `All ${keys.length} months`, hue: null,
            rows: [["In", keys.reduce((s, m) => s + data.months[m].in, 0)],
                   ["Out", keys.reduce((s, m) => s + spend(data.months[m]), 0)]] })}>
          All
        </button>
      </div>

      <div className="kpis">
        <Kpi title="In" value={rs(totalIn)} tone="in" pct={totalIn / Math.max(totalIn, totalOut, 1)}
          sub={sel === "all" ? `${cat.salary?.count ?? 0} salary payments`
                             : (data.months[sel].in ? "salary" : "no salary in this window")}
          hover={hoverProps({ head: "Money in", hue: "var(--in-txt)",
            rows: view.map((m) => [label(m), data.months[m].in]) })} />
        <Kpi title="Out" value={rs(totalOut)} tone="out" pct={totalOut / Math.max(totalIn, totalOut, 1)}
          sub={`${view.reduce((s, m) => s + Object.keys(data.months[m].categories).length, 0)} categories`}
          hover={hoverProps({ head: "Money out", hue: "var(--out)",
            rows: ranked.map((k) => [cat[k].label, tot(k, view)] as [string, number])
                        .filter((r) => r[1] > 0) })} />
        <Kpi title={net < 0 ? "Short by" : "Saved"} value={(net < 0 ? "−" : "+") + rs(Math.abs(net))}
          tone={net < 0 ? "bad" : "in"} pct={Math.abs(net) / Math.max(totalIn, totalOut, 1)}
          sub={`balance ${rs(endBal)}`}
          hover={hoverProps({ head: net < 0 ? "Short by" : "Saved", hue: null,
            rows: [["In", totalIn], ["Out", totalOut], ["Difference", Math.abs(net)]],
            foot: `Balance ${rs(endBal)} at the end.` })} />
      </div>

      <section className="panel">
        <h2>In against out</h2>
        <Diverging keys={keys} data={data} sel={sel} ranked={ranked} hue={hue}
                   folded={folded} cat={cat} hoverProps={hoverProps} />
        <div className="legend">
          <span><i className="sw" style={{ background: "var(--in)" }} />In</span>
          {ranked.filter((k) => hue[k] !== FOLD).map((k) => (
            <span key={k}>
              <i className={`sw${k === "unnamed" ? " sw-q" : ""}`}
                 style={k === "unnamed" ? undefined : { background: hue[k]! }} />
              {cat[k].label}
            </span>
          ))}
          {folded.length > 0 && (
            <span><i className="sw" style={{ background: FOLD }} />
              {folded.map((k) => cat[k].label).join(", ")}</span>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Where it goes</h2>
        <div className="cats">
          {ranked.map((k) => tot(k, view)).some((v) => v > 0)
            ? ranked.filter((k) => tot(k, view) > 0)
                .sort((a, b) => tot(b, view) - tot(a, view))
                .map((k, _i, arr) => {
                  const v = tot(k, view), max = tot(arr[0], view) || 1;
                  return (
                    <div className="cat" key={k}
                      {...hoverProps({ head: cat[k].label, hue: k === "unnamed" ? null : paint(k),
                        rows: view.map((m) => [label(m), data.months[m].categories[k] ?? 0] as [string, number])
                                  .filter((r) => r[1] > 0),
                        foot: k === "unnamed" ? "Name a payee in rules.json and it leaves this list." : undefined })}>
                      <span className="cat-n">
                        <i className={`sw${k === "unnamed" ? " sw-q" : ""}`}
                           style={k === "unnamed" ? undefined : { background: paint(k) }} />
                        {cat[k].label}
                      </span>
                      <span className="track">
                        <i className="fill" style={{ width: `${Math.max((v / max) * 100, 0.7)}%`, background: paint(k) }} />
                      </span>
                      <span className="cat-v">{rs(v)}
                        <em>{((v / totalOut) * 100).toFixed(v / totalOut < 0.01 ? 1 : 0)}%</em>
                      </span>
                    </div>
                  );
                })
            : <div className="empty">No spending in this month.</div>}
        </div>
      </section>

      <section className="panel">
        <h2>Not named yet</h2>
        <div className="uc">
          <div>
            <div className="uc-big">{rs(tot("unnamed", view))}</div>
            <div className="uc-sub">
              {totalOut ? ((tot("unnamed", view) / totalOut) * 100).toFixed(0) : 0}% of money out
              {sel === "all" ? "" : ` in ${label(sel)}`}
            </div>
          </div>
          <div className="chips">
            {mergePayees(view.map((m) => data.months[m].unnamed_payees)).map(([who, amt]) => (
              <span className="chip" key={who} tabIndex={0}
                {...hoverProps({ head: who, hue: null,
                  rows: view.map((m) => [label(m),
                    (data.months[m].unnamed_payees.find((p) => p[0] === who)?.[1]) ?? 0] as [string, number])
                    .filter((r) => r[1] > 0),
                  foot: "Name it once in rules.json and it leaves this list for good." })}>
                {who} <b>{rs(amt)}</b>
              </span>
            ))}
          </div>
        </div>
      </section>

      {tip && <Tooltip tip={tip} />}
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────────── */

function Kpi({ title, value, sub, tone, pct, hover }: {
  title: string; value: string; sub: string;
  tone: "in" | "out" | "bad"; pct: number;
  hover: ReturnType<typeof Object>;
}) {
  const c = tone === "in" ? "var(--in-txt)" : tone === "out" ? "var(--out)" : "var(--alarm)";
  return (
    <div className="panel kpi" {...hover}>
      <h2>{title}</h2>
      <div className="kpi-v" style={{ color: c }}>{value}</div>
      <div className="kpi-bar"><i style={{ width: `${Math.min(pct * 100, 100)}%`, background: c }} /></div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

/** Income above the line, spending stacked below it. One axis, one unit — a
 *  second y-scale here could be made to tell any story you like. */
function Diverging({ keys, data, sel, ranked, hue, folded, cat, hoverProps }: {
  keys: string[]; data: MoneyResponse; sel: string;
  ranked: string[]; hue: Record<string, string | null>; folded: string[];
  cat: MoneyResponse["categories"];
  hoverProps: (t: Omit<Tip, "x" | "y">) => object;
}) {
  const W = 940, H = 340, P = { t: 26, r: 16, b: 34, l: 64 };
  const pw = W - P.l - P.r, ph = H - P.t - P.b;
  const top = Math.max(...keys.map((k) => data.months[k].in), 1);
  const bot = Math.max(...keys.map((k) => spend(data.months[k])), 1);
  const span = top + bot, zero = P.t + (top / span) * ph;
  const y = (v: number) => zero - (v / span) * ph;
  const band = pw / keys.length, bw = Math.min(64, band * 0.48);
  const step = 100000;
  const order = ranked.filter((k) => hue[k] !== FOLD).concat(folded.length ? ["_fold"] : []);
  const val = (m: string, k: string) => k === "_fold"
    ? folded.reduce((a, f) => a + (data.months[m].categories[f] ?? 0), 0)
    : (data.months[m].categories[k] ?? 0);

  const ticks: number[] = [];
  for (let v = -Math.ceil(bot / step) * step; v <= Math.ceil(top / step) * step + 1; v += step) {
    if (y(v) >= P.t - 2 && y(v) <= P.t + ph + 2) ticks.push(v);
  }

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Money in above the line, money out below it split by category, each month">
      <defs>
        <pattern id="hx" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="var(--alarm)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--card)" strokeWidth="3" />
        </pattern>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? "zl" : "gl"} x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} />
          <text className="ax" x={P.l - 9} y={y(v) + 4} textAnchor="end">{shrt(Math.abs(v))}</text>
        </g>
      ))}
      {keys.map((m, i) => {
        const cx = P.l + band * i + band / 2, x = cx - bw / 2;
        const out = spend(data.months[m]);
        let acc = 0;
        return (
          <g key={m} opacity={sel !== "all" && sel !== m ? 0.25 : 1}>
            {data.months[m].in > 0 && (
              <>
                <rect className="seg" x={x} y={y(data.months[m].in)} width={bw}
                  height={zero - y(data.months[m].in)} rx="4" fill="var(--in)"
                  {...hoverProps({ head: `In · ${label(m)}`, hue: "var(--in)",
                    rows: [["Salary and interest", data.months[m].in]] })} />
                <text className="vlab" x={cx} y={y(data.months[m].in) - 8} textAnchor="middle"
                  fill="var(--in-txt)">{shrt(data.months[m].in)}</text>
              </>
            )}
            {order.map((k) => {
              const v = val(m, k);
              if (!v) return null;
              const y0 = zero + (acc / span) * ph, h = (v / span) * ph;
              acc += v;
              const fill = k === "_fold" ? FOLD : (hue[k] ?? "url(#hx)");
              const t = k === "_fold"
                ? { head: `Smaller categories · ${label(m)}`, hue: FOLD,
                    rows: folded.map((f) => [cat[f].label, val(m, f)] as [string, number]).filter((r) => r[1] > 0),
                    foot: "Each is under 1% here, so they share one slot. Listed separately below." }
                : { head: `${cat[k].label} · ${label(m)}`, hue: hue[k],
                    rows: [[`${((v / out) * 100).toFixed(v / out < 0.01 ? 1 : 0)}% of this month`, v] as [string, number]],
                    foot: k === "unnamed"
                      ? data.months[m].unnamed_payees.slice(0, 4).map((p) => `${p[0]} ${rs(p[1])}`).join(" · ")
                      : undefined };
              return <rect className="seg" key={k} x={x} y={y0} width={bw}
                height={Math.max(h - 1.5, 1)} fill={fill} {...hoverProps(t)} />;
            })}
            <text className="vlab" x={cx} y={zero + (out / span) * ph + 15} textAnchor="middle"
              fill="var(--out)">{shrt(out)}</text>
            <text className="axl" x={cx} y={H - 8} textAnchor="middle">{label(m)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Tooltip({ tip }: { tip: Tip }) {
  const w = 280, h = 40 + tip.rows.length * 20 + (tip.foot ? 30 : 0);
  const x = tip.x + w + 20 > window.innerWidth ? tip.x - w - 14 : tip.x + 14;
  const yy = tip.y + h + 20 > window.innerHeight ? tip.y - h - 14 : tip.y + 14;
  return (
    <div className="tt" style={{ left: x, top: yy }} role="tooltip">
      <div className="tt-h">
        {tip.hue !== null && <i className="sw" style={{ background: tip.hue }} />}
        {tip.hue === null && tip.head !== "Money in" && <i className="sw sw-q" />}
        {tip.head}
      </div>
      {tip.rows.map(([k, v]) => (
        <div className="tt-r" key={k}><span>{k}</span><b>{rs(v)}</b></div>
      ))}
      {tip.foot && <div className="tt-f">{tip.foot}</div>}
    </div>
  );
}

/** One payee can appear in several months; show it once, summed. */
function mergePayees(lists: [string, number][][]): [string, number][] {
  const acc: Record<string, number> = {};
  for (const l of lists) for (const [k, v] of l) acc[k] = (acc[k] ?? 0) + v;
  return Object.entries(acc).sort((a, b) => b[1] - a[1]);
}
