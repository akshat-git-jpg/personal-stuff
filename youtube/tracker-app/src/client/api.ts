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
  role: string;                         // legacy single role string
  roles: string[];                      // multi-role array
  stages: { statusCol: string; role: string }[]; // worker stages for this user
  columns: Column[];
  rows: Row[];
  viewingAs: { email: string; role: string | null } | null;
  readOnly?: boolean;
  notice?: string;
  names?: Record<string, string>;
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
  names?: Record<string, string>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 403) throw new ForbiddenError();
  const text = await res.text().catch(() => res.statusText);
  throw new Error(`HTTP ${res.status}: ${text}`);
}

/**
 * Resolve a human-readable display name from the names map.
 * Falls back to the username part of the email, then the raw value.
 */
export function displayName(email: string, names?: Record<string, string>): string {
  if (!email) return "";
  const key = email.trim().toLowerCase();
  if (names && names[key]) return names[key];
  return (email.includes("@") ? email.split("@")[0] : email) || email;
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

export async function review(
  row_id: string,
  stage: "script" | "tutorial" | "editor" | "upload",
  action: "approve" | "sendback",
  feedback?: string,
): Promise<void> {
  const res = await fetch("/api/review", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row_id, stage, action, feedback }),
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
  if (!res.ok) return { count: 0, items: [], names: {} };
  return res.json() as Promise<ApprovalsData>;
}
