// Client-side API wrappers + the shape of the revenue snapshot.
//
// Everything here mirrors what pipelines/income-analysis/ingest.py writes. The
// figures are a snapshot taken when `yt-income` last ran, never live — the UI
// must always say when, because a stale zero and a real zero look identical.

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

/** How strongly a tool row is claimed. Order matters: exact beats grouped beats inferred. */
export type Confidence = "confirmed" | "exact" | "grouped" | "matched" | "inferred";

export interface ToolRow {
  tool: string;
  amount: number;
  /** Hops before the bank, e.g. ["PartnerStack","Airwallex"]. The UI appends "Bank". */
  route: string[];
  confidence: Confidence;
  /** Only on PartnerStack rows: the INR/USD rate the match implied. */
  implied_fx?: number;
}

/** A network payout near an untraced credit — a place to start looking, not a claim. */
export interface Lead {
  source: string;
  what: string;
  gap_days: number;
  implied_fx: number | null;
}

/**
 * One line of untraced money. Untraced means "no tool name against it" — never
 * "we know nothing". Two kinds, and the kind says how much we already know:
 *
 *  - `credit` — an unclaimed bank credit. We know the date, the rail and the
 *    bank reference, and sometimes which network payouts were nearby.
 *  - `payer`  — an agency or processor paid us and we know exactly who, but an
 *    agency pays out for many brands, so the tool is still unknown. Naming the
 *    agency in the Tool column would claim the owner promotes it, which is
 *    false; the payer rides along as evidence instead.
 */
export type UntracedCredit =
  | {
      kind?: "credit";
      date: string;
      amount: number;
      rail: string;
      /** Display name of the rail, e.g. "Airwallex". Always known. */
      rail_label: string;
      /** Bank reference — quote it to the bank to ask who sent the money. */
      ref: string | null;
      leads: Lead[];
    }
  | {
      kind: "payer";
      amount: number;
      /** The payer as it appears on the transaction. */
      payer: string;
      /** Short readable name for that payer, e.g. "DigitalWorks". */
      via: string;
      note?: string | null;
      route: string[];
      confidence: Confidence;
      rail_label: string;
    };

export interface MonthRevenue {
  bank_total: number;
  rails: Record<string, number>;
  tools: ToolRow[];
  untraced: {
    amount: number;
    reasons: string[];
    credits: UntracedCredit[];
  };
}

export type SourceState = "connected" | "manual" | "stale" | "absent";

export interface SourceInfo {
  id: string;
  label: string;
  kind: string;
  state: SourceState;
  as_of?: string | null;
  note?: string;
}

export interface Statement {
  file: string;
  transactions: number;
  period_start: string | null;
  period_end: string | null;
}

export interface RevenueResponse {
  /** ISO timestamp of the last ingest, or null if nothing has been ingested. */
  generated_at: string | null;
  /** The months we can answer for. The date picker must not go past `to`. */
  coverage: { from: string | null; to: string | null };
  statements: Statement[];
  rails: Record<string, string>;
  sources: SourceInfo[];
  months: Record<string, MonthRevenue>;
  paypal_pending?: {
    as_of: string | null;
    holdings: { currency: string; total: string; available: string; withheld: string }[];
    total_any_currency: number;
  };
}

export async function fetchRevenue(): Promise<RevenueResponse> {
  const res = await fetch("/api/revenue", { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load revenue (${res.status})`);
  return (await res.json()) as RevenueResponse;
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
