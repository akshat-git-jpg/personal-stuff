import { useState, useEffect } from 'react';
import { effectiveReviewed, isAutoReviewed } from './reviewDefaults';

function getStorageKey(video: string) {
  return `board:reviewed:${video}`;
}

// Explicit UNticks. A plain reviewed-set cannot express "the owner deliberately
// reopened a card that defaults to ticked" — absence would mean both "never
// touched" and "turned off", and the default would keep re-ticking it on every
// reload. Kept in its own key so existing reviewed sets load unchanged.
function getOptOutKey(video: string) {
  return `board:unreviewed:${video}`;
}

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    // ignore
  }
  return new Set();
}

export function loadReviewed(video: string): Set<string> {
  return loadSet(getStorageKey(video));
}

export function loadUnreviewed(video: string): Set<string> {
  return loadSet(getOptOutKey(video));
}

export function saveReviewed(video: string, set: Set<string>) {
  localStorage.setItem(getStorageKey(video), JSON.stringify(Array.from(set)));
}

export function saveUnreviewed(video: string, set: Set<string>) {
  localStorage.setItem(getOptOutKey(video), JSON.stringify(Array.from(set)));
}

export function useReviewed(video: string) {
  const [reviewed, setReviewed] = useState<Set<string>>(() => loadReviewed(video));
  const [unreviewed, setUnreviewed] = useState<Set<string>>(() => loadUnreviewed(video));

  useEffect(() => {
    setReviewed(loadReviewed(video));
    setUnreviewed(loadUnreviewed(video));
  }, [video]);

  // `card` is optional so callers with no slug to hand still work; without it
  // the auto-review default simply cannot apply.
  const has = (rid: string, card?: string | null) =>
    effectiveReviewed({ rid, card, reviewed, unreviewed });

  const toggle = (rid: string, card?: string | null) => {
    const now = effectiveReviewed({ rid, card, reviewed, unreviewed });
    const nextReviewed = new Set(reviewed);
    const nextUnreviewed = new Set(unreviewed);
    if (now) {
      nextReviewed.delete(rid);
      // Only a card that would default back ON needs a recorded opt-out.
      if (isAutoReviewed(card)) nextUnreviewed.add(rid);
      else nextUnreviewed.delete(rid);
    } else {
      nextUnreviewed.delete(rid);
      nextReviewed.add(rid);
    }
    setReviewed(nextReviewed);
    setUnreviewed(nextUnreviewed);
    saveReviewed(video, nextReviewed);
    saveUnreviewed(video, nextUnreviewed);
  };

  const setAll = (rids: string[], on: boolean) => {
    const nextReviewed = new Set(reviewed);
    const nextUnreviewed = new Set(unreviewed);
    for (const rid of rids) {
      if (on) { nextReviewed.add(rid); nextUnreviewed.delete(rid); }
      else { nextReviewed.delete(rid); nextUnreviewed.add(rid); }
    }
    setReviewed(nextReviewed);
    setUnreviewed(nextUnreviewed);
    saveReviewed(video, nextReviewed);
    saveUnreviewed(video, nextUnreviewed);
  };

  // The counter must use the SAME rule as the checkboxes, so it takes the cue
  // list rather than the raw set size — an auto-reviewed card is ticked on
  // screen and has to count as ticked.
  const countFor = (entries: { rid: string; card?: string | null }[]) =>
    entries.filter(e => effectiveReviewed({ rid: e.rid, card: e.card, reviewed, unreviewed })).length;

  return { items: reviewed, unreviewed, has, toggle, count: reviewed.size, countFor, setAll };
}
