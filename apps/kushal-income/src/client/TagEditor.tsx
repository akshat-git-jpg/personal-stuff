/** Pick one main tag, an optional sub-tag and a description for one or more rows, then save. */
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
  const [sub, setSub] = useState<string>(init[1] ?? "");
  const [desc, setDesc] = useState(props.initialDesc ?? "");
  const [always, setAlways] = useState(!!props.alwaysDefault);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tripSubs = props.trip ? ["stay", "food", "bus", "auto", "metro"].map((k) => `${props.trip}-${k}`) : [];
  const subChoices = main ? [...new Set([...(main === "trip" ? tripSubs : []), ...(props.subs[main] ?? [])])].slice(0, 16) : [];

  const save = async () => {
    if (!main) return;
    const s = sub.trim().toLowerCase();
    setBusy(true);
    setErr(null);
    try {
      await tagRows(props.rowIds, s ? [main, s] : [main], desc.trim() || null, always);
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
            onClick={() => { setMain(t); if (t !== main) setSub(""); }}>{t}</button>
        ))}
      </div>
      {main && (
        <>
          <div className="small muted">Sub-tag under {main} (optional)</div>
          <div className="chips" role="group" aria-label="Sub-tag">
            {subChoices.map((t) => (
              <button key={t} type="button" className="chip sub" aria-pressed={sub === t} onClick={() => setSub(sub === t ? "" : t)}>{t}</button>
            ))}
          </div>
        </>
      )}
      <div className="editor-row">
        <label className="field">
          <span>New sub-tag</span>
          <input value={subChoices.includes(sub) ? "" : sub} onChange={(e) => setSub(e.target.value)} placeholder="e.g. claude sub, goa-stay" />
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
