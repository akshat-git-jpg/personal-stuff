import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { clock, isOpen, pinNumbers, type Comment } from '../lib/review';

export type Tab = 'open' | 'fixed' | 'notes';

export interface Draft { t: number; saying: string; part: string; card: string }

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  list: Comment[];
  version: string | null;
  selected: string | null;
  draft: Draft | null;
  onCancelDraft: () => void;
  onSave: (text: string, why: string, images: string[]) => Promise<void>;
  onSeek: (t: number) => void;
  onSelect: (key: string) => void;
  onEdit: (key: string, text: string, why: string) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  imageUrl: (key: string, n: number) => string;
  notes: string;
  notesEnabled: boolean;
  onNotes: (text: string) => Promise<void>;
}

const readImage = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result));
  r.onerror = rej;
  r.readAsDataURL(f);
});

function Composer({ draft, onSave, onCancel }: { draft: Draft; onSave: Props['onSave']; onCancel: () => void }) {
  const [text, setText] = useState('');
  const [why, setWhy] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, [draft.t]);

  const addFiles = async (files: FileList | File[]) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'));
    const urls = await Promise.all(imgs.map(readImage));
    setImages((cur) => [...cur, ...urls]);
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith('image/'))) { e.preventDefault(); void addFiles(files); }
  };
  const save = async () => {
    if (!text.trim()) { setError('Write what to change first.'); return; }
    setBusy(true); setError('');
    try { await onSave(text, why, images); } catch (e) { setError(String((e as Error).message)); setBusy(false); }
  };

  return (
    <div className="composer" onKeyDown={(e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
    }}>
      <div className="cmt-head">
        <span className="chip mono" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600, borderRadius: 5 }}>PIN {clock(draft.t, true)}</span>
        <span className="dim">new comment</span>
      </div>
      <div className="ctx">
        {draft.saying && <>Saying: <q>{draft.saying}</q><br /></>}
        Part: {draft.part}{draft.card && <> · Card: <span className="mono">{draft.card}</span></>}
      </div>
      <label className="eyebrow" htmlFor="what">What to change</label>
      <textarea id="what" ref={ref} rows={3} value={text} onChange={(e) => setText(e.target.value)} onPaste={onPaste} placeholder="Paste a screenshot here too" />
      <label className="eyebrow" htmlFor="why">Why (your reasoning)</label>
      <textarea id="why" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Helps Claude fix the cause, not only this spot" />
      {images.length > 0 && (
        <div className="shots">
          {images.map((src, i) => (
            <button key={i} className="btn small" style={{ height: 'auto', padding: 2 }} aria-label="Remove screenshot" onClick={() => setImages(images.filter((_, j) => j !== i))}>
              <img src={src} alt="Screenshot to attach" style={{ height: 48, borderRadius: 4 }} />
            </button>
          ))}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label className="btn small">
          Add screenshot
          <input type="file" accept="image/*" multiple className="sr" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
        </label>
        <div className="grow" />
        <button className="btn small" onClick={onCancel}>Cancel</button>
        <button className="btn small primary" disabled={busy} onClick={save}>Save <span className="key">Ctrl+Enter</span></button>
      </div>
    </div>
  );
}

