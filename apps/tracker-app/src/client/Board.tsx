import { useState, useCallback, useEffect, useMemo } from "react";
import type { Column } from "../shared/columns";
import type { Transition } from "../shared/rbac";
import { pipeOf, stageByStatusColIn } from "./stages";
import {
  applyTransition, getReviewQueue, deleteVideo, applyDefaults, getDefaults,
  type BoardRow, type ReviewItem, type AssignmentDefaultRow,
} from "./api";
import { STATUS_LEGEND } from "./status";
import { StatusPill } from "./Card";
import { CardDetail } from "./CardDetail";
import { PipelineBoard } from "./PipelineBoard";
import { TeamPanel } from "./TeamPanel";
import { NewVideoDialog } from "./NewVideoDialog";
import { MyWork } from "./MyWork";
import { AttentionPanel } from "./AttentionPanel";
import { Filters, EMPTY_FILTERS, type AdminFilters } from "./Filters";
import { activeStage } from "./pipeline";
import { getPipeline } from "./stages";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface WorkerStage { pipelineId: string; stageId: string; statusCol: string; role: string; label: string }
export interface PipelineSummary { id: string; name: string; stages: { id: string; label: string; role: string }[] }

interface BoardProps {
  roles: string[];
  stages: WorkerStage[];
  pipelines: PipelineSummary[];
  columns: Column[];
  rows: BoardRow[];
  names: Record<string, string>;
  memberRoles?: Record<string, string>;
  memberships?: Record<string, Record<string, string[]>>;
  readOnly?: boolean;
  viewerEmail?: string;
  reload: () => void;
}

// Work-board tabs are keyed by "w:<pipelineId>:<statusCol>" (pipeline-qualified so
// the shared Topic stage of two systems doesn't collide); plus the fixed tabs.
type TabKey = string;

function transitionsForStageCol(row: BoardRow, statusCol: string): Transition[] {
  return row._actions?.find((g) => g.statusCol === statusCol)?.transitions ?? [];
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg duration-200 animate-in fade-in slide-in-from-bottom-2">
      {message}
    </div>
  );
}

export function StatusLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {STATUS_LEGEND.map((s) => <StatusPill key={s} status={s} />)}
    </div>
  );
}

