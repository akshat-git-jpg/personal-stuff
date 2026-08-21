import React, { useState, useEffect } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { linkDrift, linkResync, type DriftRow, type BoardRow } from "./api";
import { Button } from "@/components/ui/button";
import { LinkStudio } from "./LinkStudio";
import { pipeOf, isGateOpen } from "./stages";

export function LinkDriftPanel() {
  const [driftRows, setDriftRows] = useState<DriftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadDrift();
  }, []);

  async function loadDrift() {
    setLoading(true); setError(null);
    try {
      const res = await linkDrift();
      setDriftRows(res.drift);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResync(slug: string) {
    setResyncing(r => ({ ...r, [slug]: true }));
    try {
      await linkResync(slug);
      // Remove from list on success
      setDriftRows(rows => rows.filter(r => r.slug !== slug));
    } catch (err) {
      alert(`Resync failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResyncing(r => ({ ...r, [slug]: false }));
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">Loading drift report...</div>;
  if (error) return <div className="text-sm text-destructive p-4">Failed to load drift: {error}</div>;

  return (
    <div className="space-y-4 max-w-4xl pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Affiliate Link Drift</h2>
        <Button size="sm" variant="outline" onClick={loadDrift} disabled={loading}><RotateCcw className="size-3 mr-1.5" /> Refresh</Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Video</th>
              <th className="px-4 py-2 font-medium">Tool</th>
              <th className="px-4 py-2 font-medium">Issue</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {driftRows.map((row, i) => (
              <tr key={i}>
                <td className="px-4 py-3 align-top min-w-[200px]">
                  <div className="font-medium text-foreground">{row.video_title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5"><code className="bg-muted px-1 rounded">{row.slug}</code></div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium">{row.tool}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  {row.kind === "url_changed" && (
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">URL changed in sheet</div>
                      <div className="text-xs text-muted-foreground line-through break-all">{row.minted_url}</div>
                      <div className="text-xs font-medium break-all">{row.current_url}</div>
                    </div>
                  )}
                  {row.kind === "deactivated" && (
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">No longer approved</div>
                      <div className="text-xs text-muted-foreground break-all">{row.minted_url}</div>
                    </div>
                  )}
                  {row.kind === "missing" && (
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">Missing from catalog</div>
                      <div className="text-xs text-muted-foreground break-all">{row.minted_url}</div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  {row.kind === "url_changed" ? (
                    <Button size="sm" onClick={() => void handleResync(row.slug)} disabled={resyncing[row.slug]}>
                      {resyncing[row.slug] ? "Syncing..." : "Re-sync URL"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Update sheet</span>
                  )}
                </td>
              </tr>
            ))}
            {driftRows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No drift detected. All minted links match the current affiliate catalog.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="size-3" /> Note: Coupon drift is not detectable here (coupons live only in the video description text). Re-preview the video card to refresh coupons.</p>
    </div>
  );
}

export function LinksTab({ rows, onSaved }: { rows: BoardRow[], onSaved: () => void }) {
  const uploadRows = rows.filter((r) => {
    const p = pipeOf(r as Record<string, unknown>);
    const uploadStage = p.stages.find(s => s.id === "upload");
    if (!uploadStage) return false;
    return isGateOpen(p, uploadStage, r as Record<string, unknown>);
  });

  const [selectedRowId, setSelectedRowId] = useState<string>(() => {
    return uploadRows.length > 0 ? uploadRows[0].row_id! : "";
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedRowId && uploadRows.length > 0) setSelectedRowId(uploadRows[0].row_id!);
  }, [uploadRows, selectedRowId]);

  const selectedRow = uploadRows.find((r) => r.row_id === selectedRowId);
  const initialToolsStr = selectedRow ? ((selectedRow as Record<string, unknown>).video_tools as string) || "[]" : "[]";
  const initialTools = React.useMemo(() => {
    try {
      return JSON.parse(initialToolsStr);
    } catch {
      return [];
    }
  }, [initialToolsStr]);

  return (
    <div className="space-y-8 max-w-4xl py-4">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Generate Links</h2>
        <div>
          <label htmlFor="video-picker" className="block text-sm font-medium text-foreground/80 mb-1.5">Select a video to generate links for</label>
          <select
            id="video-picker"
            className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            value={selectedRowId}
            onChange={(e) => setSelectedRowId(e.target.value)}
          >
            <option value="">— Select a video —</option>
            {uploadRows.map((r) => (
              <option key={r.row_id} value={r.row_id}>{r.video_title || r.row_id}</option>
            ))}
          </select>
        </div>
        
        {selectedRow && (
          <LinkStudio
            rowId={selectedRow.row_id!}
            videoTitle={selectedRow.video_title || selectedRow.row_id!}
            initialTools={initialTools}
            onSaved={onSaved}
          />
        )}
      </div>

      <div className="border-t border-border pt-4">
        <LinkDriftPanel />
      </div>
    </div>
  );
}
