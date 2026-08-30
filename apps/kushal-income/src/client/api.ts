// Client-side API wrappers + the shape of the statement snapshot.
//
// Mirrors what pipelines/personal-finance/emit.py writes. The figures are a
// snapshot from the last time a statement was ingested, never live — the UI must
// always say when, because a stale zero and a real zero look identical.

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

/** What a category does with money. Drives nothing but wording. */
export type Kind = "income" | "expense" | "unnamed";

export interface CategoryInfo {
  label: string;
  kind: Kind;
  count: number;
}

export interface MonthMoney {
  /** Everything that came in: salary, interest, and any unruled credit. */
  in: number;
  /** Closing balance after the last transaction of the month. */
  balance: number;
  /** Spend per category key. Absent keys mean nothing was spent, not zero-ish. */
  categories: Record<string, number>;
  /**
   * Who the unnamed money went to, biggest first, with a trailing "+N more".
   * This is the list the owner works down to shrink `unnamed` toward zero.
   */
  unnamed_payees: [string, number][];
}

export interface MoneyResponse {
  /** ISO timestamp of the last ingest, or null if nothing has been ingested. */
  generated_at: string | null;
  account: string | null;
  period: { from: string | null; to: string | null };
  months: Record<string, MonthMoney>;
  categories: Record<string, CategoryInfo>;
  totals: { in: number; out: number; net: number; balance: number };
}

export async function fetchMoney(): Promise<MoneyResponse> {
  const res = await fetch("/api/money", { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return (await res.json()) as MoneyResponse;
}

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    credentials: "same-origin",
  });
  if (res.status === 401) throw new Error("Wrong password");
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
}
