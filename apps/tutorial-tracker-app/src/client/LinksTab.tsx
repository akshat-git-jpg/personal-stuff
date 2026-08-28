import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrackingLinks } from "./TrackingLinks";
import { MintLinks } from "./MintLinks";
import { ProgramForm } from "./ProgramForm";
import { deleteProgram, fetchPrograms } from "./programsApi";
import { creditWarnings } from "../worker/linkhealth";
import type { BoardRow } from "./api";
import type { Kind, ProgramRow } from "../worker/programs";

type View = "programs" | "tracking-links" | "mint-links" | "health";
function credit(program: ProgramRow) {
  if (!program.target_url) return { label: "—", className: "text-muted-foreground" };
  if (program.kind === "external") return { label: "not expected", className: "text-muted-foreground" };
  const missing = creditWarnings(program.target_url, program.kind).some((w) => w.code === "no_credit_marker");
  if (missing) return { label: "none found", className: "text-amber-700 dark:text-amber-400" };
  try { const match = new URL(program.target_url).search.match(/[?&](via|ref|referral|referrer|fpr|fp_ref|aff|aff_id|affiliate)=([^&]+)/i); return { label: match ? `${match[1]}=${match[2]}` : "tracking found", className: "text-emerald-700 dark:text-emerald-400" }; } catch { return { label: "none found", className: "text-amber-700" }; }
}
export function LinksTab({ rows, onSaved }: { rows: BoardRow[]; onSaved: () => void }) {
  const [view, setView] = useState<View>("programs");
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [form, setForm] = useState<{ initial: ProgramRow | null; kind: Kind } | null>(null);
  const [confirm, setConfirm] = useState<ProgramRow | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  async function load() { setLoading(true); setError(null); try { const payload = await fetchPrograms(); setPrograms(payload.programs); } catch (e) { const message = e instanceof Error ? e.message : "Could not load programs"; const status = /\((\d+)\)/.exec(message)?.[1]; setError({ message, status: status ? Number(status) : undefined }); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  async function importSheet() { try { const res = await fetch("/api/programs/import-from-sheet", { method: "POST", credentials: "same-origin" }); if (!res.ok) throw new Error(`Could not import (${res.status})`); const body = await res.json() as { imported: { affiliate: number; external: number }; issues?: string[] }; setImportResult(`Imported ${body.imported.affiliate} affiliate + ${body.imported.external} external.${body.issues?.length ? ` ${body.issues.join(" ")}` : ""}`); await load(); } catch (e) { setError({ message: e instanceof Error ? e.message : "Could not import" }); } }
  async function remove() { if (!confirm) return; try { await deleteProgram(confirm.slug); setConfirm(null); await load(); onSaved(); } catch (e) { setError({ message: e instanceof Error ? e.message : "Could not delete program" }); } }
  const unavailable = !!error && error.status !== 403;
  return <div className="max-w-6xl space-y-5 py-4" data-testid="links-tab">
    <div className="flex gap-1 border-b border-border" role="tablist">{([['programs', `Programs${loading ? "" : ` (${programs.length})`}`], ['tracking-links', 'Tracking links'], ['mint-links', 'Add · Tracking links'], ['health', 'Health']] as [View, string][]).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${view === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}</div>
    {view === "tracking-links" && <TrackingLinks />}
    {view === "mint-links" && <MintLinks rows={rows} onSaved={onSaved} />}
    {view === "health" && <p className="text-sm text-muted-foreground">Link health checks arrive with the guard.</p>}
    {view === "programs" && <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Programs</h2><p className="text-sm text-muted-foreground">Validated affiliate and external destinations.</p></div><div className="flex gap-2"><Button variant="outline" disabled={unavailable || error?.status === 403} title={unavailable ? "Programs could not load" : undefined} onClick={() => setForm({ initial: null, kind: "external" })}>Add external</Button><Button disabled={unavailable || error?.status === 403} title={unavailable ? "Programs could not load" : undefined} onClick={() => setForm({ initial: null, kind: "affiliate" })}><Plus /> Add affiliate</Button></div></div>
      {loading ? <p className="text-sm text-muted-foreground">Loading programs…</p> : error?.status === 403 ? <p className="text-sm text-destructive">You need the Admin role to manage links.</p> : error ? <div className="flex items-center gap-3 text-sm text-destructive"><span>{error.message}</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div> : programs.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6"><p className="text-sm text-muted-foreground">No programs yet.</p><Button className="mt-3" variant="outline" onClick={() => void importSheet()}>Import from the old sheet</Button>{importResult && <p className="mt-3 text-sm text-foreground">{importResult}</p>}</div> : <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/50 text-left text-muted-foreground"><tr>{["Program", "Type", "Destination", "Affiliate code", "Coupon", "Approval", "Last checked", ""].map((x) => <th className="px-3 py-2 font-medium" key={x}>{x}</th>)}</tr></thead><tbody className="divide-y divide-border">{programs.map((p) => { const code = credit(p); const tint = p.last_status === "no_credit" || p.last_status === "dead" ? "bg-destructive/5" : p.last_status === "unverifiable" ? "bg-warning/10" : ""; return <tr className={tint} key={p.slug}><td className="px-3 py-3 font-medium">{p.name}</td><td className="px-3 py-3 capitalize text-muted-foreground">{p.kind}</td><td className="max-w-48 px-3 py-3 break-all text-xs">{p.target_url || "—"}</td><td className={`px-3 py-3 ${code.className}`}>{code.label}</td><td className="px-3 py-3">{p.coupon_code || "—"}</td><td className="px-3 py-3 capitalize">{p.kind === "external" ? "—" : p.approval_status.replace("_", " ")}</td><td className="px-3 py-3 text-muted-foreground">{p.last_checked_at ? new Date(p.last_checked_at * 1000).toLocaleDateString() : "—"}</td><td className="px-3 py-3"><div className="flex gap-1"><Button size="xs" variant="outline" onClick={() => setForm({ initial: p, kind: p.kind })}>Edit</Button><Button size="xs" variant="ghost" className="text-destructive" onClick={() => setConfirm(p)}>Delete</Button></div></td></tr>; })}</tbody></table></div>}</section>}
    <Dialog open={!!form} onOpenChange={(open) => { if (!open) setForm(null); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{form?.initial ? "Edit program" : `Add ${form?.kind ?? ""} program`}</DialogTitle></DialogHeader>{form && <ProgramForm {...form} onClose={() => setForm(null)} onSaved={() => { void load(); onSaved(); }} />}</DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>Delete {confirm?.name}?</DialogTitle><DialogDescription>This removes the program catalogue entry. Existing links are not changed.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => void remove()}>Delete program</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
