// Client-side API wrappers + the shape of the ledger the Worker serves.
//
// Mirrors pipelines/personal-finance/ledger/build.py plus the owner's edits the
// Worker merges in. The data is only as fresh as the last sync, so the UI always
// says when that was.

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

export type Source = "sbi" | "sbic" | "neu" | "icici";
export type Status = "proven" | "confirmed" | "needs";
/** spend + refund + in count; bill (SBI -> card) and payment (card side) never do. */
export type Kind = "spend" | "in" | "refund" | "bill" | "payment";

export interface Row {
  id: string;
  source: Source;
  date: string;
  time: string | null;
  /** Negative = money out. Null when only a foreign amount is known yet. */
  amount: number | null;
  fx: string | null;
  kind: Kind;
  /** False = from a purchase email; the next statement confirms it. */
  final: boolean;
  text: string;
  payee: string;
  payee_key: string;
  tags: string[];
  desc: string | null;
  status: Status;
  why: string;
  stmt: string | null;
  maybe_dup?: boolean;
  /** Tagged from the owner-approved ride pattern, not from a receipt. */
  inferred?: boolean;
  /** Set when the payment falls in a trip (data/config.json "trips"), e.g. "varkala". */
  trip?: string;
  /** Everything known about the payment: UPI ID, bank, note, Google Pay payee, Rapido ride. */
  details?: string[];
}

export interface Check { ok: boolean; wait?: boolean; text: string; sub: string }

export interface Statement {
  id: string;
  source: Exclude<Source, "sbi">;
  period_from: string;
  period_to: string;
  stmt_date: string;
  due_date: string;
  prev: number;
  purchases: number;
  fees: number;
  payments: number;
  due: number;
  paid: { date: string | null; amount: number; note: string; row?: string } | null;
  rows: number;
  checks: Check[];
}

export interface SourceStatus {
  source: Source;
  name: string;
  ok: boolean;
  detail: string;
  pending: number;
  errors: string[];
  note?: string;
}

export interface Ledger {
  generated_at: string | null;
  rows: Row[];
  statements: Statement[];
  sources: SourceStatus[];
}

export async function fetchLedger(): Promise<Ledger> {
  const res = await fetch("/api/ledger", { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load (${res.status})`);
  return (await res.json()) as Ledger;
}

export async function tagRows(rowIds: string[], tags: string[], desc: string | null, always: boolean): Promise<void> {
  const res = await fetch("/api/tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row_ids: rowIds, tags, desc, always }),
    credentials: "same-origin",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Save failed (${res.status})`);
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
