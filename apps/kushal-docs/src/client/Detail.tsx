import { useEffect, useRef, useState } from "react";
import type { DocItem, DocPage } from "../shared";
import { isImage, isPdf } from "../shared";
import {
  addPagesToDoc,
  blobSrc,
  ensurePageView,
  pageDownloadSrc,
  removeDoc,
  removePage,
  thumbSrc,
  updateDoc,
  viewableSrc,
  type StagedPage,
} from "./api";
import { FileIcon } from "./FileIcon";
import { TagEditor } from "./TagEditor";

interface Props {
  item: DocItem;
  items: DocItem[];
  onBack: () => void;
  onChanged: (next: DocItem[]) => void;
  onDeleted: (next: DocItem[]) => void;
}

/** Image with a cheap thumbnail placeholder shown instantly, then the sharp
 *  view image faded in once it decodes. */
function ViewerImage({ page, alt }: { page: DocPage; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [page.id]);
  return (
    <div className="viewer-img">
      {page.hasThumb && (
        <img className="viewer-blur" src={thumbSrc(page.id)} alt="" aria-hidden="true" />
      )}
      <img
        className={`viewer-main${loaded ? " on" : ""}`}
        src={viewableSrc(page)}
        alt={alt}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Detail({ item, items, onBack, onChanged, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [tags, setTags] = useState<string[]>(item.tags);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const backfilled = useRef<Set<string>>(new Set());

  const suggestions = [...new Set(items.flatMap((i) => i.tags))].sort();
  const idx = Math.min(active, item.pages.length - 1);
  const page = item.pages[idx];
  const multi = item.pages.length > 1;

  // For older images that predate the view derivative, build one in the
  // background the first time it's viewed so the next open is fast.
  useEffect(() => {
    if (!page || page.hasView || !isImage(page.mime) || backfilled.current.has(page.id)) return;
    backfilled.current.add(page.id);
    ensurePageView(item, page, items).then((next) => {
      if (next) onChanged(next);
    });
  }, [page, item, items, onChanged]);

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

  const addPages = async (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const staged: StagedPage[] = files.map((file) => ({ file }));
      const next = await addPagesToDoc(item, staged, items);
      onChanged(next);
      setActive(item.pages.length); // jump to first newly added page
    } finally {
      setBusy(false);
    }
  };

  const delPage = async () => {
    if (busy) return;
    const last = item.pages.length === 1;
    const msg = last
      ? `Delete "${item.name}"? This removes the whole document.`
      : `Delete page ${idx + 1} of "${item.name}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const next = await removePage(item, page.id, items);
      if (last) onDeleted(next);
      else {
        onChanged(next);
        setActive((a) => Math.max(0, a - (idx === item.pages.length - 1 ? 1 : 0)));
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  };

  const delDoc = async () => {
    if (!confirm(`Delete "${item.name}" and all ${item.pages.length} page(s)? This can't be undone.`)) return;
    setBusy(true);
    try {
      const next = await removeDoc(item, items);
      onDeleted(next);
    } catch {
      setBusy(false);
    }
  };

  const downloadAll = () => {
    item.pages.forEach((p, i) => {
      setTimeout(() => triggerDownload(pageDownloadSrc(p, `${item.name}-${i + 1}`)), i * 500);
    });
  };

  return (
    <div className="detail">
      <header className="top">
        <button className="link" onClick={onBack}>
          ‹ Back
        </button>
        <h1 className="trunc">{item.name}</h1>
        <button className="icon-btn danger" onClick={delDoc} disabled={busy} aria-label="Delete document">
          🗑
        </button>
      </header>

      <div className="viewer">
        {isImage(page.mime) ? (
          <ViewerImage key={page.id} page={page} alt={`${item.name} — page ${idx + 1}`} />
        ) : isPdf(page.mime) ? (
          <iframe key={page.id} src={blobSrc(page.id)} title={item.name} className="pdf" />
        ) : (
          <div className="viewer-fallback">
            <FileIcon mime={page.mime} />
            <p>Preview not available.</p>
          </div>
        )}
        {multi && <span className="page-pill">{idx + 1} / {item.pages.length}</span>}
      </div>

      <div className="page-rail">
        {item.pages.map((p, i) => (
          <button
            key={p.id}
            className={`rail-thumb${i === idx ? " on" : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Page ${i + 1}`}
          >
            {p.hasThumb && isImage(p.mime) ? (
              <img src={thumbSrc(p.id)} alt="" loading="lazy" />
            ) : (
              <FileIcon mime={p.mime} />
            )}
            <span className="rail-num">{i + 1}</span>
          </button>
        ))}
        <button className="rail-add" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Add page">
          +
        </button>
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
            <div className="row">
              <button className="btn" onClick={() => cameraRef.current?.click()} disabled={busy}>
                📷 Add page
              </button>
              <a className="btn primary" href={pageDownloadSrc(page, item.name)}>
                ⬇ Download{multi ? ` page ${idx + 1}` : ""}
              </a>
            </div>
            {multi && (
              <button className="btn block" onClick={downloadAll}>
                ⬇ Download all {item.pages.length} pages
              </button>
            )}
            {multi && (
              <button className="btn danger-ghost block" onClick={delPage} disabled={busy}>
                Delete page {idx + 1}
              </button>
            )}
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => { addPages(e.target.files); e.target.value = ""; }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => { addPages(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
