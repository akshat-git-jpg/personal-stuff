import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { linkResync } from "./api";

/**
 * Every live go.agrolloo short link, grouped by the video that carries it.
 *
 * Search / filter / sort deliberately mirror Filters.tsx on the All videos tab
 * and ProgramsView: one toolbar shape across the app, precise controls behind
 * "More filters", and header-click sorting. The owner asked for consistency
 * rather than a different pattern per screen.
 */

export interface TrackingLink {
  slug: string; video_code: string; video_title: string; tool: string; target_url: string;
  kind: string | null; created_at: number; clicks: number; last_status: string | null;
  last_final_url: string | null; last_checked_at: number | null;
}

type LoadState = "loading" | "ready" | "forbidden" | "error";
const bad = new Set(["no_credit", "dead"]);

/** Verbatim from Filters.tsx so every filter panel in the app matches. */
const selectCls = "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

type SortCol = "slug" | "tool" | "kind" | "lands" | "clicks" | "checked";
interface SortState { col: SortCol; dir: "asc" | "desc" }
type TypeFilter = "all" | "affiliate" | "external" | "unclassified";
type StateFilter = "all" | "earning" | "lost" | "unverifiable" | "dead" | "unmapped";

const COLUMNS: { col: SortCol | null; label: string; align?: string }[] = [
  { col: "slug", label: "Short link" },
  { col: "tool", label: "Tool" },
  { col: "kind", label: "Type" },
  { col: "lands", label: "Lands on" },
  { col: "clicks", label: "Clicks", align: "text-right" },
  { col: "checked", label: "Checked" },
  { col: null, label: "" },
];

/** The Checked column's words. `null` means the tool has no programme row. */
function checkedLabel(l: TrackingLink): string {
  if (l.last_status === null) return "program missing";
  if (l.last_status === "no_credit") return "lost code";
  return l.last_status;
}

function landsOn(l: TrackingLink): string {
  return l.last_final_url ?? l.target_url;
}

