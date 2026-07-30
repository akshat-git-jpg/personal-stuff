import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type FeedbackItem = { text?: string; added?: string; folded?: string; image?: string; context?: unknown };

type State = {
  texts: Record<string, string>;               // current box contents, seeded from BoardData.feedback
  images: Record<string, string | null>;       // ONLY refs touched this session (dataURL | null=clear)
  dirty: boolean;
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

type FeedbackContextType = State & {
  items: Record<string, FeedbackItem>;
  setText: (ref: string, v: string) => void;
  attach: (ref: string, file: File) => void;
  clearImage: (ref: string) => void;
  markSaved: () => void;
};

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
    dirty: false
  });

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
      dirty: true
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
          dirty: true
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = (ref: string) => {
    setState(s => ({
      ...s,
      images: { ...s.images, [ref]: null },
      dirty: true
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
    <FeedbackContext.Provider value={{ ...state, items, setText, attach, clearImage, markSaved }}>
      {children}
    </FeedbackContext.Provider>
  );
}
