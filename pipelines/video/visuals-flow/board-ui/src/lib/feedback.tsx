import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

export type FeedbackItem = { text?: string; added?: string; folded?: string; image?: string; context?: unknown };

type State = {
  texts: Record<string, string>;               // current box contents, seeded from BoardData.feedback
  images: Record<string, string | null>;       // ONLY refs touched this session (dataURL | null=clear)
  dirty: boolean;
  // Bumped on every edit. An autosave captures it before the request and only
  // clears `dirty` if it has not moved — otherwise a keystroke landing mid-flight
  // would be marked saved and then dropped by the next markSaved().
  version: number;
};

// pure — vitest these:
export function validateImageFile(f: { type: string; size: number }): string | null {
  if (!f.type.startsWith('image/')) return 'not an image';
  if (f.size > 6 * 1024 * 1024) return 'image too large (max 6MB)';
  return null;
}

export function savePayloadFeedback(state: State): { feedback: Record<string, string>; feedbackImages?: State['images'] } {
  const out: { feedback: Record<string, string>; feedbackImages?: State['images'] } = { feedback: { ...state.texts } };
  if (Object.keys(state.images).length) out.feedbackImages = state.images;  // untouched refs never re-sent
  return out;
}

// Review rounds (owner report 2026-07-31): feedback used to be ONE slot per
// cue, so a folded round-1 item closed the box forever and a second review
// pass had nowhere to write. Folded rounds chain as `c20`, `c20#2`, `c20#3`…
// — every folded round stays visible as history, and the box binds to the
// first unfolded key. The server treats folded items as immutable and strips
// the `#N` suffix when resolving cue context, so round keys flow end to end.
export function feedbackRounds(refKey: string, items: Record<string, FeedbackItem>): {
  folded: { key: string; item: FeedbackItem }[]; activeKey: string;
} {
  const folded: { key: string; item: FeedbackItem }[] = [];
  let n = 1;
  let key = refKey;
  while (items[key]?.folded) {
    folded.push({ key, item: items[key] });
    n += 1;
    key = `${refKey}#${n}`;
  }
  return { folded, activeKey: key };
}

type FeedbackContextType = State & {
  items: Record<string, FeedbackItem>;
  setText: (ref: string, v: string) => void;
  attach: (ref: string, file: File) => void;
  clearImage: (ref: string) => void;
  markSaved: () => void;
  autosave: { status: 'idle' | 'saving' | 'saved' | 'error'; error: string | null };
};

// How long the box stays quiet before a write. Long enough that normal typing
// is one request rather than one per keystroke, short enough that a comment is
// safe by the time you have moved to the next tile.
export const AUTOSAVE_DEBOUNCE_MS = 800;

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within a FeedbackProvider');
  return ctx;
}

export function FeedbackProvider({ children, initialItems }: { children: ReactNode; initialItems?: Record<string, FeedbackItem> }) {
  const items = initialItems || {};
  
  // Seed texts from initialItems (skipping folded)
  const initialTexts: Record<string, string> = {};
  for (const [key, item] of Object.entries(items)) {
    if (!item.folded && item.text) {
      initialTexts[key] = item.text;
    }
  }

  const [state, setState] = useState<State>({
    texts: initialTexts,
    images: {},
    dirty: false,
    version: 0
  });
  const [autosave, setAutosave] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; error: string | null }>(
    { status: 'idle', error: null }
  );

  const stateRef = useRef(state);
  stateRef.current = state;
  const timer = useRef<number | null>(null);

  // Autosave (owner 2026-08-07: "whenever I'm giving feedback, I want
  // everything to be autosaved"). Posts to /feedback, which writes
  // feedback.json and feedback-images/ and nothing else — never cues.json, so
  // it can never un-approve the storyboard or trip over a half-typed fragment.
  useEffect(() => {
    if (!state.dirty) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      timer.current = null;
      const snapshot = stateRef.current;
      const sentVersion = snapshot.version;
      setAutosave({ status: 'saving', error: null });
      try {
        const res = await fetch('/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(savePayloadFeedback(snapshot)),
        });
        const data = await res.json();
        if (!data.ok) throw new Error((data.errors ?? ['save refused']).join('; '));
        setAutosave({ status: 'saved', error: null });
        // Only settle if nothing was typed while the request was in flight.
        setState(s => (s.version === sentVersion ? { ...s, images: {}, dirty: false } : s));
      } catch (err: any) {
        // Stay dirty on failure: the beforeunload guard below is then the last
        // thing standing between a network blip and lost review notes.
        setAutosave({ status: 'error', error: String(err?.message ?? err) });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [state.dirty, state.version]);

  useEffect(() => {
    if (!state.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Some browsers require this
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.dirty]);

  const setText = (ref: string, v: string) => {
    setState(s => ({
      ...s,
      texts: { ...s.texts, [ref]: v },
      dirty: true,
      version: s.version + 1
    }));
  };

  const attach = (ref: string, file: File) => {
    const error = validateImageFile(file);
    if (error) {
      alert(error);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setState(s => ({
          ...s,
          images: { ...s.images, [ref]: reader.result as string },
          dirty: true,
          version: s.version + 1
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (ref: string) => {
    setState(s => ({
      ...s,
      images: { ...s.images, [ref]: null },
      dirty: true,
      version: s.version + 1
    }));
  };

  const markSaved = () => {
    setState(s => ({
      ...s,
      images: {},
      dirty: false
    }));
  };

  return (
    <FeedbackContext.Provider value={{ ...state, items, setText, attach, clearImage, markSaved, autosave }}>
      {children}
    </FeedbackContext.Provider>
  );
}
