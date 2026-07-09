import { useState } from "react";
import type { Owner } from "../shared";
import { AutoTextarea } from "./AutoTextarea";
import { DatePick } from "./DatePick";
import { tomorrowIST } from "./dates";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Inline quick-add: a paragraph box + inline deadline, pinned above the list.
 *  Deadline defaults to tomorrow. Owner is the currently-open tab.
 *  Enter adds; Shift+Enter makes a new line. */
export function QuickAdd({ owner, onAdd }: {
  owner: Owner;
  onAdd: (title: string, eta: string | null) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [eta, setEta] = useState<string | null>(tomorrowIST());
  const [busy, setBusy] = useState(false);

  async function submit() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onAdd(t, eta);
      setTitle("");
      setEta(tomorrowIST());
    } catch (e) { alert(String(e)); }
    finally { setBusy(false); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  return (
    <div className="quickadd">
      <AutoTextarea
        className="qa-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKey}
        placeholder={`Add a task for ${cap(owner)}…`}
      />
      <div className="qa-foot">
        <DatePick value={eta} onChange={setEta} />
        <span className="qa-spacer" />
        <button type="button" className="qa-add" onClick={submit}
          disabled={!title.trim() || busy} aria-label="add task">
          <span className="plus">+</span> Add
        </button>
      </div>
    </div>
  );
}
