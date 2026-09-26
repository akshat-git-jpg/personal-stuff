/** Pick tags (and optionally a description) for one or more rows, then save. */
import { useState } from "react";
import { tagRows } from "./api";
import { PARENT, TAG_CHOICES, tripChoices } from "./lib";

export function TagEditor(props: {
  rowIds: string[];
  payee: string;
  initialTags?: string[];
  initialDesc?: string | null;
  /** The trip these payments belong to, if any: adds its stay/food/bus/auto buttons. */
  trip?: string;
  /** Offer "tag every payment to this payee"; defaults it on when true. */
  alwaysDefault?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [tags, setTags] = useState<string[]>(props.initialTags ?? []);
  const [custom, setCustom] = useState("");
  const [desc, setDesc] = useState(props.initialDesc ?? "");
  const [always, setAlways] = useState(!!props.alwaysDefault);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const trip = tripChoices(props.trip);
  const all = [...new Set([...trip, ...TAG_CHOICES, ...tags.filter((t) => t !== "commute" && t !== "trip")])];
  const extra = custom.trim().toLowerCase();
  const ready = tags.length > 0 || !!extra;

  const save = async () => {
    const picked = extra && !tags.includes(extra) ? [...tags, extra] : tags;
    const base = picked.filter((t) => t !== "commute" && t !== "trip");
    const final = [...base, ...(props.trip ? ["trip"] : []), ...new Set(base.map((t) => PARENT[t]).filter(Boolean))];
    setBusy(true);
    setErr(null);
    try {
      await tagRows(props.rowIds, final, desc.trim() || null, always);
      props.onSaved();
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <div className="editor">
      <div className="chips" role="group" aria-label="Tags">
        {all.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      <div className="editor-row">
        <label className="field">
          <span>Other tag</span>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="only if none above fits" />
        </label>
        <label className="field grow">
          <span>Description (optional)</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Auto: office to gym, barber, dermatologist" />
        </label>
      </div>
      <div className="editor-row">
        <label className="check grow">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
          <span>Tag every payment to <b>{props.payee}</b> this way, now and in future syncs</span>
        </label>
        {props.onCancel && <button type="button" className="btn-ghost" onClick={props.onCancel}>Cancel</button>}
        <button type="button" className="btn-primary" disabled={!ready || busy} onClick={() => void save()}>
          {busy ? "Saving…" : props.rowIds.length > 1 ? `Save for ${props.rowIds.length} payments` : "Save tag"}
        </button>
      </div>
      {err && <div className="warn small">{err}</div>}
    </div>
  );
}
