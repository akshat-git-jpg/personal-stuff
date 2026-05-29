import type { Column } from "../shared/columns";
import type { Row } from "../shared/rbac";

// ── Types ──────────────────────────────────────────────────────────────────

export class UnauthorizedError extends Error {
  constructor() { super("Not authenticated"); this.name = "UnauthorizedError"; }
}

export class ForbiddenError extends Error {
  constructor() { super("You don't have permission to edit this field"); this.name = "ForbiddenError"; }
}

export interface BoardData {
  role: string;
  columns: Column[];
  rows: Row[];
}

export interface MeData {
  email: string;
  role: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 403) throw new ForbiddenError();
  const text = await res.text().catch(() => res.statusText);
  throw new Error(`HTTP ${res.status}: ${text}`);
}

// ── API wrappers ───────────────────────────────────────────────────────────

export async function getBoard(): Promise<BoardData> {
  const res = await fetch("/api/board", { credentials: "same-origin" });
  await throwOnError(res);
  return res.json() as Promise<BoardData>;
}

export async function updateCell(row_id: string, col: Column, value: string): Promise<void> {
  const res = await fetch("/api/update", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row_id, col, value }),
  });
  await throwOnError(res);
}

export async function getMe(): Promise<MeData> {
  const res = await fetch("/api/me", { credentials: "same-origin" });
  await throwOnError(res);
  return res.json() as Promise<MeData>;
}

export async function logout(): Promise<void> {
  const res = await fetch("/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  // 302/redirect is fine; just ignore body
  if (!res.ok && res.status !== 302) {
    throw new Error(`Logout failed: ${res.status}`);
  }
}