function CommentCard({ c, n, selected, props }: { c: Comment; n: number; selected: boolean; props: Props }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.text);
  const [why, setWhy] = useState(c.why ?? '');
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const done = !isOpen(c);
  useEffect(() => { if (selected) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [selected]);

  return (
    <div ref={ref} className="cmt" aria-current={selected} onClick={() => props.onSelect(c.key)}>
      <div className="cmt-head">
        <span className={`num${done ? ' done' : ''}`}>{n}</span>
        {c.t !== undefined && <button className="timebtn" onClick={(e) => { e.stopPropagation(); props.onSeek(c.t!); }}>{clock(c.t)}</button>}
        <span className="chip plain mono" style={{ fontSize: 10, padding: '0 6px' }}>{c.version.toUpperCase()}</span>
        <div className="grow" />
        {!done && !editing && (
          <>
            <button className="btn small" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>Edit</button>
            <button className="btn small" aria-label="Delete comment" onClick={async (e) => {
              e.stopPropagation();
              if (!confirm('Delete this comment?')) return;
              try { await props.onDelete(c.key); } catch (err) { setError(String((err as Error).message)); }
            }}>Delete</button>
          </>
        )}
      </div>
      {editing ? (
        <>
          <label className="sr" htmlFor={`t-${c.key}`}>Comment</label>
          <textarea id={`t-${c.key}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <label className="sr" htmlFor={`w-${c.key}`}>Why</label>
          <textarea id={`w-${c.key}`} rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why (your reasoning)" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn small" onClick={() => { setEditing(false); setText(c.text); setWhy(c.why ?? ''); }}>Cancel</button>
            <button className="btn small primary" onClick={async () => {
              try { await props.onEdit(c.key, text, why); setEditing(false); } catch (err) { setError(String((err as Error).message)); }
            }}>Save</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{c.text}</div>
          {c.why && <div className="why">Why: {c.why}</div>}
        </>
      )}
      {!!c.images && (
        <div className="shots">
          {Array.from({ length: c.images }, (_, i) => (
            <a key={i} href={props.imageUrl(c.key, i)} target="_blank" rel="noreferrer"><img src={props.imageUrl(c.key, i)} alt={`Screenshot ${i + 1}`} /></a>
          ))}
        </div>
      )}
      {done && <div className="dim" style={{ fontSize: 11 }}>{c.folded ? `Folded ${String(c.folded).slice(0, 10)}` : c.applied ? `Fixed ${String(c.applied).slice(0, 10)}` : 'Parked'}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

function Notes({ notes, onNotes }: { notes: string; onNotes: Props['onNotes'] }) {
  const [text, setText] = useState(notes);
  const [state, setState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const timer = useRef<number>(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const save = async (v: string) => {
    setState('saving');
    try { await onNotes(v); setState('saved'); } catch { setState('error'); }
  };
  return (
    <div className="list">
      <label className="eyebrow" htmlFor="notes">Notes for this video</label>
      <textarea id="notes" rows={10} value={text} placeholder="Anything not tied to one moment" onChange={(e) => {
        setText(e.target.value); setState('dirty');
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void save(e.target.value), 900);
      }} onBlur={() => state === 'dirty' && void save(text)} />
      <span className="dim" style={{ fontSize: 11 }}>{{ saved: 'Saved', dirty: 'Typing', saving: 'Saving', error: 'Could not save' }[state]}</span>
    </div>
  );
}

export function Comments(props: Props) {
  const { tab, setTab, list, draft } = props;
  const open = list.filter(isOpen);
  const done = list.filter((c) => !isOpen(c));
  const versions = [...new Set(done.map((c) => c.version))].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  const [expanded, setExpanded] = useState<string | null>(null);
  const numberOf = pinNumbers(list);
  const tabs: [Tab, string, string][] = [['open', 'Open', String(open.length)], ['fixed', 'Fixed', String(done.length)]];
  if (props.notesEnabled) tabs.push(['notes', 'Notes', props.notes ? '1' : '']);

  return (
    <aside className="pane comments" aria-label="Comments">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label, count]) => (
          <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label} <span className="mono dim" style={{ fontSize: 11 }}>{count}</span>
          </button>
        ))}
      </div>
      <div className="pane-body">
        {tab === 'open' && (
          <div className="list">
            {draft && <Composer key={draft.t} draft={draft} onSave={props.onSave} onCancel={props.onCancelDraft} />}
            {!draft && !open.length && <div className="dim" style={{ padding: 8, lineHeight: 1.5 }}>No open comments. Press C to add one at the play head.</div>}
            {open.map((c) => <CommentCard key={c.key} c={c} n={numberOf.get(c.key)!} selected={props.selected === c.key} props={props} />)}
          </div>
        )}
        {tab === 'fixed' && (
          <div className="list">
            {!versions.length && <div className="dim" style={{ padding: 8 }}>Nothing fixed yet.</div>}
            {versions.map((v) => {
              const items = done.filter((c) => c.version === v);
              const isOpenGroup = (expanded ?? versions[0]) === v;
              return (
                <div key={v} className="group">
                  <button aria-expanded={isOpenGroup} onClick={() => setExpanded(isOpenGroup ? '' : v)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7ee2a6" strokeWidth="2.4" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                    <span style={{ flex: 1 }}>Comments on {v.toUpperCase()}</span>
                    <span className="mono dim">{items.length}</span>
                  </button>
                  {isOpenGroup && <div className="list">{items.map((c) => <CommentCard key={c.key} c={c} n={numberOf.get(c.key)!} selected={props.selected === c.key} props={props} />)}</div>}
                </div>
              );
            })}
          </div>
        )}
        {tab === 'notes' && <Notes notes={props.notes} onNotes={props.onNotes} />}
      </div>
    </aside>
  );
}
