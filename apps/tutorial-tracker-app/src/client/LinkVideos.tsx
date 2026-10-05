import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { linkResync } from "./api";
import type { ProgramRow } from "../worker/programs";

/** Links → Videos: the problems to fix, then every video's links ready to copy. */

export interface VideoLink { slug: string; tool: string; name: string; short_url: string; target_url: string }
export interface LinkVideo { video_code: string; title: string; yt_video_id: string | null; created_at: number; description: string; links: VideoLink[] }
export interface Issue { code: string; slug: string; detail: string; url?: string }
interface Payload { videos: LinkVideo[]; issues: Issue[]; checked_at: number | null; programs: ProgramRow[] }
type LoadState = "loading" | "ready" | "forbidden" | "error";

/** Problems that lose money right now are listed first. */
const URGENT = new Set(["no_credit_marker", "points_at_dashboard", "bad_url", "kv_d1_mismatch", "desc_unknown_link"]);
const SHOW_FIRST = 5;

/** One plain sentence per problem; the guard's own wording is kept for the rest. */
const PLAIN: Record<string, string> = {
  no_credit_marker: "This link has no affiliate code, so clicks earn nothing. Save your referral link in the programme.",
  approved_no_link: "You are approved, but no link is saved yet.",
  points_at_dashboard: "This link opens your own dashboard, not a sign-up page.",
  bad_url: "This link is broken.",
  kv_d1_mismatch: "This short link does not open the page it should.",
  duplicate_target: "Another programme uses the same link.",
  link_without_program: "This tool is missing from Programs.",
  own_redirect_layer: "This link goes through agrolloo.com first. Use the tool's own link.",
  unmapped_video: "This video has clicks but no YouTube link. Add the YouTube link to its card.",
};
export const plainDetail = (issue: Issue) => PLAIN[issue.code] ?? issue.detail;

/** An issue belongs to a link when its slug is the link's slug or the link's tool. */
const issuesForLink = (issues: Issue[], link: VideoLink) => issues.filter((i) => i.slug === link.slug || i.slug === link.tool);
const studioUrl = (id: string) => `https://studio.youtube.com/video/${id}/edit`;

