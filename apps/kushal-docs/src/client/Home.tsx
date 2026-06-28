import { useMemo, useState } from "react";
import type { DocItem } from "../shared";
import { coverPage, isImage } from "../shared";
import { logout, thumbSrc } from "./api";
import { FileIcon } from "./FileIcon";

interface Props {
  items: DocItem[];
  loaded: boolean;
  onOpen: (id: string) => void;
  onAdd: () => void;
}

export function Home({ items, loaded, onOpen, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) for (const t of it.tags) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (activeTag && !it.tags.includes(activeTag)) return false;
      if (!needle) return true;
      return (
        it.name.toLowerCase().includes(needle) ||
        it.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [items, q, activeTag]);

  return (
    <div className="home">
      <header className="top">
        <h1>Kushal Docs</h1>
        <button className="icon-btn" onClick={() => logout().then(() => location.reload())} aria-label="Sign out">
          ⏻
        </button>
      </header>

      <div className="search-wrap">
        <input
          className="search"
          type="search"
          inputMode="search"
          placeholder="Search documents…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {allTags.length > 0 && (
        <div className="chips">
          <Chip label="All" active={!activeTag} onClick={() => setActiveTag(null)} />
          {allTags.map((t) => (
            <Chip key={t} label={t} active={activeTag === t} onClick={() => setActiveTag(t === activeTag ? null : t)} />
          ))}
        </div>
      )}

      {!loaded ? (
        <p className="empty">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="empty">
          {items.length === 0 ? "No documents yet. Tap + to add your first." : "Nothing matches."}
        </p>
      ) : (
        <div className="grid">
          {filtered.map((it) => {
            const cover = coverPage(it);
            return (
              <button key={it.id} className="card" onClick={() => onOpen(it.id)}>
                <div className="thumb">
                  {cover.hasThumb && isImage(cover.mime) ? (
                    <img src={thumbSrc(cover.id)} alt="" loading="lazy" />
                  ) : (
                    <FileIcon mime={cover.mime} />
                  )}
                  {it.pages.length > 1 && (
                    <span className="page-badge" aria-label={`${it.pages.length} pages`}>
                      ⧉ {it.pages.length}
                    </span>
                  )}
                </div>
                <div className="card-name">{it.name}</div>
                {it.tags.length > 0 && <div className="card-tags">{it.tags.join(" · ")}</div>}
              </button>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={onAdd} aria-label="Add document">
        +
      </button>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`chip${active ? " chip-on" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}
