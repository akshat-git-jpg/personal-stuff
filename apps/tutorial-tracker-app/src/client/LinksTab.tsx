import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TrackingLinks } from "./TrackingLinks";
import { MintLinks } from "./MintLinks";
import { ProgramForm } from "./ProgramForm";
import { LinkHealth } from "./LinkHealth";
import { ProgramsView } from "./ProgramsView";
import { deleteProgram, fetchPrograms } from "./programsApi";
import type { BoardRow } from "./api";
import type { Kind, ProgramRow } from "../worker/programs";

type View = "programs" | "tracking-links" | "mint-links" | "health";
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
  return <div className="max-w-6xl space-y-5 py-4" data-testid="links-tab">
    <div className="flex gap-1 border-b border-border" role="tablist">{([['programs', `Programs${loading ? "" : ` (${programs.length})`}`], ['tracking-links', 'Tracking links'], ['mint-links', 'Mint links'], ['health', 'Health']] as [View, string][]).map(([key, label]) => <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)} className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${view === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}</div>
    {view === "tracking-links" && <TrackingLinks />}
    {view === "mint-links" && <MintLinks rows={rows} onSaved={onSaved} />}
    {view === "health" && <LinkHealth onFix={(program) => setForm({ initial: program, kind: program.kind })} />}
    {view === "programs" && <ProgramsView
      programs={programs}
      loading={loading}
      error={error}
      importResult={importResult}
      onAdd={(kind) => setForm({ initial: null, kind })}
      onEdit={(program) => setForm({ initial: program, kind: program.kind })}
      onDelete={(program) => setConfirm(program)}
      onImport={() => void importSheet()}
      onRetry={() => void load()}
    />}
    <Dialog open={!!form} onOpenChange={(open) => { if (!open) setForm(null); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{form?.initial ? "Edit program" : `Add ${form?.kind ?? ""} program`}</DialogTitle></DialogHeader>{form && <ProgramForm {...form} onClose={() => setForm(null)} onSaved={() => { void load(); onSaved(); }} />}</DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>Delete {confirm?.name}?</DialogTitle><DialogDescription>This removes the program catalogue entry. Existing links are not changed.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="destructive" onClick={() => void remove()}>Delete program</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