function ago(seconds: number): string {
  const mins = Math.round((Date.now() / 1000 - seconds) / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(seconds * 1000).toLocaleDateString();
}

function CopyButton({ text, label, size = "xs" }: { text: string; label: string; size?: "xs" | "sm" }) {
  const [done, setDone] = useState(false);
  return (
    <Button size={size} variant="outline" type="button" aria-label={`${label}`}
      onClick={() => { void navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {done ? "Copied" : label}
    </Button>
  );
}

export function LinkVideos({ focusCode, onFixProgram }: { focusCode?: string | null; onFixProgram: (program: ProgramRow) => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set(focusCode ? [focusCode] : []));
  const [showAll, setShowAll] = useState(false);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState<LinkVideo | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/links", { credentials: "same-origin" });
      if (res.status === 403) { setState("forbidden"); return; }
      if (!res.ok) throw new Error();
      setData(await res.json() as Payload); setState("ready");
    } catch { setState("error"); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (state === "ready") focusRef.current?.scrollIntoView?.({ block: "start" }); }, [state]);

  async function checkAgain() {
    setChecking(true);
    try {
      await fetch("/api/link-health/recheck", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
      await load();
    } finally { setChecking(false); }
  }

  const videos = data?.videos ?? [];
  const issues = useMemo(() => [...(data?.issues ?? [])].sort((a, b) => Number(URGENT.has(b.code)) - Number(URGENT.has(a.code))), [data]);
  const videoByCode = useMemo(() => new Map(videos.map((v) => [v.video_code, v])), [videos]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return videos;
    return videos.filter((v) => `${v.title} ${v.video_code} ${v.links.map((l) => `${l.tool} ${l.name}`).join(" ")}`.toLowerCase().includes(needle));
  }, [videos, query]);

  if (state === "loading") return <p className="text-sm text-muted-foreground">Loading links…</p>;
  if (state === "forbidden") return <p className="text-sm text-destructive">You need the Admin role to see links.</p>;
  if (state === "error" || !data) return <div className="flex gap-3 text-sm text-destructive"><span>Links could not load.</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>;

  const programFor = (slug: string) => data.programs.find((p) => p.slug === slug);
  /** The name a person recognises: the video for a link problem, the tool for a programme problem. */
  function issueTitle(issue: Issue): string {
    const code = issue.slug.includes("/") ? issue.slug.split("/")[0] : issue.slug;
    const video = videoByCode.get(code);
    const tool = issue.slug.includes("/") ? issue.slug.split("/")[1] : null;
    if (video) return tool ? `${video.title || code} · ${programFor(tool)?.name ?? tool}` : video.title || code;
    return programFor(issue.slug)?.name ?? issue.slug;
  }
  const shownIssues = showAll ? issues : issues.slice(0, SHOW_FIRST);
  const toggle = (code: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(code)) next.delete(code); else next.add(code); return next; });

  return (
    <section className="space-y-5" data-testid="link-videos">
      <div className={cn("rounded-lg border p-4", issues.length ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5")} data-testid="problems">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            {issues.length
              ? <><AlertTriangle className="size-4 text-amber-500" /> {issues.length} {issues.length === 1 ? "thing" : "things"} to fix</>
              : <><CheckCircle2 className="size-4 text-emerald-500" /> All links are fine</>}
          </h2>
          <span className="text-xs text-muted-foreground">
            {data.checked_at ? `Checked ${ago(data.checked_at)}` : "Not checked yet"} ·{" "}
            <button type="button" className="font-medium text-primary hover:underline disabled:opacity-60" disabled={checking} onClick={() => void checkAgain()}>
              {checking ? "Checking…" : "Check again"}
            </button>
          </span>
        </div>
        {issues.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {shownIssues.map((issue, i) => {
              const program = programFor(issue.slug);
              return (
                <li className="flex flex-wrap items-start justify-between gap-2 py-2.5" key={`${issue.code}:${issue.slug}:${i}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{issueTitle(issue)}</p>
                    <p className="text-sm text-muted-foreground" title={issue.detail}>{plainDetail(issue)}</p>
                  </div>
                  {issue.url
                    ? <Button size="xs" variant="outline" asChild><a href={issue.url} target="_blank" rel="noopener noreferrer">Open YouTube <ExternalLink className="size-3" /></a></Button>
                    : program && <Button size="xs" variant="outline" onClick={() => onFixProgram(program)}>Fix programme</Button>}
                </li>
              );
            })}
          </ul>
        )}
        {issues.length > SHOW_FIRST && (
          <button type="button" className="mt-1 text-sm font-medium text-primary hover:underline" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show fewer" : `Show all ${issues.length}`}
          </button>
        )}
      </div>

      <Input type="search" placeholder="Search videos or tools…" aria-label="Search videos" className="h-9 max-w-sm"
        value={query} onChange={(e) => setQuery(e.target.value)} />

      {videos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No links yet. Make some in Mint links.</p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No videos match “{query}”.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {visible.map((video) => {
            const isOpen = open.has(video.video_code);
            const videoIssues = issues.filter((i) => i.slug === video.video_code || video.links.some((l) => issuesForLink([i], l).length));
            return (
              <div key={video.video_code} ref={video.video_code === focusCode ? focusRef : undefined}>
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(video.video_code)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                  <span className="min-w-0 flex-1 truncate font-medium">{video.title || "Untitled video"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{video.links.length} {video.links.length === 1 ? "link" : "links"}</span>
                  {videoIssues.length
                    ? <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-label="Has a problem" />
                    : <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="All fine" />}
                </button>
                {isOpen && (
                  <div className="space-y-3 bg-muted/20 px-4 pb-4 pt-1">
                    <ul className="divide-y divide-border rounded-md border border-border bg-background">
                      {video.links.map((link) => {
                        const problems = issuesForLink(issues, link);
                        return (
                          <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" key={link.slug}>
                            <span className="flex-1 text-sm font-medium sm:w-32 sm:flex-none">{link.name}</span>
                            <div className="order-last min-w-0 basis-full space-y-0.5 sm:order-none sm:flex-1 sm:basis-auto">
                              <code className="block break-all text-xs text-foreground/80">{link.short_url.replace(/^https?:\/\//, "")}</code>
                              <a href={link.target_url} target="_blank" rel="noopener noreferrer" title="Where this link goes"
                                className="block break-all text-xs text-muted-foreground hover:text-primary hover:underline">→ {link.target_url}</a>
                            </div>
                            {problems.length > 0 && <AlertTriangle className="size-4 shrink-0 text-amber-500" aria-label="Has a problem" />}
                            <CopyButton text={link.short_url} label="Copy" />
                            {problems.map((p, i) => <p className="order-last basis-full text-xs text-amber-600 dark:text-amber-400" key={i} title={p.detail}>{plainDetail(p)}</p>)}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={video.description} label="Copy description" size="sm" />
                      {video.yt_video_id && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={studioUrl(video.yt_video_id)} target="_blank" rel="noopener noreferrer">Open YouTube <ExternalLink className="size-3.5" /></a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEditing(video)}>Change where a link goes</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && <ChangeDestination video={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </section>
  );
}

/** For a link already in a published description: its short URL stays, its destination changes. */
function ChangeDestination({ video, onClose, onSaved }: { video: LinkVideo; onClose: () => void; onSaved: () => void }) {
  const [slug, setSlug] = useState(video.links[0]?.slug ?? "");
  const link = video.links.find((l) => l.slug === slug);
  const [url, setUrl] = useState(link?.target_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true); setError(null);
    try { await linkResync(slug, url.trim()); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change where a link goes</DialogTitle>
          <DialogDescription>The short link in your description stays the same. Only the page it opens changes.</DialogDescription>
        </DialogHeader>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Link</span>
          <select aria-label="Link" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={slug}
            onChange={(e) => { setSlug(e.target.value); setUrl(video.links.find((l) => l.slug === e.target.value)?.target_url ?? ""); }}>
            {video.links.map((l) => <option key={l.slug} value={l.slug}>{l.name} ({l.short_url.replace(/^https?:\/\//, "")})</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Opens this page</span>
          <input aria-label="New destination" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !url.trim() || url.trim() === link?.target_url} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
