import { useState } from "react";
import type { DocItem } from "../shared";
import { isImage, isPdf } from "../shared";
import { blobSrc, downloadSrc, removeDoc, updateDoc } from "./api";
import { FileIcon } from "./FileIcon";
import { TagEditor } from "./TagEditor";

interface Props {
  item: DocItem;
  items: DocItem[];
  onBack: () => void;
  onChanged: (next: DocItem[]) => void;
  onDeleted: (next: DocItem[]) => void;
}

export function Detail({ item, items, onBack, onChanged, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [tags, setTags] = useState<string[]>(item.tags);
  const [busy, setBusy] = useState(false);

  const suggestions = [...new Set(items.flatMap((i) => i.tags))].sort();

  const saveEdits = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const next = await updateDoc({ ...item, name: name.trim(), tags }, items);
      onChanged(next);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      const next = await removeDoc(item.id, items);
      onDeleted(next);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="detail">
      <header className="top">
        <button className="link" onClick={onBack}>
          ‹ Back
        </button>
        <h1 className="trunc">{item.name}</h1>
        <button className="icon-btn danger" onClick={del} disabled={busy} aria-label="Delete">
          🗑
        </button>
      </header>

      <div className="viewer">
        {isImage(item.mime) ? (
          <img src={blobSrc(item.id)} alt={item.name} />
        ) : isPdf(item.mime) ? (
          <iframe src={blobSrc(item.id)} title={item.name} className="pdf" />
        ) : (
          <div className="viewer-fallback">
            <FileIcon mime={item.mime} />
            <p>Preview not available.</p>
          </div>
        )}
      </div>

      <div className="detail-meta">
        {editing ? (
          <>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="field">
              <span>Tags</span>
              <TagEditor tags={tags} suggestions={suggestions} onChange={setTags} />
            </div>
            <div className="row">
              <button className="btn" onClick={() => { setEditing(false); setName(item.name); setTags(item.tags); }} disabled={busy}>
                Cancel
              </button>
              <button className="btn primary" onClick={saveEdits} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="meta-row">
              <div className="meta-tags">
                {item.tags.length ? item.tags.map((t) => <span key={t} className="tag-pill static">{t}</span>) : <span className="muted">No tags</span>}
              </div>
              <button className="link" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
            <a className="btn primary block" href={downloadSrc(item)}>
              Download
            </a>
          </>
        )}
      </div>
    </div>
  );
}