export function Board({ roles, stages, pipelines, columns, rows, names, memberRoles = {}, memberships = {}, readOnly, viewerEmail, reload }: BoardProps) {
  const isAdmin = roles.includes("Admin");
  // Reviewing is an explicit role, not an Admin default.
  const canReview = roles.includes("Reviewer");
  const workerStages = stages ?? [];
  // Only surface a work tab where the user actually has a card. A freelancer works
  // a single system, so this drops the empty cross-system tabs (and the redundant
  // "· System" suffix). The suffix stays only when real work spans >1 system.
  const activeWorkerStages = workerStages.filter((ws) =>
    rows.some((r) => (r as Record<string, unknown>).pipeline === ws.pipelineId && (r._stages ?? []).includes(ws.statusCol)));

  // Time-in-status chip audience. "everyone" = freelancers see it on their own
  // board AND admins see it in view-as. Flip to "admin" to restrict it to admins
  // / view-as only — that's the only change needed.
  const SHOW_DWELL: "everyone" | "admin" = "everyone";
  const adminViewing = isAdmin || !!readOnly; // readOnly board = an admin's view-as mirror
  const showDwell = SHOW_DWELL === "everyone" || adminViewing;

  // Build the tab set
  const hasMyWork = activeWorkerStages.length > 0 || canReview || rows.some((r) => r._upcoming && r._upcoming.length > 0);
  const tabs: { key: TabKey; label: string }[] = [];
  if (hasMyWork) tabs.push({ key: "my-work", label: "My work" });
  if (isAdmin) {
    tabs.push({ key: "pipeline", label: "Board" });
    tabs.push({ key: "team", label: "Team" });
  }
  const defaultTab: TabKey = isAdmin ? "pipeline" : "my-work";
  const [tab, setTab] = useState<TabKey>(defaultTab);
  const [adminFilters, setAdminFilters] = useState<AdminFilters>(EMPTY_FILTERS);
  const [matrixPipeline, setMatrixPipeline] = useState<string>(pipelines[0]?.id ?? "standard");
  const [detailRow, setDetailRow] = useState<BoardRow | null>(null);
  const [detailStageId, setDetailStageId] = useState<string | undefined>(undefined);
  const [detailPerspective, setDetailPerspective] = useState<"doer" | "reviewer" | "all">("all");
  const [toast, setToast] = useState<string | null>(null);

  function openDetail(row: BoardRow, stageId?: string, perspective: "doer" | "reviewer" | "all" = "all") {
    setDetailRow(row); setDetailStageId(stageId); setDetailPerspective(perspective);
  }

  const [queueItems, setQueueItems] = useState<ReviewItem[]>([]);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); }, []);

  const refreshQueue = useCallback(async () => {
    if (!canReview) return;
    const data = await getReviewQueue();
    setQueueItems(data.items);
  }, [canReview]);

  useEffect(() => { void refreshQueue(); }, [refreshQueue, rows]);

  // Category/subcategory options come from existing cards AND the assignment
  // defaults (so a category created only in a default still shows up everywhere).
  const [defaultRows, setDefaultRows] = useState<AssignmentDefaultRow[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    void getDefaults().then(setDefaultRows).catch(() => {});
  }, [isAdmin, rows]);

  const categoryOptions = useMemo(
    () => [...new Set([
      ...rows.map((r) => (r.category ?? "").trim()),
      ...defaultRows.map((d) => (d.category ?? "").trim()),
    ].filter(Boolean))].sort(), [rows, defaultRows]);
  const subcategoryOptions = useMemo(
    () => [...new Set([
      ...rows.map((r) => (r.subcategory ?? "").trim()),
      ...defaultRows.map((d) => (d.subcategory ?? "").trim()),
    ].filter(Boolean))].sort(), [rows, defaultRows]);

  // Single delete path used by every admin surface (Pipeline matrix, board card
  // tiles, and the card detail panel). Confirms, deletes, closes any open detail,
  // toasts, and reloads.
  async function handleDelete(rowId: string, title: string) {
    if (!rowId) return;
    if (!confirm(`Delete "${title || rowId}"? This removes the row from the sheet and can't be undone.`)) return;
    try {
      await deleteVideo(rowId);
      showToast("Video deleted");
      setDetailRow(null); setDetailStageId(undefined);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete the row");
    }
  }

  async function handleApplyDefaults(rowId: string) {
    if (!rowId) return;
    try {
      const { applied } = await applyDefaults(rowId);
      const n = Object.keys(applied).length;
      showToast(n ? `Filled ${n} field${n === 1 ? "" : "s"} from defaults` : "No blank fields to fill");
      setDetailRow(null); setDetailStageId(undefined);
      reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't apply defaults");
    }
  }

  async function doAction(row: BoardRow, t: Transition) {
    if (!row.row_id) return;
    if (t.requiresFeedback) { openDetail(row, stageByStatusColIn(pipeOf(row), t.statusCol)?.id, "reviewer"); return; }
    // Send the RAW stored value (blank stays blank) as the optimistic-lock expectation,
    // so a blank cell isn't mistaken for a "To Do" change.
    const prev = (row[t.statusCol as keyof BoardRow] as string) ?? "";
    try {
      await applyTransition(row.row_id, t, prev);
      reload();
      void refreshQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed");
    }
  }

  // ── New-video modal (admin) ──
  const [showNewVideo, setShowNewVideo] = useState(false);
  const handleCreated = (_pipelineId: string) => {
    setShowNewVideo(false);
    // jump to the Topic work board for the chosen system (admin owns every Topic) 
    // now we just jump to my-work or pipeline, which we are already doing
    setTab("my-work");
    reload();
  };

  const newVideoModal = (
    <NewVideoDialog
      open={showNewVideo}
      onOpenChange={setShowNewVideo}
      pipelines={pipelines}
      defaultPipeline={matrixPipeline}
      categoryOptions={categoryOptions}
      subcategoryOptions={subcategoryOptions}
      onCreated={handleCreated}
    />
  );

  const activeTab = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? "my-work");

  return (
    <div className="bg-background p-4 text-foreground md:p-6">
      {tabs.length > 1 && (
        <div className="mb-4 flex items-center gap-1 border-b border-border">
          {tabs.map((t) => (
            <button key={t.key} type="button"
              onClick={() => setTab(t.key)} aria-pressed={activeTab === t.key}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}>{t.label}</button>
          ))}
          {isAdmin && (
            <Button size="sm" className="mb-1.5 ml-auto h-8" onClick={() => { setShowNewVideo(true); }}>
              <Plus className="size-4" /> New video
            </Button>
          )}
        </div>
      )}

      {activeTab === "my-work" && (
        <>
          <StatusLegend />
          <MyWork
            queueItems={queueItems}
            onOpenQueueItem={(item) => openDetail(item.row, item.stageId, "reviewer")}
            rows={rows}
            names={names}
            readOnly={readOnly}
            isAdmin={isAdmin}
            showDwell={showDwell}
            handleDelete={(id, title) => void handleDelete(id, title)}
            openDetail={(r, sid, as) => openDetail(r, sid, as)}
            doAction={(r, t) => void doAction(r, t)}
            transitionsForStageCol={transitionsForStageCol}
          />
        </>
      )}
      {activeTab === "pipeline" && (
        <>
          {isAdmin && !readOnly && <AttentionPanel rows={rows} pipelines={pipelines} names={names} onOpen={(r, sid) => openDetail(r, sid, "all")} />}
          {pipelines.length > 1 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Video type</span>
              <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
                {pipelines.map((p) => (
                  <button key={p.id} type="button"
                    onClick={() => setMatrixPipeline(p.id)} aria-pressed={matrixPipeline === p.id}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      matrixPipeline === p.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                    )}>{p.name}</button>
                ))}
              </div>
            </div>
          )}
          <Filters rows={rows} pipeline={getPipeline(matrixPipeline)} names={names} memberRoles={memberRoles} filters={adminFilters} onChange={setAdminFilters} />
          <PipelineBoard rows={rows} pipeline={getPipeline(matrixPipeline)} names={names} filters={adminFilters}
            onOpen={(r) => openDetail(r as BoardRow, activeStage(r as Record<string, string>)?.id, "all")}
            canDelete={isAdmin}
            onDelete={(rowId, title) => void handleDelete(rowId, title)} />
        </>
      )}
      {activeTab === "team" && <TeamPanel onChanged={reload} pipelines={pipelines} categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions} />}

      {tabs.length === 0 && <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">No work is assigned to you right now.</div>}

      {detailRow && (
        <CardDetail row={detailRow} columns={columns} roles={roles} names={names} memberRoles={memberRoles} memberships={memberships} readOnly={readOnly} viewerEmail={viewerEmail}
          contextStageId={detailStageId} perspective={detailPerspective}
          onDelete={() => void handleDelete(detailRow.row_id ?? "", detailRow.video_title ?? "")}
          onApplyDefaults={() => void handleApplyDefaults(detailRow.row_id ?? "")}
          categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions}
          onClose={() => { setDetailRow(null); setDetailStageId(undefined); }}
          onSaved={() => { reload(); void refreshQueue(); setDetailRow(null); setDetailStageId(undefined); }} />
      )}

      {newVideoModal}
      {toast && <Toast message={toast} />}
    </div>
  );
}
