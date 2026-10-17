// Pure helpers for the review screen: time format, script lines, what is on screen at a time.
import type { Card, Item, Part, Word } from './api';

export function clock(t: number, frac = false): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const ss = frac ? sec.toFixed(2).padStart(5, '0') : String(Math.floor(sec)).padStart(2, '0');
  return `${m}:${ss}`;
}

export interface Line { start: number; end: number; text: string }

// Sentences, split on end punctuation, a long pause, or length.
export function groupLines(words: Word[], maxWords = 30, pause = 1.2): Line[] {
  const lines: Line[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) lines.push({ start: cur[0][0], end: cur[cur.length - 1][1], text: cur.map((w) => w[2]).join(' ') });
    cur = [];
  };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (prev && w[0] - prev[1] > pause) flush();
    cur.push(w);
    if (/[.?!]["')]?$/.test(w[2]) || cur.length >= maxWords) flush();
  }
  flush();
  return lines;
}

export function lineAt(lines: Line[], t: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start <= t + 0.05) idx = i; else break;
  }
  return idx;
}

// The words spoken around a moment, so a comment names what was being said.
export function sayingAt(words: Word[], t: number, span = 2): string {
  const near = words.filter((w) => w[1] >= t - span && w[0] <= t + span);
  if (!near.length) return '';
  const cut = near.length > 12 ? near.slice(Math.max(0, near.findIndex((w) => w[1] >= t) - 5)).slice(0, 12) : near;
  return cut.map((w) => w[2]).join(' ');
}

export function partAt(parts: Part[], t: number): number {
  let idx = 0;
  parts.forEach((p, i) => { if (p.start <= t) idx = i; });
  return idx;
}

export function cardAt(cards: Card[], t: number): Card | null {
  const on = cards.filter((c) => t >= c.start && t <= c.start + c.duration);
  if (on.length) return on[on.length - 1];
  const near = cards.filter((c) => Math.abs(c.start - t) <= 3).sort((a, b) => Math.abs(a.start - t) - Math.abs(b.start - t));
  return near[0] ?? null;
}

export const isOpen = (i: Item) => !i.folded && !i.applied && !i.deferred;

export interface Comment extends Item { key: string; version: string; n: number }

export function comments(items: Record<string, Item>): Comment[] {
  const out: Comment[] = [];
  for (const [key, item] of Object.entries(items)) {
    const m = /^final-(v\d+):(\d+)$/.exec(key);
    if (!m) continue;
    out.push({ ...item, key, version: m[1], n: Number(m[2]) });
  }
  return out.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

// Pin numbers count within one version, in time order, like the old board.
export function pinNumbers(list: Comment[]): Map<string, number> {
  const seen = new Map<string, number>();
  const out = new Map<string, number>();
  for (const c of list) {
    const n = (seen.get(c.version) ?? 0) + 1;
    seen.set(c.version, n);
    out.set(c.key, n);
  }
  return out;
}

// Ruler ticks that keep about one label per 90px.
export function tickStep(span: number, widthPx: number): number {
  const want = span / Math.max(1, widthPx / 90);
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
  return steps.find((s) => s >= want) ?? 3600;
}

export function zoomWindow(win: [number, number], factor: number, center: number, duration: number): [number, number] {
  const span = Math.min(duration, Math.max(5, (win[1] - win[0]) * factor));
  let a = center - (center - win[0]) * (span / (win[1] - win[0]));
  a = Math.max(0, Math.min(duration - span, a));
  return [a, a + span];
}
