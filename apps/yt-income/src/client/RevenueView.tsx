/**
 * RevenueView — revenue by tool, for one month, tallied against the bank.
 *
 * The design rule this file exists to enforce: the bank is the truth, so the
 * tool rows plus Untraced always add up to the bank total. Untraced is a
 * permanent row, not an error path — money that arrived but cannot be named is
 * the normal state today, and hiding it would corrupt a source of truth.
 */
import { useEffect, useMemo, useState } from "react";
import {
  fetchRevenue, UnauthorizedError,
  type MonthRevenue, type RevenueResponse, type ToolRow,
} from "./api";
import { CONFIDENCE_LABEL, HOP_HUE, OTHER_HUE, TOOL_HUES, UNKNOWN_HUE, UNTRACED_HUE } from "./palette";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});
const money = (n: number) => inr.format(n);
/** Indian short scale — a lakh reads faster than "172k" to this reader. */
const compact = (n: number) =>
  n >= 100000 ? `${(n / 100000).toFixed(n >= 1000000 ? 0 : 1).replace(/\.0$/, "")}L`
  : n >= 1000 ? `${Math.round(n / 1000)}k`
  : String(Math.round(n));

const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const label = (k: string) => `${MONTHS[+k.slice(5) - 1]} ${k.slice(0, 4)}`;

type Tip = {
  x: number; y: number; title: string;
  rows: { label: string; value: string; fill?: string; hatch?: boolean; route?: string[] }[];
  subs: { label: string; value: string; route?: string[] }[];
  total: string;
};

