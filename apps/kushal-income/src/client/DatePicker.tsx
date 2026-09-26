/** Month stepper: arrows step one month (or year); the name opens a picker with multi-select months. */
import { useEffect, useRef, useState } from "react";
import { addDays, dayLabel, MONTHS } from "./lib";

export type Pick =
  | { kind: "months"; months: string[] }
  | { kind: "10d" }
  | { kind: "all" }
  | { kind: "custom"; from: string; to: string };

const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const shift = (k: string, n: number) => {
  const i = +k.slice(0, 4) * 12 + +k.slice(5, 7) - 1 + n;
  return ym(Math.floor(i / 12), (i % 12) + 1);
};

/** Does a row date fall in the pick? `newest` is the newest row date, the anchor for "last 10 days". */
export function inPick(p: Pick, date: string, newest: string): boolean {
  switch (p.kind) {
    case "months": return p.months.includes(date.slice(0, 7));
    case "10d": return date >= addDays(newest, -9);
    case "all": return true;
    case "custom": return (!p.from || date >= p.from) && (!p.to || date <= p.to);
  }
}

/** Months of year `y` that have data. */
function yearMonths(y: number, first: string, last: string) {
  return Array.from({ length: 12 }, (_, i) => ym(y, i + 1)).filter((k) => k >= first && k <= last);
}

function isWholeYear(ms: string[], first: string, last: string) {
  const y = +ms[0].slice(0, 4);
  const all = yearMonths(y, first, last);
  return ms.length > 1 && ms.every((k) => +k.slice(0, 4) === y) && all.length === ms.length ? y : null;
}

export function pickLabel(p: Pick, first: string, last: string): string {
  if (p.kind === "10d") return "Last 10 days";
  if (p.kind === "all") return "All time";
  if (p.kind === "custom") {
    if (!p.from && !p.to) return "Custom dates";
    return `${p.from ? dayLabel(p.from) : "Start"} – ${p.to ? `${dayLabel(p.to)} ${p.to.slice(0, 4)}` : "now"}`;
  }
  const ms = [...p.months].sort();
  if (ms.length === 1) return `${FULL[+ms[0].slice(5, 7) - 1]} ${ms[0].slice(0, 4)}`;
  const y = isWholeYear(ms, first, last);
  if (y) return `Whole ${y}`;
  const run = ms.every((k, i) => !i || shift(ms[i - 1], 1) === k);
  const short = (k: string) => MONTHS[+k.slice(5, 7) - 1];
  if (run) {
    const a = ms[0], b = ms[ms.length - 1];
    return a.slice(0, 4) === b.slice(0, 4) ? `${short(a)} – ${short(b)} ${b.slice(0, 4)}` : `${short(a)} ${a.slice(0, 4)} – ${short(b)} ${b.slice(0, 4)}`;
  }
  if (ms.length <= 3 && ms.every((k) => k.slice(0, 4) === ms[0].slice(0, 4))) return `${ms.map(short).join(", ")} ${ms[0].slice(0, 4)}`;
  return `${ms.length} months`;
}

const Chev = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const LEFT = "M15 18l-6-6 6-6", RIGHT = "M9 18l6-6-6-6", DOWN = "M6 9l6 6 6-6", UP = "M18 15l-6-6-6 6";

export function DatePicker({ value, onChange, first, last }: {
  value: Pick; onChange: (p: Pick) => void;
  /** First and last months with data, "YYYY-MM". */
  first: string; last: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = value.kind === "months" ? value.months : [];
  const [year, setYear] = useState(+(sel[0] ?? last).slice(0, 4));
  const [from, setFrom] = useState(value.kind === "custom" ? value.from : "");
  const [to, setTo] = useState(value.kind === "custom" ? value.to : "");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  const one = sel.length === 1 ? sel[0] : null;
  const whole = sel.length ? isWholeYear(sel, first, last) : null;
  const step = (n: number) => {
    if (one) onChange({ kind: "months", months: [shift(one, n)] });
    else if (whole) onChange({ kind: "months", months: yearMonths(whole + n, first, last) });
  };
  const canBack = one ? one > first : whole ? whole > +first.slice(0, 4) : false;
  const canNext = one ? one < last : whole ? whole < +last.slice(0, 4) : false;
  const stepper = !!(one || whole);
  const unit = one ? "month" : "year";

  const toggle = (k: string) => {
    if (value.kind !== "months") return onChange({ kind: "months", months: [k] });
    const has = sel.includes(k);
    if (has && sel.length === 1) return;
    onChange({ kind: "months", months: has ? sel.filter((x) => x !== k) : [...sel, k].sort() });
  };
  const choose = (p: Pick) => { onChange(p); setOpen(false); };
  const reset = () => onChange({ kind: "months", months: [last] });

  return (
    <div className="dp" ref={box} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <div className="dp-bar">
        {stepper && (
          <button className="dp-arrow" disabled={!canBack} aria-label={`Previous ${unit}`} onClick={() => step(-1)}><Chev d={LEFT} /></button>
        )}
        <button className={`dp-name ${stepper ? "" : "solo"}`} aria-expanded={open} onClick={() => { setYear(+(sel[0] ?? last).slice(0, 4)); setOpen(!open); }}>
          {pickLabel(value, first, last)}<Chev d={open ? UP : DOWN} />
        </button>
        {stepper ? (
          <button className="dp-arrow" disabled={!canNext} aria-label={`Next ${unit}`} onClick={() => step(1)}><Chev d={RIGHT} /></button>
        ) : (
          <button className="dp-arrow" aria-label="Back to this month" onClick={reset}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>
      {one && one !== last && <button className="linkbtn dp-back" onClick={reset}>Back to this month</button>}

      {open && (
        <div className="dp-pop" role="dialog" aria-label="Pick dates">
          <div className="dp-yr">
            <button className="dp-arrow sm" disabled={year <= +first.slice(0, 4)} aria-label="Previous year" onClick={() => setYear(year - 1)}><Chev d={LEFT} /></button>
            <span>{year}</span>
            <button className="dp-arrow sm" disabled={year >= +last.slice(0, 4)} aria-label="Next year" onClick={() => setYear(year + 1)}><Chev d={RIGHT} /></button>
          </div>
          <div className="dp-grid">
            {MONTHS.map((m, i) => {
              const k = ym(year, i + 1);
              return <button key={k} className="dp-m" disabled={k < first || k > last} aria-pressed={sel.includes(k)} onClick={() => toggle(k)}>{m}</button>;
            })}
          </div>
          <div className="muted small">Tap more months to add them. Tap a picked month to take it out.</div>
          <div className="dp-quick">
            <button className="chip" onClick={() => choose({ kind: "months", months: yearMonths(year, first, last) })}>Whole {year}</button>
            <button className="chip" aria-pressed={value.kind === "10d"} onClick={() => choose({ kind: "10d" })}>Last 10 days</button>
            <button className="chip" aria-pressed={value.kind === "all"} onClick={() => choose({ kind: "all" })}>All time</button>
          </div>
          <div className="dp-sep" />
          <div className="dp-dates">
            <label className="field"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <button className="btn-ghost" disabled={!from && !to} onClick={() => choose({ kind: "custom", from, to })}>Show</button>
          </div>
          <button className="btn-primary dp-done" onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}
