import { useMemo, useRef, useState } from "react";
import type { DocItem } from "../shared";
import { addDoc } from "./api";
import { makeThumbnail } from "./thumbnail";
import { TagEditor } from "./TagEditor";

interface Props {
  items: DocItem[];
  onSaved: (next: DocItem[]) => void;
  onCancel: () => void;
}

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

export function AddSheet({ items, onSaved, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    if (!name) setName(stripExt(f.name));
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const save = async () => {
    if (!file || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const thumb = await makeThumbnail(file);
      const item: DocItem = {
        id,
        name: name.trim(),
        tags,
        mime: file.type || "application/octet-stream",
        filename: file.name,
        size: file.size,
        hasThumb: !!thumb,
        createdAt: new Date().toISOString(),
      };
      const next = await addDoc(item, file, thumb, items);
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
        <h1>Add document</h1>
        <button className="link strong" onClick={save} disabled={!file || !name.trim() || busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="sheet-body">
        {!file ? (
          <div className="picker">
            <button className="big-btn" onClick={() => cameraRef.current?.click()}>
              📷 Take a photo
            </button>
            <button className="big-btn" onClick={() => fileRef.current?.click()}>
              🗂 Choose photo or PDF
            </button>
          </div>
        ) : (
          <div className="preview">
            {preview ? (
              <img src={preview} alt="preview" />
            ) : (
              <div className="preview-file">{file.name}</div>
            )}
            <button className="link" onClick={() => { setFile(null); setPreview(null); }} disabled={busy}>
              Change file
            </button>
          </div>
        )}

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aadhaar card" />
        </label>

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
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
