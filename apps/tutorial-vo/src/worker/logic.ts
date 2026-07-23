import type { SectionRow } from "./types";

export const TAKES_MAX = 4;
export const SPOKEN_MAX = 1200;
export const FLAG_MARKER = /\[(VERIFY|FILL):/;

export function takeKey(slug: string, id: string, version: number, n: number): string {
  return `${slug}/${id}/v${version}-t${n}.wav`;
}

export type MergeResult = { action: "insert" | "preserve" | "reset"; row: SectionRow };

export function mergePublish(
  existing: SectionRow | null,
  incoming: { id: string; version: number; demo: boolean; spoken_text: string },
  slug: string,
  now: string
): MergeResult {
  if (!existing) {
    return {
      action: "insert",
      row: {
        slug,
        id: incoming.id,
        version: incoming.version,
        demo: incoming.demo ? 1 : 0,
        spoken_text: incoming.spoken_text,
        takes_used: 0,
        locked: 0,
        take_key: null,
        updated_at: now,
      },
    };
  }

  if (existing.version === incoming.version) {
    return {
      action: "preserve",
      row: {
        slug,
        id: incoming.id,
        version: existing.version,
        demo: incoming.demo ? 1 : 0,
        spoken_text: existing.spoken_text, // preserve respells
        takes_used: existing.takes_used,
        locked: existing.locked,
        take_key: existing.take_key,
        updated_at: now,
      },
    };
  }

  return {
    action: "reset",
    row: {
      slug,
      id: incoming.id,
      version: incoming.version,
      demo: incoming.demo ? 1 : 0,
      spoken_text: incoming.spoken_text,
      takes_used: 0,
      locked: 0,
      take_key: null,
      updated_at: now,
    },
  };
}

export function canGenerate(row: SectionRow): { ok: true } | { ok: false; status: 409 | 429; error: string } {
  if (row.locked === 1) {
    return { ok: false, status: 409, error: "locked" };
  }
  if (row.takes_used >= TAKES_MAX) {
    return { ok: false, status: 429, error: "cap reached" };
  }
  return { ok: true };
}

export function validateRespell(text: string, locked: boolean): { ok: true } | { ok: false; status: 400 | 409; error: string } {
  if (locked) return { ok: false, status: 409, error: "locked" };
  if (!text.trim()) return { ok: false, status: 400, error: "empty" };
  if (text.length > SPOKEN_MAX) return { ok: false, status: 400, error: "too long" };
  if (FLAG_MARKER.test(text)) return { ok: false, status: 400, error: "contains flag marker" };
  return { ok: true };
}