export function TrackingLinks() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [showMore, setShowMore] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
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

  // Same semantics as PipelineBoard: re-click flips direction; a new column
  // starts descending for counts and dates, ascending for text.
  function toggleSort(col: SortCol) {
    setSort((prev) => prev?.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: col === "clicks" || col === "checked" ? "desc" : "asc" });
  }
  const caret = (col: SortCol) => sort?.col === col
    ? (sort.dir === "asc" ? <ArrowUp className="inline size-3" /> : <ArrowDown className="inline size-3" />)
    : null;
  const ariaSort = (col: SortCol): "ascending" | "descending" | "none" =>
    sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const headCls = "text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground";

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return links.filter((l) => {
      if (typeFilter === "unclassified" ? l.kind : typeFilter !== "all" && l.kind !== typeFilter) return false;
      if (stateFilter === "earning" && (bad.has(l.last_status ?? "") || l.last_status === "unverifiable")) return false;
      if (stateFilter === "lost" && l.last_status !== "no_credit") return false;
      if (stateFilter === "unverifiable" && l.last_status !== "unverifiable") return false;
      if (stateFilter === "dead" && l.last_status !== "dead") return false;
      if (stateFilter === "unmapped" && l.last_status !== null) return false;
      if (!needle) return true;
      return `${l.slug} ${l.tool} ${l.video_title} ${landsOn(l)}`.toLowerCase().includes(needle);
    });
  }, [links, query, typeFilter, stateFilter]);

  // One sort state, applied inside every group, so the ordering is predictable
  // wherever you look. Groups themselves stay newest-video-first.
  const groups = useMemo(() => {
    const byCode = visible.reduce<Record<string, TrackingLink[]>>((out, link) => {
      (out[link.video_code] ??= []).push(link); return out;
    }, {});
    const dir = sort ? (sort.dir === "asc" ? 1 : -1) : 1;
    const cmp = (a: TrackingLink, b: TrackingLink) => {
      // Unsorted keeps the server's order (Array.sort is stable), so the list
      // looks the same as before anyone clicked a heading.
      if (!sort) return 0;
      switch (sort.col) {
        case "tool":    return dir * (a.tool.localeCompare(b.tool));
        case "kind":    return dir * ((a.kind ?? "").localeCompare(b.kind ?? "") || a.tool.localeCompare(b.tool));
        case "lands":   return dir * (landsOn(a).localeCompare(landsOn(b)) || a.tool.localeCompare(b.tool));
        case "clicks":  return dir * (a.clicks - b.clicks || a.tool.localeCompare(b.tool));
        case "checked": return dir * (checkedLabel(a).localeCompare(checkedLabel(b)) || a.tool.localeCompare(b.tool));
        default:        return dir * a.slug.localeCompare(b.slug);
      }
    };
    return Object.values(byCode)
      .map((g) => [...g].sort(cmp))
      .sort((a, b) => b[0].created_at - a[0].created_at);
  }, [visible, sort]);

  const metrics = {
    live: links.length,
    earning: links.filter((l) => l.kind === "affiliate" && !bad.has(l.last_status ?? "")).length,
    external: links.filter((l) => l.kind === "external").length,
    unverifiable: links.filter((l) => l.last_status === "unverifiable").length,
    broken: links.filter((l) => l.last_status === "dead").length,
  };

  const hasPrecise = typeFilter !== "all" || stateFilter !== "all";
  const hasFilters = hasPrecise || query.trim() !== "";

  async function saveDestination() {
    if (!editing) return;
    setSaving(true);
    try { await linkResync(editing.slug, nextUrl); setEditing(null); setConfirming(false); await load(); }
    finally { setSaving(false); }
  }
  async function recheckAll() {
    await fetch("/api/link-health/recheck", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
    await load();
  }

  if (state === "loading") return <p className="text-sm text-muted-foreground">Loading tracking links…</p>;
  if (state === "forbidden") return <p className="text-sm text-destructive">You need the Admin role to see links.</p>;
  if (state === "error") {
    return <div className="flex gap-3 text-sm text-destructive">
      <span>Unable to load tracking links.</span>
      <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
    </div>;
  }

  return <section className="space-y-4" data-testid="tracking-links">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Tracking links</h2>
        <p className="text-sm text-muted-foreground">Every live short link, grouped by video.</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => void recheckAll()}>Re-check all now</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {([["Live links", metrics.live], ["Earning", metrics.earning], ["No programme", metrics.external], ["Cannot check", metrics.unverifiable], ["Broken", metrics.broken]] as [string, number][]).map(([label, value]) => (
        <div className="rounded-lg border border-border bg-card px-3 py-2" key={label}>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold tabular-nums">{value}</div>
        </div>
      ))}
    </div>

    {/* Identical shape to Filters.tsx and ProgramsView. */}
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        id="t-q"
        type="search"
        placeholder="Search links, tools, or videos…"
        aria-label="Search tracking links"
        className="h-8 w-[240px] bg-transparent text-xs"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs tabular-nums text-muted-foreground" data-testid="link-count">
          {visible.length} shown
        </span>
        <Button variant="ghost" size="sm" type="button" aria-expanded={showMore}
          className={cn("h-8 gap-1.5", hasPrecise && "text-foreground")}
          onClick={() => setShowMore((o) => !o)}>
          <SlidersHorizontal className="size-3.5" /> More filters
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" type="button" className="h-8"
            onClick={() => { setQuery(""); setTypeFilter("all"); setStateFilter("all"); }}>
            Clear
          </Button>
        )}
      </div>
    </div>

    {(showMore || hasPrecise) && (
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground" htmlFor="t-type">Type</label>
          <select id="t-type" className={selectCls} value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
            <option value="all">All {metrics.live}</option>
            <option value="affiliate">Affiliate</option>
            <option value="external">External</option>
            <option value="unclassified">Unclassified</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground" htmlFor="t-state">State</label>
          <select id="t-state" className={selectCls} value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as StateFilter)}>
            <option value="all">Any state</option>
            <option value="earning">Earning {metrics.earning}</option>
            <option value="lost">Lost code</option>
            <option value="unverifiable">Cannot check {metrics.unverifiable}</option>
            <option value="dead">Broken {metrics.broken}</option>
            <option value="unmapped">Program missing</option>
          </select>
        </div>
      </div>
    )}

    {links.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No tracking links yet. Use Add -&gt; Tracking links for a video.
      </div>
    ) : groups.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        No links match those filters.{" "}
        <button type="button" className="underline"
          onClick={() => { setQuery(""); setTypeFilter("all"); setStateFilter("all"); }}>
          Clear filters
        </button>
      </div>
    ) : groups.map((group) => (
      <div className="overflow-x-auto rounded-lg border border-border" key={group[0].video_code}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{group[0].video_code}</code>
          <span className="font-medium">{group[0].video_title || "Untitled video"}</span>
          <span className="text-xs text-muted-foreground">
            {group.length} links · {group.reduce((n, l) => n + l.clicks, 0)} clicks
          </span>
        </div>
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left">
            <tr>
              {COLUMNS.map(({ col, label, align }) => (
                <th className={cn("px-3 py-2", align)} key={label || "actions"}
                  aria-sort={col ? ariaSort(col) : undefined}>
                  {col ? (
                    <button type="button" onClick={() => toggleSort(col)} title={`Sort by ${label}`}
                      className={cn(headCls, "hover:text-foreground", align === "text-right" && "w-full text-right")}>
                      {label} {caret(col)}
                    </button>
                  ) : <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.map((l) => (
              <tr key={l.slug} className={
                bad.has(l.last_status ?? "") ? "bg-destructive/5"
                  : l.last_status === "unverifiable" ? "bg-warning/10" : ""}>
                <td className="px-3 py-3 font-mono text-xs">/{l.slug}</td>
                <td className="px-3 py-3">{l.tool}</td>
                <td className="px-3 py-3 capitalize">{l.kind ?? "—"}</td>
                <td className="max-w-60 px-3 py-3 break-all text-xs">{landsOn(l)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{l.clicks}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{checkedLabel(l)}</td>
                <td className="px-3 py-3">
                  <Button size="xs" variant="outline"
                    onClick={() => { setEditing(l); setNextUrl(landsOn(l)); }}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ))}

    <Dialog open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setConfirming(false); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit destination</DialogTitle>
          <DialogDescription>Change where /{editing?.slug} redirects. This does not alter its click count.</DialogDescription>
        </DialogHeader>
        {!confirming ? <>
          <input aria-label="New destination" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={nextUrl} onChange={(e) => setNextUrl(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!nextUrl.trim()} onClick={() => setConfirming(true)}>Review change</Button>
          </DialogFooter>
        </> : <>
          <p className="break-all text-sm">Change <code>{editing?.target_url}</code> to <code>{nextUrl}</code>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>Back</Button>
            <Button disabled={saving} onClick={() => void saveDestination()}>{saving ? "Saving…" : "Confirm destination"}</Button>
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}
