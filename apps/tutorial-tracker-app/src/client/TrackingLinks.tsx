import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { linkResync } from "./api";

export interface TrackingLink {
  slug: string; video_code: string; video_title: string; tool: string; target_url: string;
  kind: string | null; created_at: number; clicks: number; last_status: string | null;
  last_final_url: string | null; last_checked_at: number | null;
}
type LoadState = "loading" | "ready" | "forbidden" | "error";
const bad = new Set(["no_credit", "dead"]);

export function TrackingLinks() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<TrackingLink | null>(null);
  const [nextUrl, setNextUrl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setState("loading");
    try {
      const res = await fetch("/api/links", { credentials: "same-origin" });
      if (res.status === 403) { setState("forbidden"); return; }
      if (!res.ok) throw new Error("Unable to load tracking links.");
      const body = await res.json() as { links: TrackingLink[] };
      setLinks(body.links); setState("ready");
    } catch { setState("error"); }
  }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? links.filter((l) => `${l.slug} ${l.tool} ${l.video_title}`.toLowerCase().includes(needle)) : links;
  }, [links, query]);
  const groups = useMemo(() => Object.values(visible.reduce<Record<string, TrackingLink[]>>((out, link) => {
    (out[link.video_code] ??= []).push(link); return out;
  }, {})).sort((a, b) => b[0].created_at - a[0].created_at), [visible]);
  const metrics = {
    live: links.length,
    earning: links.filter((l) => l.kind === "affiliate" && !bad.has(l.last_status ?? "")).length,
    external: links.filter((l) => l.kind === "external").length,
    unverifiable: links.filter((l) => l.last_status === "unverifiable").length,
    broken: links.filter((l) => l.last_status === "dead").length,
  };
  async function saveDestination() {
    if (!editing) return;
    setSaving(true);
    try { await linkResync(editing.slug, nextUrl); setEditing(null); setConfirming(false); await load(); }
    finally { setSaving(false); }
  }
  async function recheckAll() { await fetch("/api/link-health/recheck", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }); await load(); }
  if (state === "loading") return <p className="text-sm text-muted-foreground">Loading tracking links…</p>;
  if (state === "forbidden") return <p className="text-sm text-destructive">You need the Admin role to see links.</p>;
  if (state === "error") return <div className="flex gap-3 text-sm text-destructive"><span>Unable to load tracking links.</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>;
  return <section className="space-y-4" data-testid="tracking-links">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Tracking links</h2><p className="text-sm text-muted-foreground">Every live short link, grouped by video.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void recheckAll()}>Re-check all now</Button><Button size="sm" variant="outline">Export CSV</Button></div></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Live links", metrics.live], ["Earning", metrics.earning], ["No programme", metrics.external], ["Cannot check", metrics.unverifiable], ["Broken", metrics.broken]].map(([label, value]) => <div className="rounded-lg border border-border bg-card px-3 py-2" key={String(label)}><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold tabular-nums">{value}</div></div>)}</div>
    <input aria-label="Search tracking links" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" placeholder="Search links, tools, or videos…" value={query} onChange={(e) => setQuery(e.target.value)} />
    {links.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No tracking links yet. Use Add -&gt; Tracking links for a video.</div> : groups.map((group) => <div className="overflow-x-auto rounded-lg border border-border" key={group[0].video_code}><div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2"><code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{group[0].video_code}</code><span className="font-medium">{group[0].video_title || "Untitled video"}</span><span className="text-xs text-muted-foreground">{group.length} links · {group.reduce((n, l) => n + l.clicks, 0)} clicks</span></div><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs text-muted-foreground"><tr>{["Short link", "Tool", "Type", "Lands on", "Clicks", "Checked", ""].map((h) => <th className="px-3 py-2 font-medium" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{group.map((l) => <tr className={l.last_status === "no_credit" || l.last_status === "dead" ? "bg-destructive/5" : l.last_status === "unverifiable" ? "bg-warning/10" : ""} key={l.slug}><td className="px-3 py-3 font-mono text-xs">/{l.slug}</td><td className="px-3 py-3">{l.tool}</td><td className="px-3 py-3 capitalize">{l.kind ?? "—"}</td><td className="max-w-60 px-3 py-3 break-all text-xs">{l.last_final_url ?? l.target_url}</td><td className="px-3 py-3 text-right tabular-nums">{l.clicks}</td><td className="px-3 py-3 text-xs text-muted-foreground">{l.last_status === null ? "program missing" : l.last_status === "no_credit" ? "lost code" : l.last_status}</td><td className="px-3 py-3"><Button size="xs" variant="outline" onClick={() => { setEditing(l); setNextUrl(l.last_final_url ?? l.target_url); }}>Edit</Button></td></tr>)}</tbody></table></div>)}
    <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setConfirming(false); } }}><DialogContent><DialogHeader><DialogTitle>Edit destination</DialogTitle><DialogDescription>Change where /{editing?.slug} redirects. This does not alter its click count.</DialogDescription></DialogHeader>{!confirming ? <><input aria-label="New destination" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={nextUrl} onChange={(e) => setNextUrl(e.target.value)} /><DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={!nextUrl.trim()} onClick={() => setConfirming(true)}>Review change</Button></DialogFooter></> : <><p className="break-all text-sm">Change <code>{editing?.target_url}</code> to <code>{nextUrl}</code>?</p><DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Back</Button><Button disabled={saving} onClick={() => void saveDestination()}>{saving ? "Saving…" : "Confirm destination"}</Button></DialogFooter></>}</DialogContent></Dialog>
  </section>;
}
