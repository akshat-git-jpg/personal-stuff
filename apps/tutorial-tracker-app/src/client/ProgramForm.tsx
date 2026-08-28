import { useEffect, useState } from "react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APPROVAL_LABELS, APPROVAL_STATUSES, COUPON_LABELS, COUPON_STATUSES, KINDS, NETWORK_LABELS, NETWORKS, toSlug, type Kind, type ProgramRow } from "../worker/programs";
import { saveProgram, validateTarget, type ValidateResult } from "./programsApi";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";
type Draft = Record<string, string | number>;
function draftOf(initial: ProgramRow | null, kind: Kind): Draft {
  return initial ? {
    name: initial.name, slug: initial.slug, kind: initial.kind, target_url: initial.target_url, network: initial.network,
    approval_status: initial.approval_status, coupon_status: initial.coupon_status, coupon_code: initial.coupon_code,
    coupon_url: initial.coupon_url, coupon_terms: initial.coupon_terms, dashboard_url: initial.dashboard_url,
    dashboard_credentials: initial.dashboard_credentials, notes: initial.notes, probe_enabled: initial.probe_enabled,
  } : { name: "", slug: "", kind, target_url: "", network: "website", approval_status: "unknown", coupon_status: "unknown", coupon_code: "", coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1 };
}
export function ProgramForm({ initial, kind, onClose, onSaved }: { initial: ProgramRow | null; kind: Kind; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(initial, kind));
  const [verdict, setVerdict] = useState<ValidateResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isExternal = draft.kind === "external";
  const target = String(draft.target_url);
  const update = (key: string, value: string | number) => setDraft((d) => {
    const next = { ...d, [key]: value };
    if (key === "name" && !initial) next.slug = toSlug(String(value));
    return next;
  });
  async function check() {
    if (!target.trim()) { setVerdict({ ok: true, value: "", error: null, warnings: [] }); return; }
    try { setVerdict(await validateTarget(target, draft.kind as Kind)); } catch (e) { setVerdict({ ok: false, value: target, error: e instanceof Error ? e.message : "Could not validate link", warnings: [] }); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void check(); }, 500);
    return () => window.clearTimeout(timer);
  }, [target, draft.kind]);
  const canSave = !saving && (!verdict || verdict.ok);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true); setError(null);
    try { await saveProgram({ ...draft, target_url: verdict?.value ?? target, probe_enabled: Number(draft.probe_enabled) }); onSaved(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save program"); }
    finally { setSaving(false); }
  }
  const field = (label: string, key: string, extra?: React.ReactNode) => <label className="grid gap-1 text-sm font-medium text-foreground">{label}<Input value={String(draft[key] ?? "")} onChange={(e) => update(key, e.target.value)} />{extra}</label>;
  return <form className="space-y-4" onSubmit={(e) => void submit(e)}>
    <div className="grid gap-4 sm:grid-cols-2">
      {field("Name", "name")}
      <label className="grid gap-1 text-sm font-medium">Slug<Input value={String(draft.slug)} readOnly={!!initial} onChange={(e) => update("slug", e.target.value)} /></label>
      <label className="grid gap-1 text-sm font-medium">Type<select className={inputCls} value={String(draft.kind)} onChange={(e) => update("kind", e.target.value)}>{KINDS.map((v) => <option key={v} value={v}>{v === "affiliate" ? "Affiliate" : "External"}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-medium">Network<select className={inputCls} value={String(draft.network)} onChange={(e) => update("network", e.target.value)}>{NETWORKS.map((v) => <option key={v} value={v}>{NETWORK_LABELS[v]}</option>)}</select></label>
    </div>
    <label className="grid gap-1 text-sm font-medium">Destination URL<Input value={target} onChange={(e) => update("target_url", e.target.value)} onBlur={() => void check()} /></label>
    <div aria-live="polite" className="text-sm">{!target.trim() ? <p className="text-muted-foreground">No link yet — this programme cannot be published.</p> : verdict && !verdict.ok ? <p className="text-destructive">{verdict.error}</p> : verdict ? <><p className="text-emerald-700 dark:text-emerald-400">{verdict.warnings.length ? "" : "Checks passed"}</p>{verdict.warnings.map((w) => <p className="text-amber-700 dark:text-amber-400" key={w.code}>{w.message}</p>)}{verdict.value !== target && <p className="text-muted-foreground">Saving as: {verdict.value}</p>}</> : null}</div>
    {isExternal ? <p className="rounded-md border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">No affiliate programme, so no code check runs — a plain homepage is correct here.</p> : <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Approval status<select className={inputCls} value={String(draft.approval_status)} onChange={(e) => update("approval_status", e.target.value)}>{APPROVAL_STATUSES.map((v) => <option key={v} value={v}>{APPROVAL_LABELS[v]}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Coupon status<select className={inputCls} value={String(draft.coupon_status)} onChange={(e) => update("coupon_status", e.target.value)}>{COUPON_STATUSES.map((v) => <option key={v} value={v}>{COUPON_LABELS[v]}</option>)}</select></label>{field("Coupon code", "coupon_code")}{field("Coupon URL", "coupon_url")}{field("Coupon terms", "coupon_terms")}</div>}
    <div className="grid gap-4 sm:grid-cols-2">{field("Dashboard URL", "dashboard_url")}<label className="grid gap-1 text-sm font-medium">Dashboard credentials<textarea className={inputCls + " h-20 py-2"} value={String(draft.dashboard_credentials)} onChange={(e) => update("dashboard_credentials", e.target.value)} /></label></div>
    <label className="grid gap-1 text-sm font-medium">Notes<textarea rows={4} className={inputCls + " h-auto py-2"} value={String(draft.notes)} onChange={(e) => update("notes", e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={Number(draft.probe_enabled) === 1} onChange={(e) => update("probe_enabled", e.target.checked ? 1 : 0)} /> Run health probe</label>
    {error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!canSave}>{saving ? "Saving…" : "Save program"}</Button></div>
  </form>;
}