export function RevenueView() {
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let alive = true;
    fetchRevenue()
      .then((d) => {
        if (!alive) return;
        setData(d);
        // Default to the current month, or the newest month we can answer for.
        const now = key(new Date().getFullYear(), new Date().getMonth());
        const start = d.coverage.to && now > d.coverage.to ? d.coverage.to : now;
        setSel(start);
        setYear(+start.slice(0, 4));
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof UnauthorizedError ? "Session expired — reload." : String(e.message ?? e));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  /* Tool colours are assigned once, by each tool's total across every month, so
     a tool keeps its colour when you change month. Colour follows the entity,
     never its rank. */
  const palette = useMemo(() => {
    if (!data) return { colour: () => OTHER_HUE, named: [] as string[], folded: [] as string[], totals: {} as Record<string, number> };
    const totals: Record<string, number> = {};
    for (const m of Object.values(data.months))
      for (const t of m.tools) totals[t.tool] = (totals[t.tool] ?? 0) + t.amount;
    const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const named = ranked.slice(0, TOOL_HUES.length);
    const map = Object.fromEntries(named.map((t, i) => [t, TOOL_HUES[i]]));
    return {
      colour: (t: string) => map[t] ?? OTHER_HUE,
      isNamed: (t: string) => Boolean(map[t]),
      rank: (t: string) => ranked.indexOf(t),
      named, folded: ranked.slice(TOOL_HUES.length), totals,
    };
  }, [data]);

  if (loading) return <div className="empty">Loading revenue…</div>;
  if (error) return <div className="banner-error">{error}</div>;
  if (!data) return null;

  const { coverage } = data;
  const month: MonthRevenue | undefined = sel ? data.months[sel] : undefined;
  const beyond = Boolean(sel && coverage.to && sel > coverage.to);

  return (
    <div className="rev" onMouseLeave={() => setTip(null)}>
      <SnapshotBar data={data} />
      <Picker
        year={year} setYear={setYear} sel={sel} setSel={setSel}
        coverage={coverage} have={data.months}
      />
      <Sources sources={data.sources} />

      {beyond ? (
        <Empty
          icon="◷"
          title={`${sel && label(sel)} is after the snapshot`}
          body={<>The last import covered up to <strong>{coverage.to && label(coverage.to)}</strong>.
            Nothing is known about this month yet, so nothing is shown — a zero here
            would read as “you earned nothing”.</>}
        />
      ) : !month ? (
        <Empty
          icon="○"
          title={`No data imported for ${sel ? label(sel) : "this month"}`}
          body={<>This is <strong>not</strong> zero revenue. No passbook covering this month has
            been ingested. Export the statement and run <code>yt-income</code>.</>}
        />
      ) : (
        <>
          <Tally month={month} name={label(sel!)} />
          <ToolTable month={month} palette={palette} sources={data.sources} />
          <Trend
            months={data.months} sel={sel!} palette={palette} onTip={setTip}
          />
        </>
      )}

      {tip && <Tooltip tip={tip} />}
    </div>
  );
}

/* ── snapshot ─────────────────────────────────────────────────────────── */

function SnapshotBar({ data }: { data: RevenueResponse }) {
  const st = data.statements[0];
  const when = data.generated_at ? new Date(data.generated_at) : null;
  const pending = data.paypal_pending;
  return (
    <div className="snapshot">
      <span className="snap-dot" />
      <span className="snap-main">
        <strong>Snapshot — not live.</strong>{" "}
        {when ? <>Data as of <strong>{when.toLocaleString()}</strong></> : "Never imported"}
      </span>
      <span className="snap-sub">
        Refreshed by <code>yt-income</code>
        {st?.period_start && <> · statement covers {st.period_start} – {st.period_end}</>}
        {pending && pending.total_any_currency > 0 && (
          <> · <strong className="snap-pending">
            USD {pending.total_any_currency.toFixed(2)} still in PayPal
          </strong></>
        )}
      </span>
    </div>
  );
}

/* ── period picker ────────────────────────────────────────────────────── */

function Picker({
  year, setYear, sel, setSel, coverage, have,
}: {
  year: number; setYear: (y: number) => void;
  sel: string | null; setSel: (k: string) => void;
  coverage: { from: string | null; to: string | null };
  have: Record<string, MonthRevenue>;
}) {
  return (
    <div className="picker">
      <div className="picker-head">
        <div className="year-nav">
          <button className="year-btn" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
          <span className="year-label">{year}</span>
          <button className="year-btn" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
        </div>
        <span className="picker-hint">
          {coverage.to
            ? <>Selectable up to {label(coverage.to)} — the snapshot date</>
            : "Nothing imported yet"}
        </span>
      </div>
      <div className="months">
        {MONTHS.map((m, i) => {
          const k = key(year, i);
          // Past the snapshot is disabled, not just empty: a period we cannot
          // answer must not be selectable at all.
          const future = Boolean(coverage.to && k > coverage.to);
          return (
            <button
              key={k}
              className={`m ${k === sel ? "m-on" : ""} ${have[k] ? "m-has" : ""} ${future ? "m-off" : ""}`}
              disabled={future}
              onClick={() => setSel(k)}
              title={future ? "Beyond the snapshot date" : have[k] ? "Data available" : "No data imported"}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: RevenueResponse["sources"] }) {
  const text: Record<string, string> = {
    connected: "API", manual: "manual import", stale: "not refreshed", absent: "not connected",
  };
  return (
    <div className="sources">
      {sources.map((s) => (
        <div key={s.id} className={`src ${s.state === "absent" ? "src-off" : ""}`} title={s.note ?? ""}>
          <span className="src-swatch" style={{ background: HOP_HUE[s.label] ?? "var(--faint)" }} />
          {s.label}
          <span className="src-state">{text[s.state] ?? s.state}</span>
        </div>
      ))}
    </div>
  );
}

/* ── the tally ────────────────────────────────────────────────────────── */

function Tally({ month, name }: { month: MonthRevenue; name: string }) {
  const traced = month.tools.reduce((s, t) => s + t.amount, 0);
  const un = month.untraced.amount;
  const unknown = month.unidentified?.amount ?? 0;
  // Unidentified is not traced to a tool either, so it counts against the verdict.
  const unnamed = un + unknown;
  const clean = unnamed < 1;
  const pct = month.bank_total ? Math.round((traced / month.bank_total) * 100) : 100;
  const unknownPct = month.bank_total ? Math.round((unknown / month.bank_total) * 100) : 0;
  return (
    <div className="tally">
      <div className="tally-top">
        <div>
          <div className="tally-cap">Reached the bank in {name}</div>
          <div className="tally-figure">{money(month.bank_total)}</div>
          <div className="tally-note">
            Bank credits are the truth. Every row below adds up to this figure.
          </div>
        </div>
        <div className={`verdict ${clean ? "verdict-ok" : "verdict-warn"}`}>
          {clean
            ? "✓ Every rupee traced to a tool"
            : `⚠ ${money(unnamed)} could not be traced to a tool`}
        </div>
      </div>
      <div className="split">
        <span style={{ width: `${pct}%`, background: TOOL_HUES[0] }} />
        {unknown > 1 && <span style={{ width: `${unknownPct}%`, background: UNKNOWN_HUE }} />}
        {un > 1 && (
          <span style={{ width: `${100 - pct - unknownPct}%`, background: UNTRACED_HUE }} />
        )}
      </div>
      <div className="split-key">
        <div>
          <span className="sw" style={{ background: TOOL_HUES[0] }} />
          Traced to tools <b>{money(traced)}</b> · {pct}%
        </div>
        {unknown > 1 && (
          <div>
            <span className="sw sw-unknown" />
            Unidentified payer <b>{money(unknown)}</b> · {unknownPct}%
          </div>
        )}
        {un > 1 && (
          <div>
            <span className="sw sw-hatch" />
            Untraced <b>{money(un)}</b> · {100 - pct - unknownPct}%
          </div>
        )}
      </div>
    </div>
  );
}

/* ── tool table ───────────────────────────────────────────────────────── */

function Route({ hops }: { hops: string[] }) {
  const all = [...hops, "Bank"];
  return (
    <span className="chain">
      {all.map((h, i) => {
        const c = HOP_HUE[h];
        return (
          <span key={h + i}>
            {i > 0 && <span className="hop-arrow">→</span>}
            <span
              className={`hop ${h === "Bank" ? "hop-bank" : ""}`}
              style={c ? { background: `${c}22`, color: c, borderColor: `${c}55` } : undefined}
            >
              {h}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function ToolTable({
  month, palette, sources,
}: {
  month: MonthRevenue;
  palette: { colour: (t: string) => string };
  sources: RevenueResponse["sources"];
}) {
  const un = month.untraced;
  const unknown = month.unidentified?.payers ?? [];
  const clean = un.amount < 1;
  const absent = sources.filter((s) => s.state === "absent");
  const rows: ToolRow[] = [...month.tools].sort((a, b) => b.amount - a.amount);

  return (
    <div className="panel">
      <h2 className="sec-title">Revenue by tool</h2>
      <p className="sec-note">
        Where each rupee came from, and the route it took. Money reaches the bank
        either straight from a network, or via PayPal first.
      </p>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Tool</th><th>Route</th><th>Amount</th><th>Share</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.tool + t.route.join()}>
                <td>
                  <span className="sw" style={{ background: palette.colour(t.tool) }} />
                  {t.tool}
                  {CONFIDENCE_LABEL[t.confidence] && (
                    <span className="conf" title={confidenceHelp(t.confidence)}>
                      {CONFIDENCE_LABEL[t.confidence]}
                    </span>
                  )}
                </td>
                <td><Route hops={t.route} /></td>
                <td>{money(t.amount)}</td>
                <td>{((t.amount / month.bank_total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {/* Traced to a payer, but the payer is an agency, not a tool. Shown
                as Unidentified rather than under the agency's name — writing
                "DigitalWorks" in the Tool column would claim it is a product the
                owner promotes, which is false. */}
            {month.unidentified?.payers?.map((p, i) => (
              <tr className="row-unknown" key={`u${i}`}>
                <td>
                  <span className="sw sw-unknown" />
                  Unidentified
                  <span className="conf" title={`Paid by ${p.payer}, which pays out on behalf of other brands`}>
                    via {p.via}
                  </span>
                </td>
                <td><Route hops={p.route} /></td>
                <td>{money(p.amount)}</td>
                <td>{((p.amount / month.bank_total) * 100).toFixed(1)}%</td>
              </tr>
            ))}

            {/* One row per rail, not one lump. We always know how the money
                arrived even when we do not know who sent it, and naming the rail
                is the difference between a dead end and a lead. */}
            {!clean && untracedByRail(un.credits).map(([railLabel, credits]) => {
              const amt = credits.reduce((s, c) => s + c.amount, 0);
              return (
                <tr className="row-untraced" key={railLabel}>
                  <td><span className="sw sw-hatch" />Untraced</td>
                  <td>
                    <span className="chain">
                      <span className="hop hop-unknown" title="Which tool sent this is not yet known">
                        ? unidentified sender
                      </span>
                      <span className="hop-arrow">→</span>
                      <span className="hop"
                            style={HOP_HUE[railLabel]
                              ? { background: `${HOP_HUE[railLabel]}22`, color: HOP_HUE[railLabel],
                                  borderColor: `${HOP_HUE[railLabel]}55` }
                              : undefined}>
                        {railLabel}
                      </span>
                      <span className="hop-arrow">→</span>
                      <span className="hop hop-bank">Bank</span>
                    </span>
                  </td>
                  <td>{money(amt)}</td>
                  <td>{((amt / month.bank_total) * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td />
              <td className="amt-strong">{money(month.bank_total)}</td>
              <td className="amt-strong">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {unknown.length > 0 && (
        <div className="untraced-why unknown-why">
          <strong>
            {money(month.unidentified.amount)} came from a payer that is not a tool.
          </strong>{" "}
          We know exactly who sent it — it is just not something you promote, so there
          is no tool name to put against it.
          {unknown.map((p, i) => (
            <div className="ucredit-card" key={i}>
              <div className="ucredit-head">
                <span className="ucredit-amt">{money(p.amount)}</span>
                <span className="ucredit-meta">paid by <strong>{p.via}</strong></span>
                <span className="ucredit-ref">{p.payer}</span>
              </div>
              <div className="ucredit-leads">
                <span className="ucredit-leads-h">
                  An affiliate agency pays out on behalf of brands, so the tool behind
                  this could be any of them. Once you know which, add it to{" "}
                  <code>tool_aliases</code> in <code>rules.json</code> and it becomes a
                  normal tool row.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!clean && (
        <div className="untraced-why">
          <strong>Chasing {money(un.amount)}.</strong>{" "}
          It genuinely arrived in the bank — this is not missing money. Everything we
          do know about each credit is below. Quote the reference to the bank to ask
          who sent it.
          {absent.length > 0 && (
            <p className="untraced-absent">
              {absent.map((s) => s.label).join(", ")} {absent.length === 1 ? "is" : "are"} not
              connected, so {absent.length === 1 ? "its" : "their"} commissions can never be
              named until {absent.length === 1 ? "it is" : "they are"} wired in.
            </p>
          )}

          {un.credits.map((c, i) => (
            <div className="ucredit-card" key={i}>
              <div className="ucredit-head">
                <span className="ucredit-amt">{money(c.amount)}</span>
                <span className="ucredit-meta">{c.date}</span>
                <span className="ucredit-meta">arrived over <strong>{c.rail_label}</strong></span>
                {c.ref && (
                  <span className="ucredit-ref" title="Bank reference — quote this to the bank">
                    ref {c.ref}
                  </span>
                )}
              </div>
              {c.leads.length > 0 ? (
                <div className="ucredit-leads">
                  <span className="ucredit-leads-h">Worth checking:</span>
                  {c.leads.map((l, j) => (
                    <span className="lead" key={j}>
                      <strong>{l.source}</strong> — {l.what}
                      <em>
                        {l.gap_days} day{l.gap_days === 1 ? "" : "s"} before it landed
                        {l.implied_fx != null && <> · would imply ₹{l.implied_fx}/USD</>}
                      </em>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="ucredit-leads">
                  <span className="ucredit-leads-h">
                    No network payout anywhere near this date. Likely a source we have not
                    connected at all.
                  </span>
                </div>
              )}
            </div>
          ))}

          <p className="untraced-howto">
            Found the answer? Add one entry to{" "}
            <code>pipelines/income-analysis/rules.json</code> under{" "}
            <code>manual_attribution</code> — date, amount, tool, route — and re-run{" "}
            <code>yt-income</code>. It outranks every guess, so once recorded it stays named.
          </p>
        </div>
      )}
    </div>
  );
}

/** Group untraced credits by the rail they arrived on, biggest first. */
function untracedByRail(credits: MonthRevenue["untraced"]["credits"]) {
  const by = new Map<string, typeof credits>();
  for (const c of credits) {
    const k = c.rail_label || c.rail;
    by.set(k, [...(by.get(k) ?? []), c]);
  }
  return [...by.entries()].sort(
    (a, b) => b[1].reduce((s, c) => s + c.amount, 0) - a[1].reduce((s, c) => s + c.amount, 0));
}

function confidenceHelp(c: string): string {
  if (c === "confirmed") return "You established this one by hand and recorded it in rules.json. It outranks every heuristic.";
  if (c === "grouped") return "One batch of credits settled several programs; the month is exact, the per-credit split is not.";
  if (c === "matched") return "A dated network payout lined up with a bank credit on amount and exchange rate.";
  if (c === "inferred") return "No payout date available, so this is deduced from the amount and the usual payment lag.";
  return "";
}

/* ── trend chart ──────────────────────────────────────────────────────── */

type Seg = { label: string; amt: number; fill: string; hatch?: boolean; route?: string[];
             members?: { label: string; value: number; route: string[] }[] };

function Trend({
  months, sel, palette, onTip,
}: {
  months: Record<string, MonthRevenue>;
  sel: string;
  palette: { colour: (t: string) => string; isNamed?: (t: string) => boolean;
             rank?: (t: string) => number; named: string[]; folded: string[];
             totals: Record<string, number> };
  onTip: (t: Tip | null) => void;
}) {
  const ks = Object.keys(months).sort();
  if (!ks.length) return null;

  const segsFor = (k: string): Seg[] => {
    const d = months[k];
    const segs: Seg[] = [];
    const folded: { label: string; value: number; route: string[] }[] = [];
    const ordered = [...d.tools].sort(
      (a, b) => (palette.rank?.(a.tool) ?? 0) - (palette.rank?.(b.tool) ?? 0));
    for (const t of ordered) {
      if (palette.isNamed?.(t.tool)) {
        segs.push({ label: t.tool, amt: t.amount, fill: palette.colour(t.tool), route: t.route });
      } else {
        folded.push({ label: t.tool, value: t.amount, route: t.route });
      }
    }
    // Folding is a display choice, never a loss of detail — members ride along
    // so the tooltip can name every one of them.
    if (folded.length) {
      segs.push({
        label: "Other tools", fill: OTHER_HUE,
        amt: folded.reduce((s, f) => s + f.value, 0), members: folded,
      });
    }
    if ((d.unidentified?.amount ?? 0) > 1) {
      segs.push({ label: "Unidentified payer", amt: d.unidentified.amount, fill: UNKNOWN_HUE });
    }
    if (d.untraced.amount > 1) {
      segs.push({ label: "Untraced", amt: d.untraced.amount, fill: "url(#hatch)", hatch: true });
    }
    return segs;
  };

  // Tall on purpose: one outsized month otherwise flattens every other month's
  // split into an unreadable band.
  const W = 940, H = 360, P = { t: 22, r: 12, b: 34, l: 56 };
  const pw = W - P.l - P.r, ph = H - P.t - P.b;
  const max = Math.max(...ks.map((k) => months[k].bank_total), 1);
  // Half-decade steps, so a 1.72L max does not reserve headroom all the way to 2L.
  const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
  const ceil = Math.ceil(max / step) * step;
  const y = (v: number) => P.t + ph - (v / ceil) * ph;
  const band = pw / ks.length, bw = Math.min(44, band * 0.54);

  const untracedTotal = ks.reduce((s, k) => s + months[k].untraced.amount, 0);
  const unknownTotal = ks.reduce((s, k) => s + (months[k].unidentified?.amount ?? 0), 0);

  return (
    <div className="panel">
      <h2 className="sec-title">Month by month, by tool</h2>
      <p className="sec-note">
        Each bar is one month&apos;s bank income, stacked by the tool it came from.
        The red hatched slice is money that arrived but has no tool against it yet.
        Hover any bar for the full split.
      </p>

      <svg className="rev-svg" viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label="Bank income each month, split by the tool it came from">
        <defs>
          <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)"
                   patternUnits="userSpaceOnUse">
            <rect width="7" height="7" fill={UNTRACED_HUE} />
            <line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,225,215,0.45)" strokeWidth="2.5" />
          </pattern>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = ceil * f;
          return (
            <g key={f}>
              <line className="grid-l" x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} />
              <text className="ax" x={P.l - 9} y={y(v) + 4} textAnchor="end">{compact(v)}</text>
            </g>
          );
        })}

        {ks.map((k, i) => {
          const d = months[k], segs = segsFor(k);
          const cx = P.l + band * i + band / 2, x = cx - bw / 2;
          let cursor = 0;
          return (
            <g key={k}>
              {segs.map((sg, idx) => {
                const yTop = y(cursor + sg.amt), yBot = y(cursor);
                const top = idx === segs.length - 1;
                const h = Math.max(1, yBot - yTop - (top ? 0 : 2));
                cursor += sg.amt;
                return (
                  <rect key={sg.label} x={x} y={yTop} width={bw} height={h}
                        fill={sg.fill} rx={top ? 4 : 0} ry={top ? 4 : 0} />
                );
              })}
              <text className="blab" x={cx} y={y(d.bank_total) - 8} textAnchor="middle">
                {compact(d.bank_total)}
              </text>
              <text className={`ax ${k === sel ? "ax-on" : ""}`} x={cx} y={H - 12} textAnchor="middle">
                {MONTHS[+k.slice(5) - 1]}
              </text>
              <rect
                className="hit" x={P.l + band * i} y={P.t} width={band} height={ph}
                onMouseMove={(e) => onTip({
                  x: Math.min(e.clientX + 16, window.innerWidth - 240),
                  y: e.clientY - 10,
                  title: label(k),
                  rows: segs.map((s) => ({
                    label: s.label, value: money(s.amt), fill: s.fill,
                    hatch: s.hatch, route: s.route,
                  })),
                  subs: segs.flatMap((s) => (s.members ?? [])
                    .sort((a, b) => b.value - a.value)
                    .map((m) => ({ label: m.label, value: money(m.value), route: m.route }))),
                  total: money(d.bank_total),
                })}
                onMouseLeave={() => onTip(null)}
              />
            </g>
          );
        })}
      </svg>

      <div className="legend">
        {palette.named.map((t) => (
          <div key={t}>
            <span className="sw" style={{ background: palette.colour(t) }} />
            {t} <b>{money(palette.totals[t])}</b>
          </div>
        ))}
        {palette.folded.length > 0 && (
          <div>
            <span className="sw" style={{ background: OTHER_HUE }} />
            Other tools <b>{money(palette.folded.reduce((s, t) => s + palette.totals[t], 0))}</b>
          </div>
        )}
        {unknownTotal > 1 && (
          <div>
            <span className="sw sw-unknown" />
            Unidentified payer <b>{money(unknownTotal)}</b>
          </div>
        )}
        {untracedTotal > 1 && (
          <div>
            <span className="sw sw-hatch" />
            Untraced <b>{money(untracedTotal)}</b>
          </div>
        )}
      </div>
      {palette.folded.length > 0 && (
        <p className="sec-note legend-note">
          Other tools: {palette.folded.join(", ")}. Hover a bar to see each one named.
        </p>
      )}
    </div>
  );
}

function Tooltip({ tip }: { tip: Tip }) {
  return (
    <div className="tt" style={{ left: tip.x, top: tip.y }} role="tooltip">
      <div className="tt-h">{tip.title}</div>
      {tip.rows.map((r, i) => (
        <div key={i}>
          <div className="tt-r">
            <span className="l">
              <span className={`sw ${r.hatch ? "sw-hatch" : ""}`}
                    style={r.hatch ? undefined : { background: r.fill }} />
              {r.label}
            </span>
            <span className="v">{r.value}</span>
          </div>
          {r.route && <div className="tt-route">{[...r.route, "Bank"].join(" → ")}</div>}
          {r.label === "Other tools" && tip.subs.map((s, j) => (
            <div className="tt-sub" key={j}>
              <span className="l">
                {s.label}
                {s.route && <span className="tt-route">{[...s.route, "Bank"].join(" → ")}</span>}
              </span>
              <span className="v">{s.value}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="tt-r tt-tot">
        <span className="l">Reached the bank</span>
        <span className="v">{tip.total}</span>
      </div>
    </div>
  );
}

function Empty({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <p>{body}</p>
    </div>
  );
}
