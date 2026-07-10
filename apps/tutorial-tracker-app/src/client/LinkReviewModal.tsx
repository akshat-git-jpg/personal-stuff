import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, Link as LinkIcon, CheckCircle2, XCircle, Save } from "lucide-react";
import type { PreviewResult } from "./api";
import { cn } from "@/lib/utils";

interface LinkResultModalProps {
  result: PreviewResult;
  onClose: () => void;
  onSaveDescription: (text: string) => Promise<void>;
}

// Result view shown AFTER "Generate links & description" has minted the redirects
// and saved the templated description to the card. The links are final; the
// description is an editable starting point — the admin can add detail and re-save
// it to the card's description field.
export function LinkResultModal({ result, onClose, onSaveDescription }: LinkResultModalProps) {
  const { items, warnings, blocked } = result;
  const [description, setDescription] = useState(result.description);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setSaveError(null);
    try {
      await onSaveDescription(description);
      setDirty(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-lg tracking-tight">Links &amp; description</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>Saved. These short links are live and the description is saved to this card — paste the description into your YouTube video.</span>
          </div>

          {warnings.length > 0 && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/40">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-4" /> Heads up
              </div>
              <ul className="list-inside list-disc text-amber-700 dark:text-amber-300">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {blocked.length > 0 && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900/50 dark:bg-red-950/40">
              <div className="flex items-center gap-1.5 font-semibold text-red-800 dark:text-red-200">
                <XCircle className="size-4" /> {blocked.length} {blocked.length === 1 ? "tool was" : "tools were"} skipped
              </div>
              <p className="text-red-700 dark:text-red-300">These were <strong>not</strong> linked (see the reason in the table). Fix them in Video tools and generate again if you want them included.</p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Video Tools</h3>
            <p className="text-xs text-muted-foreground">The <strong className="text-foreground">short link</strong> is what goes in your description; it redirects to the destination on the right.</p>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Tool</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium w-full">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((t, i) => (
                    <tr key={i} className={cn(t.status === "blocked" && "bg-red-50/50 dark:bg-red-950/20")}>
                      <td className="px-4 py-2 font-medium align-top">{t.displayName}</td>
                      <td className="px-4 py-2 align-top">
                        {t.status === "affiliate" ? <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"><CheckCircle2 className="size-3" /> Affiliate</span>
                         : t.status === "external" ? <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"><LinkIcon className="size-3" /> External</span>
                         : <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300"><XCircle className="size-3" /> Skipped</span>}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground align-top">
                        {t.status === "blocked" ? (
                          <span className="text-red-600 dark:text-red-400 font-medium">{t.reason}</span>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">Short link</span>
                              <code className="bg-muted px-1 rounded text-xs">{t.short_url}</code>
                            </div>
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">redirects to</span>
                              <span className="truncate max-w-[260px] text-xs" title={t.target_url}>{t.target_url}</span>
                            </div>
                            {t.coupon && <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Coupon: {t.coupon}</div>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">No tools</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              <span className="text-xs text-muted-foreground">Edit freely, then Save to write it to the card.</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
              rows={12}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !dirty}>
                <Save className="size-3.5 mr-1.5" /> {saving ? "Saving…" : dirty ? "Save description" : "Saved"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(description)}>
                <Copy className="size-3.5 mr-1.5" /> Copy
              </Button>
              {saveError && <span className="text-xs font-medium text-destructive">{saveError}</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-5 py-4">
          <Button type="button" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
