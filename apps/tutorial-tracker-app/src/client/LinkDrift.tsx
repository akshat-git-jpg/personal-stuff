import { useState, useEffect, useMemo } from "react";
import { RotateCcw, AlertTriangle, Link2 } from "lucide-react";
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


/**
 * The Links tab does two things, in the order you need them:
 *
 *   1. Generate — pick any video, choose its tools, mint the links.
 *   2. Drift     — the cross-video audit of links already minted.
 *
 * The video card carries the same generator, but only shows it once a video
 * has cleared its way to Upload. This tab deliberately has NO such gate:
 * the server never had one either (/api/link-preview is admin-only and
 * nothing more), and that client-side gate is what made the generator
 * impossible to find on a video still in production.
 */
export function LinksTab({ rows, onSaved }: { rows: BoardRow[]; onSaved: () => void }) {
  const [selectedRowId, setSelectedRowId] = useState<string>("");

  // Both groups are pickable. The split is a readiness HINT, not a filter.
  const { ready, inProgress } = useMemo(() => {
    const readyRows: BoardRow[] = [];
    const pendingRows: BoardRow[] = [];
    for (const row of rows) {
      if (!row.row_id) continue;
      const pipe = pipeOf(row as Record<string, unknown>);
      const upload = pipe.stages.find((s) => s.id === "upload");
      const open = !!upload && isGateOpen(pipe, upload, row as Record<string, unknown>);
      (open ? readyRows : pendingRows).push(row);
    }
    return { ready: readyRows, inProgress: pendingRows };
  }, [rows]);

  const selectedRow = rows.find((r) => r.row_id === selectedRowId);
  const initialToolsStr = selectedRow
    ? ((selectedRow as Record<string, unknown>).video_tools as string) || "[]"
    : "[]";
  const initialTools = useMemo(() => {
    try { return JSON.parse(initialToolsStr) as unknown[]; } catch { return []; }
  }, [initialToolsStr]);

  const opt = (r: BoardRow) => (
    <option key={r.row_id} value={r.row_id}>{r.video_title || r.row_id}</option>
  );

  return (
    <div className="max-w-4xl space-y-8 py-4" data-testid="links-tab">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Generate affiliate links</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a video, choose the tools it mentions, then mint its links and description.
            The same tool sits on each video card once that video reaches Upload.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="link-video-picker" className="text-xs font-medium text-foreground/80">Video</label>
          <select
            id="link-video-picker"
            data-testid="link-video-picker"
            className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            value={selectedRowId}
            onChange={(e) => setSelectedRowId(e.target.value)}
          >
            <option value="">&mdash; Select a video &mdash;</option>
            {ready.length > 0 && <optgroup label="Ready to publish">{ready.map(opt)}</optgroup>}
            {inProgress.length > 0 && <optgroup label="Still in production">{inProgress.map(opt)}</optgroup>}
          </select>
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground">No videos on the board yet.</p>
          )}
        </div>

        {selectedRow ? (
          <div data-testid="link-studio-panel">
            <LinkStudio
              rowId={selectedRow.row_id!}
              videoTitle={selectedRow.video_title || selectedRow.row_id!}
              initialTools={initialTools}
              onSaved={onSaved}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
            <Link2 className="size-4 shrink-0" /> Select a video above to pick its tools and mint links.
          </div>
        )}
      </section>

      <section className="border-t border-border pt-2">
        <LinkDriftPanel />
      </section>
    </div>
  );
}
