import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { affiliateCatalog, linkConfirm, linkPreview, saveVideoTools, type AffiliateCatalogItem, type PreviewResult, type BoardRow } from "./api";

export function MintLinks({ rows, onSaved }: { rows: BoardRow[]; onSaved: () => void }) {
  const [rowId, setRowId] = useState("");
  const [catalog, setCatalog] = useState<AffiliateCatalogItem[]>([]);
  const [tools, setTools] = useState<{ kind: "catalog"; slug: string }[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void affiliateCatalog().then(setCatalog); }, []);
  async function chooseTool(slug: string) {
    if (!slug || tools.some((t) => t.slug === slug)) return;
    const next = [...tools, { kind: "catalog" as const, slug }]; setTools(next);
    if (rowId) await saveVideoTools(rowId, next);
  }
  async function previewLinks() {
    if (!rowId) return; setError(null);
    try { await saveVideoTools(rowId, tools); setPreview(await linkPreview(rowId)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not preview links."); }
  }
  const publishable = preview?.items.filter((i) => i.status !== "blocked") ?? [];
  return <section className="space-y-5" data-testid="mint-links"><div><h2 className="text-lg font-semibold tracking-tight">Mint tracking links</h2><p className="text-sm text-muted-foreground">Choose a video, select its tools, then review exactly what will publish.</p></div>
    <div className="space-y-2"><h3 className="text-sm font-medium">1. Which video</h3><select aria-label="Which video" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={rowId} onChange={(e) => { setRowId(e.target.value); setTools([]); setPreview(null); }}>{<option value="">Choose a video…</option>}{rows.map((row) => <option key={row.row_id} value={row.row_id}>{row.video_title || row.row_id} {row.video_code ? `(${row.video_code})` : ""}</option>)}</select></div>
    <div className="space-y-2"><h3 className="text-sm font-medium">2. Which tools</h3><div className="flex flex-wrap gap-2">{tools.map((tool) => <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" key={tool.slug}>{catalog.find((c) => c.slug === tool.slug)?.displayName ?? tool.slug}<button className="ml-1.5" onClick={() => setTools(tools.filter((t) => t.slug !== tool.slug))} aria-label={`Remove ${tool.slug}`}>×</button></span>)}</div><select aria-label="Add tool" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="" onChange={(e) => { void chooseTool(e.target.value); e.currentTarget.value = ""; }}><option value="">Add from catalogue…</option>{catalog.map((c) => <option value={c.slug} key={c.slug}>{c.displayName}</option>)}</select></div>
    <Button disabled={!rowId || tools.length === 0} onClick={() => void previewLinks()}>Preview links</Button>{error && <p className="text-sm text-destructive">{error}</p>}
    {preview && <><div className="space-y-2"><h3 className="text-sm font-medium">3. What will be published</h3><div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2">Short link</th><th className="px-3 py-2">Tool</th><th className="px-3 py-2">Really lands on</th></tr></thead><tbody className="divide-y divide-border">{preview.items.map((item) => <tr className={item.status === "blocked" ? "bg-destructive/5" : ""} key={item.slug}><td className="px-3 py-2 font-mono text-xs">{item.short_url}</td><td className="px-3 py-2">{item.displayName}</td><td className="px-3 py-2 break-all text-xs">{item.status === "blocked" ? item.reason : item.target_url}{item.warnings?.map((warning) => <div className="mt-1 text-amber-700" key={warning}>{warning}</div>)}</td></tr>)}</tbody></table></div></div><div className="space-y-2"><h3 className="text-sm font-medium">4. The description</h3><pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">{preview.description}</pre><Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(preview.description)}>Copy description</Button></div><Button disabled={publishable.length === 0} onClick={() => void linkConfirm(rowId, preview.plan_hash).then(() => { onSaved(); setPreview(null); })}>Publish {publishable.length} links</Button></>}
  </section>;
}
