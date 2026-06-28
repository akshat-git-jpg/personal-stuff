import { useMemo, useRef, useState } from "react";
import type { DocItem } from "../shared";
import { addDoc, type StagedPage } from "./api";
import { TagEditor } from "./TagEditor";
import { FileIcon } from "./FileIcon";

interface Props {
  items: DocItem[];
  onSaved: (next: DocItem[]) => void;
  onCancel: () => void;
}

interface Staged {
  key: string;
  file: File;
  preview: string | null;
}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

export function AddSheet({ items, onSaved, onCancel }: Props) {
  const [pages, setPages] = useState<Staged[]>([]);
  const [name, setName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) for (const t of it.tags) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const pick = (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!files.length) return;
    if (!name) setName(stripExt(files[0].name));
    setPages((prev) => [
      ...prev,
      ...files.map((file) => ({
        key: crypto.randomUUID(),
        file,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      })),
    ]);
  };

  const removePage = (key: string) => {
    setPages((prev) => {
      const gone = prev.find((p) => p.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return prev.filter((p) => p.key !== key);
    });
  };

  const move = (key: string, dir: -1 | 1) => {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = async () => {
    if (!pages.length || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const staged: StagedPage[] = pages.map((p) => ({ file: p.file }));
      const next = await addDoc({ name: name.trim(), tags }, staged, items);
      onSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  };

  return (
    <div className="sheet">
      <header className="top">
        <button className="link" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <h1>New document</h1>
        <button className="link strong" onClick={save} disabled={!pages.length || !name.trim() || busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="sheet-body">
        <div className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aadhaar card" />
        </div>

        <div className="field">
          <span>
            Pages{pages.length > 0 && <em className="count"> · {pages.length}</em>}
          </span>
          <div className="page-strip">
            {pages.map((p, i) => (
              <div key={p.key} className="page-cell">
                <div className="page-thumb">
                  {p.preview ? <img src={p.preview} alt="" /> : <FileIcon mime={p.file.type} />}
                  <span className="page-num">{i + 1}</span>
                </div>
                <div className="page-ctrls">
                  <button onClick={() => move(p.key, -1)} disabled={i === 0 || busy} aria-label="Move left">‹</button>
                  <button className="del" onClick={() => removePage(p.key)} disabled={busy} aria-label="Remove">×</button>
                  <button onClick={() => move(p.key, 1)} disabled={i === pages.length - 1 || busy} aria-label="Move right">›</button>
                </div>
              </div>
            ))}
            <button className="page-add" onClick={() => fileRef.current?.click()} disabled={busy}>
              <span className="plus">+</span>
              <span>Add page</span>
            </button>
          </div>
          <div className="add-actions">
            <button className="ghost-btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
              📷 Camera
            </button>
            <button className="ghost-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
              🗂 Files
            </button>
          </div>
          <p className="hint">Add front &amp; back, or every page of a doc — they’re grouped under one name.</p>
        </div>

        <div className="field">
          <span>Tags</span>
          <TagEditor tags={tags} suggestions={suggestions} onChange={setTags} />
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
