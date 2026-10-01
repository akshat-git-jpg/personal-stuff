/** Pick one main tag, any sub-tags and a description for one or more rows, then save. */
import { useState } from "react";
import { tagRows } from "./api";
import { MAINS } from "./lib";

export function TagEditor(props: {
  rowIds: string[];
  payee: string;
  initialTags?: string[];
  initialDesc?: string | null;
  /** The trip these payments belong to, if any: starts on "trip" with its sub-tags. */
  trip?: string;
  /** Sub-tags already in use under each main tag, offered as buttons. */
  subs: Record<string, string[]>;
  /** Offer "tag every payment to this payee"; defaults it on when true. */
  alwaysDefault?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const init = props.initialTags ?? [];
  const [main, setMain] = useState<string | null>(init[0] ?? (props.trip ? "trip" : null));
  const [picked, setPicked] = useState<string[]>(init.slice(1));
  const [extra, setExtra] = useState("");
  const [desc, setDesc] = useState(props.initialDesc ?? "");
  const [always, setAlways] = useState(!!props.alwaysDefault);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tripSubs = props.trip ? ["stay", "food", "bus", "auto", "metro", "flight", "train"].map((k) => `${props.trip}-${k}`) : [];
  const subChoices = main ? [...new Set([...picked, ...(main === "trip" ? tripSubs : []), ...(props.subs[main] ?? [])])].slice(0, 20) : [];
  const toggle = (t: string) => setPicked(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]);

  const save = async () => {
    if (!main) return;
    const typed = extra.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    setBusy(true);
    setErr(null);
    try {
      await tagRows(props.rowIds, [main, ...new Set([...picked, ...typed])], desc.trim() || null, always);
      props.onSaved();
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <div className="editor">
      <div className="small muted">Main tag</div>
      <div className="chips" role="group" aria-label="Main tag">
        {MAINS.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={main === t}
            onClick={() => { setMain(t); if (t !== main) setPicked([]); }}>{t}</button>
        ))}
      </div>
      {main && (
        <>
          <div className="small muted">Sub-tags under {main} (optional, pick any)</div>
          <div className="chips" role="group" aria-label="Sub-tag">
            {subChoices.map((t) => (
              <button key={t} type="button" className="chip sub" aria-pressed={picked.includes(t)} onClick={() => toggle(t)}>{t}</button>
            ))}
          </div>
        </>
      )}
      <div className="editor-row">
        <label className="field">
          <span>New sub-tags (comma between them)</span>
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. goa, goa-stay" />
        </label>
        <label className="field grow">
          <span>Description (optional)</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Auto: office to gym, Dr Priya" />
        </label>
      </div>
      <div className="editor-row">
        <label className="check grow">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} />
          <span>Tag every payment to <b>{props.payee}</b> this way, now and in future syncs</span>
        </label>
        {props.onCancel && <button type="button" className="btn-ghost" onClick={props.onCancel}>Cancel</button>}
        <button type="button" className="btn-primary" disabled={!main || busy} onClick={() => void save()}>
          {busy ? "Saving…" : props.rowIds.length > 1 ? `Save for ${props.rowIds.length} payments` : "Save tag"}
        </button>
      </div>
      {err && <div className="warn small">{err}</div>}
    </div>
  );
}
