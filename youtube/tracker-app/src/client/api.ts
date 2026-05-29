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
  viewingAs: { email: string; role: string | null } | null;
  readOnly?: boolean;
  notice?: string;
}

export interface TeamMember {
  name: string;
  email: string;
  role: string;
}

export interface MeData {
  email: string;
  role: string;
}

export interface ApprovalItem {
  row_id: string;
  video_title: string;
  stageCol: string;
  stage: string;
  assigneeEmail: string;
  row: Row;
}

export interface ApprovalsData {
  count: number;
  items: ApprovalItem[];
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

export async function getBoard(asUser?: string): Promise<BoardData> {
  const url = asUser
    ? `/api/board?asUser=${encodeURIComponent(asUser)}`
    : "/api/board";
  const res = await fetch(url, { credentials: "same-origin" });
  await throwOnError(res);
  return res.json() as Promise<BoardData>;
}

export async function getTeam(): Promise<TeamMember[]> {
  const res = await fetch("/api/team", { credentials: "same-origin" });
  if (!res.ok) return [];
  return res.json() as Promise<TeamMember[]>;
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

export async function getAuthMode(): Promise<{ dev: boolean }> {
  const res = await fetch("/api/auth-mode", { credentials: "same-origin" });
  if (!res.ok) return { dev: false };
  return res.json() as Promise<{ dev: boolean }>;
}

export async function getApprovals(): Promise<ApprovalsData> {
  const res = await fetch("/api/approvals", { credentials: "same-origin" });
  if (!res.ok) return { count: 0, items: [] };
  return res.json() as Promise<ApprovalsData>;
}
