/**
 * Tags — the whole tag tree with totals for the picked dates. Rename, move, add inside, delete an empty tag.
 * A tag's total includes everything below it; payments follow their tag when it is renamed or moved.
 */
import { useMemo, useState } from "react";
import { createTag, deleteTag, updateTag, type Ledger, type TagNode } from "./api";
import { DatePicker, inPick, type Pick } from "./DatePicker";
import { chain, isIn, isSpend, makeTree, monthOf, namesOf, rs, todayIso, within, type Tree } from "./lib";

type Mode = { id: string | null; kind: "rename" | "move" | "add" };

export function Tags({ data, reload }: { data: Ledger; reload: () => Promise<void> }) {
  const tree = useMemo(() => makeTree(data.tags), [data]);
  const anchor = data.rows.reduce((m, r) => (r.date > m ? r.date : m), "") || todayIso();
  const first = data.rows.reduce((m, r) => (r.date < m ? r.date : m), anchor).slice(0, 7);
  const [pick, setPick] = useState<Pick>({ kind: "all" });
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Spend per tag (money in for tags with no spend), summed up the tree. `used` counts payments of all time.
  const { amt, inn, used } = useMemo(() => {
    const amt = new Map<string, number>(), inn = new Map<string, number>(), used = new Map<string, number>();
    const byKey = new Map(data.tags.filter((t) => t.key).map((t) => [t.key!, t.id]));
    for (const r of data.rows) {
      // A row the sync put on a tag keeps that tag in use even when the owner moved the row elsewhere.
      const synced = r.path ? byKey.get(r.path) : undefined;
      if (synced && synced !== r.tag_id) used.set(synced, (used.get(synced) ?? 0) + 1);
      if (!r.tag_id || r.status === "needs") continue;
      for (const t of chain(tree, r.tag_id)) {
        used.set(t.id, (used.get(t.id) ?? 0) + 1);
        if (!inPick(pick, r.date, anchor)) continue;
        if (isSpend(r)) amt.set(t.id, (amt.get(t.id) ?? 0) - r.amount!);
        else if (isIn(r)) inn.set(t.id, (inn.get(t.id) ?? 0) + r.amount!);
      }
    }
    return { amt, inn, used };
  }, [data, tree, pick, anchor]);

  const start = (m: Mode, v = "") => { setMode(m); setVal(v); setErr(null); };
  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      setMode(null);
      await reload();
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  const node = (t: TagNode, depth: number): React.ReactNode => {
    const kids = [...(tree.kids.get(t.id) ?? [])].sort((a, b) => (amt.get(b.id) ?? 0) - (amt.get(a.id) ?? 0) || a.name.localeCompare(b.name));
    const spend = amt.get(t.id) ?? 0, money = inn.get(t.id) ?? 0;
    const empty = !kids.length && !used.get(t.id);
    const editing = mode?.id === t.id ? mode.kind : null;
    return (
      <li key={t.id}>
        <div className={`tnode ${spend || money ? "" : "quiet"} ${sel === t.id ? "sel" : ""}`} style={{ paddingLeft: depth * 22 }}>
          {editing === "rename" ? (
            <form className="tedit" onSubmit={(e) => { e.preventDefault(); void run(() => updateTag(t.id, { name: val })); }}>
              <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} aria-label="New name" />
              <button className="btn-primary">Save</button>
              <button type="button" className="btn-ghost" onClick={() => setMode(null)}>Cancel</button>
            </form>
          ) : (
            <a className="tname" href={`#/transactions?tag=${encodeURIComponent(namesOf(tree, t.id)[0])}`} title="Open in Transactions">{t.name}</a>
          )}
          <button className="tmore" aria-label={`Change ${t.name}`} aria-expanded={sel === t.id} onClick={() => setSel(sel === t.id ? null : t.id)}>⋯</button>
          <span className="tamt num">{spend >= 1 ? rs(spend) : money >= 1 ? <span className="in">+{rs(money)}</span> : "—"}</span>
          <span className="tacts">
            <button className="linkbtn" onClick={() => start({ id: t.id, kind: "rename" }, t.name)}>Rename</button>
            <button className="linkbtn" onClick={() => start({ id: t.id, kind: "move" }, t.parent_id ?? "")}>Move</button>
            <button className="linkbtn" onClick={() => start({ id: t.id, kind: "add" })}>Add inside</button>
            <button className="linkbtn danger" disabled={!empty} title={empty ? "Delete this tag" : "Only an empty tag can be deleted"}
              onClick={() => { if (confirm(`Delete "${t.name}"?`)) void run(() => deleteTag(t.id)); }}>Delete</button>
          </span>
        </div>
        {editing === "move" && (
          <form className="tedit sub" style={{ paddingLeft: depth * 22 + 22 }}
            onSubmit={(e) => { e.preventDefault(); void run(() => updateTag(t.id, { parent_id: val || null })); }}>
            <span className="muted small">Move {t.name} under</span>
            <select value={val} onChange={(e) => setVal(e.target.value)} aria-label="New parent">
              <option value="">(top level)</option>
              {moveTargets(tree, t.id).map(([id, path]) => <option key={id} value={id}>{path}</option>)}
            </select>
            <button className="btn-primary">Move</button>
            <button type="button" className="btn-ghost" onClick={() => setMode(null)}>Cancel</button>
          </form>
        )}
        {editing === "add" && <AddForm depth={depth + 1} val={val} setVal={setVal} cancel={() => setMode(null)}
          save={() => run(() => createTag(t.id, val))} />}
        {kids.length > 0 && <ul className="tree">{kids.map((k) => node(k, depth + 1))}</ul>}
      </li>
    );
  };

  const roots = [...(tree.kids.get(null) ?? [])].sort((a, b) => (amt.get(b.id) ?? 0) - (amt.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  return (
    <main className="stack narrow">
      <div className="between wrap">
        <div>
          <h1 className="title">Tags</h1>
          <p className="lead">Every payment sits on one tag. A tag's total includes everything inside it.</p>
        </div>
        <DatePicker value={pick} onChange={setPick} first={first} last={monthOf(anchor)} />
      </div>
      {err && <div className="warn small">{err}</div>}
      <section className="panel">
        <ul className="tree root">{roots.map((r) => node(r, 0))}</ul>
        {mode?.id === null && mode.kind === "add"
          ? <AddForm depth={0} val={val} setVal={setVal} cancel={() => setMode(null)} save={() => run(() => createTag(null, val))} />
          : <button className="linkbtn more" onClick={() => start({ id: null, kind: "add" })}>+ New top-level tag</button>}
      </section>
    </main>
  );
}

function AddForm({ depth, val, setVal, save, cancel }: {
  depth: number; val: string; setVal: (v: string) => void; save: () => Promise<void>; cancel: () => void;
}) {
  return (
    <form className="tedit sub" style={{ paddingLeft: depth * 22 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="new tag name" aria-label="New tag name" />
      <button className="btn-primary" disabled={!val.trim()}>Add</button>
      <button type="button" className="btn-ghost" onClick={cancel}>Cancel</button>
    </form>
  );
}

/** Every tag outside `id`'s own branch, as "a › b". */
function moveTargets(tree: Tree, id: string): [string, string][] {
  const mine = within(tree, id);
  return [...tree.byId.keys()].filter((k) => !mine.has(k))
    .map((k) => [k, namesOf(tree, k).join(" › ")] as [string, string])
    .sort((a, b) => a[1].localeCompare(b[1]));
}
