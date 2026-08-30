/**
 * IncomeView — affiliate income by month, source and program.
 *
 * The numbers are static aggregates bundled into the Worker (see
 * scripts/sync-income.mjs). They refresh when the `yt-income` skill runs, not
 * on a Refresh click, because the bank half only exists once a passbook PDF has
 * been exported by hand.
 *
 * Two views of the same money, and they are NOT interchangeable:
 *   - "Landed"  — bank credits, by the date money hit the account. Complete:
 *                 it includes rails that never touch PayPal (Airwallex).
 *   - "Earned"  — PayPal's own attribution, by the month a program paid.
 * Same PayPal total, different months. The toggle says which one is on screen.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchIncome, UnauthorizedError, type IncomeResponse } from "./api";

/* Validated against this app's card surface (#181310) with the dataviz
   six-checks validator: all pairs clear the CVD and normal-vision floors and
   sit above 3:1 contrast. Assigned in fixed order, never cycled. */
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});
const money = (n: number) => inr.format(n);
const compactInr = (n: number) =>
  n >= 100000 ? `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1).replace(/\.0$/, "")}L`
  : n >= 1000 ? `${Math.round(n / 1000)}k`
  : String(Math.round(n));
const monthLabel = (m: string) => `${MONTHS[+m.split("-")[1] - 1]} ${m.split("-")[0]}`;
const shortMonth = (m: string) => MONTHS[+m.split("-")[1] - 1];

type Mode = "landed" | "earned";
type Tip = { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[]; total?: string };

/** Everything the charts need, derived once from the response. */
interface IncomeModel {
  railIds: string[];
  months: string[];
  landedFor: (m: string, r: string) => number;
  landedTotal: (m: string) => number;
  /** PayPal's earned-month totals in INR, keyed "YYYY-MM". */
  earned: Map<string, number>;
  total: number;
  railTotal: (r: string) => number;
  excluded: number;
  best: string;
  programs: [string, number][];
  colorOf: (r: string) => string;
}

