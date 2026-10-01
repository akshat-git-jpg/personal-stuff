/** Put one or more rows on one tag of the tree: search for it, or click down to it, or make a new one there. */
import { Fragment, useMemo, useState } from "react";
import { createTag, tagRows, type TagNode } from "./api";
import { chain, makeTree, namesOf } from "./lib";

export function TagEditor(props: {
  rowIds: string[];
  payee: string;
  tags: TagNode[];
  /** Where browsing starts, e.g. the row's trip. */
  startAt?: string | null;
  initialTagId?: string | null;
  initialDesc?: string | null;
  /** Offer "tag every payment to this payee"; defaults it on when true. */
  alwaysDefault?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [made, setMade] = useState<TagNode[]>([]);
  const tree = useMemo(() => makeTree([...props.tags, ...made]), [props.tags, made]);
  const [at, setAt] = useState<string | null>(props.initialTagId ?? props.startAt ?? null);
  const [picked, setPicked] = useState<string | null>(props.initialTagId ?? null);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [desc, setDesc] = useState(props.initialDesc ?? "");
  const [always, setAlways] = useState(!!props.alwaysDefault);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = (id: string | null) => { setAt(id); setPicked(id); setQ(""); };
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = words.length
    ? [...tree.byId.keys()].map((id) => ({ id, path: namesOf(tree, id) }))
        .filter((h) => words.every((w) => h.path.join(" ").includes(w)))
        .sort((a, b) => a.path.length - b.path.length).slice(0, 8)
    : [];
  const kids = tree.kids.get(at) ?? [];

  const add = async () => {
    if (!newName.trim()) return;
    setErr(null);
    try {
      const t = await createTag(at, newName);
      setMade([...made, t]);
      setNewName("");
      go(t.id);
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  const save = async () => {
    if (!picked) return;
    setBusy(true);
    setErr(null);
    try {
      await tagRows(props.rowIds, picked, desc.trim() || null, always);
      props.onSaved();
    } catch (e) {
      setErr(String((e as Error).message));
      setBusy(false);
    }
  };

  return (
    <div className="editor">
      <input className="search small-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Find a tag: try auto, rent, varkala" aria-label="Find a tag" />
      {words.length > 0 && (
        <div className="hits" role="listbox" aria-label="Matching tags">
          {hits.map((h) => (
            <button key={h.id} type="button" className="hit" onClick={() => go(h.id)}>{h.path.join(" › ")}</button>
          ))}
          {!hits.length && <span className="muted small">No tag matches. Click down below and add it.</span>}
        </div>
      )}

      <nav className="trail" aria-label="Where you are">
        <button type="button" className="crumb" aria-current={at === null} onClick={() => go(null)}>All tags</button>
        {chain(tree, at).map((t) => (
          <Fragment key={t.id}>
            <span className="sep">›</span>
            <button type="button" className="crumb" aria-current={t.id === at} onClick={() => go(t.id)}>{t.name}</button>
          </Fragment>
        ))}
      </nav>
      <div className="chips" role="group" aria-label="Tags inside">
        {kids.map((t) => (
          <button key={t.id} type="button" className="chip" onClick={() => go(t.id)}>
            {t.name}{tree.kids.has(t.id) && <span className="more" aria-hidden>›</span>}
          </button>
        ))}
        <span className="addtag">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={at ? "new tag inside" : "new top tag"}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} aria-label="New tag name" />
          <button type="button" className="btn-ghost" disabled={!newName.trim()} onClick={() => void add()}>+ Add</button>
        </span>
      </div>

      <div className="picked">
        {picked ? <>Tag: <b>{namesOf(tree, picked).join(" › ")}</b></> : <span className="muted">Pick a tag above</span>}
      </div>

      <div className="editor-row">
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
        <button type="button" className="btn-primary" disabled={!picked || busy} onClick={() => void save()}>
          {busy ? "Saving…" : props.rowIds.length > 1 ? `Save for ${props.rowIds.length} payments` : "Save tag"}
        </button>
      </div>
      {err && <div className="warn small">{err}</div>}
    </div>
  );
}
