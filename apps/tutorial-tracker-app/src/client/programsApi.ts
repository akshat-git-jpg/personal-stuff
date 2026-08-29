/** Client calls for the affiliate/external catalogue. */
import type { ProgramRow, Kind } from "../worker/programs";

export interface ProgramsPayload {
  programs: ProgramRow[];
  vocab: { kinds: readonly string[]; networks: readonly string[]; approvalStatuses: readonly string[]; couponStatuses: readonly string[] };
}
export interface LinkWarning { code: string; message: string }
export interface ValidateResult { ok: boolean; value: string; error: string | null; warnings: LinkWarning[] }

async function postJSON(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
export async function fetchPrograms(): Promise<ProgramsPayload> {
  const res = await fetch("/api/programs", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Could not load programs (${res.status})`);
  return res.json() as Promise<ProgramsPayload>;
}
export async function validateTarget(target_url: string, kind: Kind): Promise<ValidateResult> {
  const res = await postJSON("/api/programs/validate", { target_url, kind });
  if (!res.ok) throw new Error(`Validation call failed (${res.status})`);
  return res.json() as Promise<ValidateResult>;
}
export async function saveProgram(input: Record<string, unknown>): Promise<{ ok: boolean; program: ProgramRow; warnings: LinkWarning[] }> {
  const res = await postJSON("/api/programs", input);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || `Could not save (${res.status})`);
  }
  return res.json() as Promise<{ ok: boolean; program: ProgramRow; warnings: LinkWarning[] }>;
}
export async function deleteProgram(slug: string): Promise<void> {
  const res = await fetch(`/api/programs/${encodeURIComponent(slug)}`, { method: "DELETE", credentials: "same-origin" });
  if (!res.ok) throw new Error(`Could not delete (${res.status})`);
}