export function IncomeView() {
  const [data, setData] = useState<IncomeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("landed");
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let alive = true;
    fetchIncome()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof UnauthorizedError ? "Session expired — reload." : String(e.message ?? e));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const model = useMemo((): IncomeModel | null => {
    if (!data) return null;
    const railIds = Object.keys(data.rails);
    const months = Object.keys(data.bank_by_month).sort();

    const landedFor = (m: string, r: string) => data.bank_by_month[m]?.[r] ?? 0;
    const landedTotal = (m: string) => railIds.reduce((s, r) => s + landedFor(m, r), 0);

    /* PayPal's earned-month view, keyed the same way so the chart can swap. */
    const earned = new Map<string, number>();
    for (const pm of data.paypal?.months ?? []) {
      earned.set(pm.month, parseFloat(pm.bank_amount || "0"));
    }

    const byProgram = new Map<string, number>();
    for (const pm of data.paypal?.months ?? []) {
      for (const p of pm.programs ?? []) {
        const v = parseFloat(p.bank_amount || "0");
        if (v > 0) byProgram.set(p.program, (byProgram.get(p.program) ?? 0) + v);
      }
    }

    const total = months.reduce((s, m) => s + landedTotal(m), 0);
    const railTotal = (r: string) => months.reduce((s, m) => s + landedFor(m, r), 0);
    const excluded = months.reduce(
      (s, m) => s + Object.entries(data.bank_by_month[m])
        .filter(([k]) => !railIds.includes(k))
        .reduce((a, [, v]) => a + v, 0),
      0,
    );
    const best = months.reduce((a, b) => (landedTotal(b) > landedTotal(a) ? b : a), months[0] ?? "");

    return {
      railIds, months, landedFor, landedTotal, earned, total, railTotal, excluded, best,
      programs: [...byProgram.entries()].sort((a, b) => b[1] - a[1]),
      colorOf: (r: string) => SERIES[railIds.indexOf(r) % SERIES.length],
    };
  }, [data]);

  if (loading) return <div className="empty">Loading income…</div>;
  if (error) return <div className="banner-error">{error}</div>;
  if (!model || model.months.length === 0) {
    return (
      <div className="empty">
        <p className="empty-title">No income ingested yet</p>
        <p>
          Run the <code>yt-income</code> skill with a passbook PDF to fill this in.
        </p>
      </div>
    );
  }

  const { railIds, months, landedTotal, total, railTotal, excluded, best, programs, colorOf } = model;
  const avg = total / months.length;

  return (
    <div className="income" onMouseLeave={() => setTip(null)}>
      <section className="summary income-summary">
        <div className="stat stat-accent">
          <div className="stat-value">{money(total)}</div>
          <div className="stat-label">Real income · {months.length} months</div>
        </div>
        {railIds.map((r) => (
          <div className="stat" key={r}>
            <div className="stat-value">
              <span className="income-dot" style={{ background: colorOf(r) }} />
              {money(railTotal(r))}
            </div>
            <div className="stat-label">
              {data!.rails[r]} · {total ? Math.round((railTotal(r) / total) * 100) : 0}%
            </div>
          </div>
        ))}
        <div className="stat">
          <div className="stat-value">{money(avg)}</div>
          <div className="stat-label">Average a month</div>
        </div>
      </section>

      <div className="income-panel">
        <div className="income-head">
          <div>
            <h2 className="income-title">How income is progressing</h2>
            <p className="income-note">
              {mode === "landed"
                ? "Every rupee, by the date it reached the bank."
                : "PayPal only, by the month each program paid. Airwallex has no earned-date, so it is not in this view."}
            </p>
          </div>
          <div className="sort-row">
            <button className={`chip ${mode === "landed" ? "chip-on" : ""}`} onClick={() => setMode("landed")}>
              Landed in bank
            </button>
            <button className={`chip ${mode === "earned" ? "chip-on" : ""}`} onClick={() => setMode("earned")}>
              PayPal earned
            </button>
          </div>
        </div>

        <div className="income-legend">
          {mode === "landed"
            ? railIds.map((r) => (
                <span key={r}>
                  <span className="income-dot" style={{ background: colorOf(r) }} />
                  {data!.rails[r]}
                </span>
              ))
            : <span><span className="income-dot" style={{ background: SERIES[0] }} />PayPal</span>}
        </div>

        <TrendChart model={model} mode={mode} rails={data!.rails} onTip={setTip} />
      </div>

      <div className="income-panel">
        <div className="income-head">
          <div>
            <h2 className="income-title">Which tools paid</h2>
            <p className="income-note">PayPal programs, by rupees settled to the bank.</p>
          </div>
        </div>
        {programs.length === 0 ? (
          <p className="income-note">
            No PayPal program data. Re-run ingest with <code>--with-paypal</code>.
          </p>
        ) : (
          <ProgramChart programs={programs} onTip={setTip} />
        )}
      </div>

      <div className="income-panel">
        <table className="income-table">
          <caption>Every month, every source. Same numbers as the chart.</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {railIds.map((r) => <th scope="col" key={r}>{data!.rails[r]}</th>)}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m} className={m === best ? "income-best" : ""}>
                <th scope="row">{monthLabel(m)}</th>
                {railIds.map((r) => (
                  <td key={r}>{model.landedFor(m, r) ? money(model.landedFor(m, r)) : "—"}</td>
                ))}
                <td className="income-strong">{money(landedTotal(m))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>All months</td>
              {railIds.map((r) => <td key={r}>{money(railTotal(r))}</td>)}
              <td className="income-strong">{money(total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="income-note income-excluded">
          {money(excluded)} of other credits (family transfers, cash, LIC, bank interest) were
          excluded as not-income. If a real payout is hiding in there, add its pattern to{" "}
          <code>pipelines/income-analysis/rules.json</code>.
        </p>
      </div>

      <p className="income-foot">
        {data!.generated_at
          ? `Built ${new Date(data!.generated_at).toLocaleString()} from ${data!.statements.length} statement(s), ${data!.statements.reduce((s, x) => s + x.transactions, 0)} transactions.`
          : "No ingest timestamp recorded."}
      </p>

      {tip && (
        <div className="income-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <div className="income-tip-h">{tip.title}</div>
          {tip.rows.map((r, i) => (
            <div className="income-tip-r" key={i}>
              <span className="l">
                {r.color && <span className="income-dot" style={{ background: r.color }} />}
                {r.label}
              </span>
              <span className="v">{r.value}</span>
            </div>
          ))}
          {tip.total && (
            <div className="income-tip-r income-tip-tot">
              <span className="l">Total</span>
              <span className="v">{tip.total}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Trend: stacked bars + a cumulative line, so "progressing over time" is
      readable both per-month and as a running total. ─────────────────────── */
function TrendChart({
  model, mode, rails, onTip,
}: {
  model: IncomeModel;
  mode: Mode;
  rails: Record<string, string>;
  onTip: (t: Tip | null) => void;
}) {
  const { months, railIds, landedFor, landedTotal, earned, colorOf } = model;

  const valueFor = (m: string) => (mode === "landed" ? landedTotal(m) : (earned.get(m) ?? 0));
  const segsFor = (m: string) =>
    mode === "landed"
      ? railIds.map((r) => ({ id: r, label: rails[r], v: landedFor(m, r), color: colorOf(r) })).filter((s) => s.v > 0)
      : [{ id: "paypal", label: "PayPal", v: earned.get(m) ?? 0, color: SERIES[0] }].filter((s) => s.v > 0);

  const W = 960, H = 320;
  const PAD = { t: 18, r: 54, b: 36, l: 56 };
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;

  const max = Math.max(...months.map(valueFor), 1);
  const stepBase = Math.pow(10, Math.floor(Math.log10(max)));
  const ceil = Math.ceil(max / stepBase) * stepBase;
  const y = (v: number) => PAD.t + plotH - (v / ceil) * plotH;

  const band = plotW / months.length;
  const barW = Math.min(44, band * 0.5);

  // Cumulative line, on its own scale, drawn as a recessive reference — not a
  // second y-axis to read values off (that is the dual-axis trap); it only
  // shows the shape of the running total.
  let running = 0;
  const cum = months.map((m) => (running += valueFor(m)));
  const cumMax = Math.max(...cum, 1);
  const yCum = (v: number) => PAD.t + plotH - (v / cumMax) * plotH;
  const cumPath = cum
    .map((v, i) => `${i === 0 ? "M" : "L"} ${PAD.l + band * i + band / 2} ${yCum(v)}`)
    .join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ceil * f);

  return (
    <svg
      className="income-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={mode === "landed" ? "Income received each month by source" : "PayPal income by month earned"}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line className="income-grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          <text className="income-axis" x={PAD.l - 10} y={y(v) + 4} textAnchor="end">
            {compactInr(v)}
          </text>
        </g>
      ))}

      <path className="income-cum" d={cumPath} fill="none" />
      {cum.map((v, i) => (
        <circle key={i} className="income-cum-dot" cx={PAD.l + band * i + band / 2} cy={yCum(v)} r={3} />
      ))}
      <text className="income-axis income-cum-label" x={W - PAD.r + 8} y={yCum(cum[cum.length - 1]) + 4}>
        {compactInr(cum[cum.length - 1])}
      </text>

      {months.map((m, i) => {
        const cx = PAD.l + band * i + band / 2;
        const x = cx - barW / 2;
        const segs = segsFor(m);
        const tot = valueFor(m);
        let cursor = 0;

        return (
          <g key={m}>
            {segs.map((s, idx) => {
              const yTop = y(cursor + s.v);
              const yBot = y(cursor);
              const isTop = idx === segs.length - 1;
              // 2px surface gap between stacked segments; only the top one gets
              // rounded ends so the stack still reads as one bar.
              const h = Math.max(1, yBot - yTop - (isTop ? 0 : 2));
              cursor += s.v;
              return (
                <rect key={s.id} x={x} y={yTop} width={barW} height={h}
                  rx={isTop ? 4 : 0} ry={isTop ? 4 : 0} fill={s.color} />
              );
            })}

            {tot > 0 && (
              <text className="income-barlabel" x={cx} y={y(tot) - 8} textAnchor="middle">
                {compactInr(tot)}
              </text>
            )}

            <text className="income-axis" x={cx} y={H - 14} textAnchor="middle">
              {shortMonth(m)}
            </text>

            {/* Hit target wider than the bar, full plot height. */}
            <rect
              className="income-hit"
              x={PAD.l + band * i} y={PAD.t} width={band} height={plotH}
              onMouseMove={(e) =>
                onTip({
                  x: Math.min(e.clientX + 14, window.innerWidth - 210),
                  y: e.clientY - 10,
                  title: monthLabel(m),
                  rows: segs.length
                    ? segs.map((s) => ({ label: s.label, value: money(s.v), color: s.color }))
                    : [{ label: "Nothing received", value: "—" }],
                  total: segs.length > 1 ? money(tot) : undefined,
                })
              }
              onMouseLeave={() => onTip(null)}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ProgramChart({
  programs, onTip,
}: {
  programs: [string, number][];
  onTip: (t: Tip | null) => void;
}) {
  const ROW = 30, W = 960, PAD = { t: 6, r: 10, b: 6, l: 210 };
  const H = PAD.t + programs.length * ROW + PAD.b;
  const plotW = W - PAD.l - PAD.r;
  const max = programs[0][1];

  return (
    <svg className="income-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="PayPal income by program">
      {programs.map(([name, v], i) => {
        const yTop = PAD.t + i * ROW + 6;
        const h = ROW - 14;
        const w = Math.max(2, (v / max) * plotW * 0.74);
        const label = name.length > 26 ? `${name.slice(0, 25)}…` : name;
        return (
          <g key={name}>
            {/* One series: rank is length, never colour. */}
            <rect x={PAD.l} y={yTop} width={w} height={h} rx={4} ry={4} fill={SERIES[0]} />
            <text className="income-rowname" x={PAD.l - 12} y={yTop + h / 2 + 4} textAnchor="end">
              {label}
            </text>
            <text className="income-barlabel" x={PAD.l + w + 8} y={yTop + h / 2 + 4}>
              {money(v)}
            </text>
            <rect
              className="income-hit" x={0} y={PAD.t + i * ROW} width={W} height={ROW}
              onMouseMove={(e) =>
                onTip({
                  x: Math.min(e.clientX + 14, window.innerWidth - 210),
                  y: e.clientY - 10,
                  title: name,
                  rows: [{ label: "To bank", value: money(v), color: SERIES[0] }],
                })
              }
              onMouseLeave={() => onTip(null)}
            />
          </g>
        );
      })}
    </svg>
  );
}
