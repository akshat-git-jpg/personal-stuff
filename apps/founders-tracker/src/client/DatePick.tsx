import { useRef } from "react";
import { addDaysIST, fmtEtaShort } from "./dates";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "Day after", days: 2 },
];

/** Inline deadline picker: one-tap relative chips, no dialog. A small calendar
 *  fallback opens the native picker only when an arbitrary date is needed. */
export function DatePick({ value, onChange }: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const dateRef = useRef<HTMLInputElement>(null);

  function openNative() {
    const el = dateRef.current;
    if (!el) return;
    el.value = value ?? addDaysIST(1);
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.() ?? el.focus(); }
    catch { el.focus(); }
  }

  // A custom date is one that doesn't match any preset — surface it on the fallback chip.
  const isPreset = PRESETS.some((p) => addDaysIST(p.days) === value);
  const customLabel = value && !isPreset ? fmtEtaShort(value) : "Pick";

  return (
    <div className="datepick">
      {PRESETS.map((p) => {
        const d = addDaysIST(p.days);
        return (
          <button key={p.label} type="button"
            className={`date-chip ${value === d ? "on" : ""}`}
            onClick={() => onChange(d)}>{p.label}</button>
        );
      })}
      <button type="button" className={`date-chip cal ${value && !isPreset ? "on" : ""}`}
        onClick={openNative} aria-label="pick a specific date" title="pick a specific date">
        <span className="ic">◷</span>{customLabel}
      </button>
      {value && (
        <button type="button" className="clear-eta" onClick={() => onChange(null)}
          aria-label="clear deadline" title="clear deadline">✕</button>
      )}
      <input ref={dateRef} className="eta-input" type="date" tabIndex={-1} aria-hidden
        defaultValue={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}
