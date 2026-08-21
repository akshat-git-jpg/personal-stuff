import { useState, useEffect, useRef } from "react";
import { Sparkles, Trash2, ChevronDown } from "lucide-react";
import { affiliateCatalog, saveVideoTools, linkPreview, linkConfirm, updateCell, type AffiliateCatalogItem, type PreviewResult } from "./api";
import { LinkResultModal } from "./LinkReviewModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Column } from "../shared/columns";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface LinkStudioProps {
  rowId: string;
  videoTitle: string;
  initialTools: any[];
  onSaved: () => void;
}

export function LinkStudio({ rowId, videoTitle, initialTools, onSaved }: LinkStudioProps) {
  const [toolsDraft, setToolsDraft] = useState<any[]>(initialTools);
  const [catalog, setCatalog] = useState<AffiliateCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<null | "catalog" | "external">(null);
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state when rowId changes
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToolsDraft(initialTools);
    setPreviewData(null);
    setPreviewError(null);
    setAddMode(null);
  }, [rowId, initialTools]);

  useEffect(() => {
    if (catalog.length === 0 && !catalogLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCatalogLoading(true);
      affiliateCatalog().then(setCatalog).finally(() => setCatalogLoading(false));
    }
  }, [catalog.length, catalogLoading]);

  useEffect(() => {
    if (!catalogOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catalogBoxRef.current && !catalogBoxRef.current.contains(e.target as Node)) setCatalogOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [catalogOpen]);

  async function handleGenerate() {
    if (!rowId) return;
    setPreviewLoading(true); setPreviewError(null);
    try {
      const plan = await linkPreview(rowId);
      await linkConfirm(rowId, plan.plan_hash);
      setPreviewData(plan); 
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveTools(newTools: any[]) {
    const prev = toolsDraft;
    setToolsDraft(newTools);
    if (!rowId) return;
    try {
      await saveVideoTools(rowId, newTools);
      setPreviewError(null);
      onSaved();
    } catch (err) {
      setToolsDraft(prev); 
      setPreviewError(`Couldn't save tools: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const [showTools, setShowTools] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm mt-4">
      <button type="button" onClick={() => setShowTools((v) => !v)} aria-expanded={showTools}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{videoTitle ? String(videoTitle) + " tools & links" : "Video tools & links"}</span>
        <span className="text-xs text-muted-foreground">{toolsDraft.length} selected</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", showTools && "rotate-180")} />
      </button>
      {showTools && (<div className="space-y-4 border-t border-border p-4">
      <div className="flex flex-wrap gap-2">
        {toolsDraft.map((t, i) => (
          <div key={i} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", t.kind === "catalog" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300")}>
            <span>{t.kind === "catalog" ? catalog.find(c => c.slug === t.slug)?.displayName || t.slug : t.name}</span>
            <button type="button" onClick={() => saveTools(toolsDraft.filter((_, idx) => idx !== i))} className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"><Trash2 className="size-3" /></button>
          </div>
        ))}
        {toolsDraft.length === 0 && <span className="text-sm text-muted-foreground italic">No tools selected</span>}
      </div>
      <div className="pt-3 border-t border-border">
        {addMode === null && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { setAddMode("catalog"); setCatalogOpen(true); }}>+ Add from catalog</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAddMode("external")}>+ Add external link</Button>
          </div>
        )}

        {addMode === "catalog" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Add from catalog</span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setAddMode(null); setCatalogQuery(""); setCatalogOpen(false); }}>Cancel</button>
            </div>
            <div className="relative" ref={catalogBoxRef}>
              <input
                type="text"
                autoFocus
                className={inputCls}
                placeholder="Type to search programs…"
                value={catalogQuery}
                onFocus={() => setCatalogOpen(true)}
                onChange={(e) => { setCatalogQuery(e.target.value); setCatalogOpen(true); }}
              />
              {catalogOpen && (() => {
                const matches = catalog
                  .filter(c => !toolsDraft.some(t => t.kind === "catalog" && t.slug === c.slug))
                  .filter(c => c.displayName.toLowerCase().includes(catalogQuery.trim().toLowerCase()));
                return (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
                    {matches.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matching programs</div>
                    )}
                    {matches.map(c => (
                      <button
                        key={c.slug}
                        type="button"
                        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          saveTools([...toolsDraft, { kind: "catalog", slug: c.slug }]);
                          setCatalogQuery("");
                          setCatalogOpen(false);
                        }}
                      >
                        <span className={cn(!c.isApproved && "text-red-600 dark:text-red-400")}>{c.displayName}</span>
                        {c.hasCoupon && <span>🎟️</span>}
                        {!c.isApproved && <span className="text-red-600 dark:text-red-400">(Not approved) 🔴</span>}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {addMode === "external" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Add external link (tool with no affiliate program)</span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setAddMode(null); setExtName(""); setExtUrl(""); }}>Cancel</button>
            </div>
            <div className="flex items-center gap-2">
              <input type="text" autoFocus placeholder="Display name" className={inputCls} value={extName} onChange={e => setExtName(e.target.value)} />
              <input type="url" placeholder="https://..." className={inputCls} value={extUrl} onChange={e => setExtUrl(e.target.value)} />
              <Button size="sm" type="button" disabled={!extName.trim() || !extUrl.trim()} onClick={() => {
                if (extName.trim() && extUrl.trim()) {
                  saveTools([...toolsDraft, { kind: "external", name: extName.trim(), url: extUrl.trim() }]);
                  setExtName(""); setExtUrl(""); setAddMode(null);
                }
              }}>Add</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">The name is what viewers see next to the link in your description (e.g. “DaVinci Resolve — link”).</p>
          </div>
        )}
      </div>
      <div className="pt-2">
        <Button size="sm" onClick={() => void handleGenerate()} disabled={previewLoading || toolsDraft.length === 0}>
          <Sparkles className="size-3.5 mr-1.5" /> {previewLoading ? "Generating…" : "Generate links & description"}
        </Button>
        {previewError && <p className="mt-2 text-xs font-medium text-destructive">{previewError}</p>}
      </div>
      </div>)}
      {previewData && (
        <LinkResultModal
          result={previewData}
          onClose={() => { setPreviewData(null); onSaved(); }}
          onSaveDescription={async (text) => { if (rowId) await updateCell(rowId, "video_description" as Column, text, ""); }}
        />
      )}
    </div>
  );
}
