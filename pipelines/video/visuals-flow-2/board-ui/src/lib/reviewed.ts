import { useState, useEffect } from 'react';

function getStorageKey(video: string) {
  return `board:reviewed:${video}`;
}

export function loadReviewed(video: string): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(video));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch (e) {
    // ignore
  }
  return new Set();
}

export function saveReviewed(video: string, set: Set<string>) {
  localStorage.setItem(getStorageKey(video), JSON.stringify(Array.from(set)));
}

export function useReviewed(video: string) {
  const [reviewed, setReviewed] = useState<Set<string>>(() => loadReviewed(video));

  useEffect(() => {
    setReviewed(loadReviewed(video));
  }, [video]);

  const has = (rid: string) => reviewed.has(rid);

  const toggle = (rid: string) => {
    setReviewed(prev => {
      const next = new Set(prev);
      if (next.has(rid)) {
        next.delete(rid);
      } else {
        next.add(rid);
      }
      saveReviewed(video, next);
      return next;
    });
  };

  const setAll = (rids: string[], on: boolean) => {
    setReviewed(prev => {
      const next = new Set(prev);
      for (const rid of rids) {
        if (on) next.add(rid);
        else next.delete(rid);
      }
      saveReviewed(video, next);
      return next;
    });
  };

  return { has, toggle, count: reviewed.size, setAll };
}
