import { useState } from "react";

interface Props {
  tags: string[];
  /** Tags already used across the library, offered as quick-add suggestions. */
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ tags, suggestions, onChange }: Props) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setDraft("");
  };
  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  const unused = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="tag-editor">
      <div className="tag-row">
        {tags.map((t) => (
          <span key={t} className="tag-pill">
            {t}
            <button onClick={() => remove(t)} aria-label={`Remove ${t}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        className="tag-input"
        value={draft}
        placeholder="Add a tag, press Enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
      />
      {unused.length > 0 && (
        <div className="tag-suggest">
          {unused.map((s) => (
            <button key={s} className="tag-chip" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
