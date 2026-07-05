import { useState, useCallback, useEffect, useMemo } from "react";
import type { Column } from "../shared/columns";
import type { Transition } from "../shared/rbac";
import { pipeOf, stageByStatusColIn, getPipeline, createFieldsOf } from "./stages";
import {
  applyTransition, getReviewQueue, createVideo, deleteVideo, applyDefaults, getDefaults,
  type BoardRow, type ReviewItem, type AssignmentDefaultRow,
} from "./api";
import { lanesFor, groupByLane } from "./lanes";
import { activeStage } from "./pipeline";
import { statusMeta, STATUS_LEGEND, toneDot } from "./status";
import { STAGE_GUIDE, REVIEWER_GUIDE } from "./guidance";
import { Card, StatusPill } from "./Card";
import { CardDetail, ComboSelect } from "./CardDetail";
import { ReviewQueue } from "./ReviewQueue";
import { PipelineBoard } from "./PipelineBoard";
import { TeamPanel } from "./TeamPanel";
import { Filters, EMPTY_FILTERS, type AdminFilters } from "./Filters";
import { Info, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

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

// Collapsible "what you do here" helper at the top of a board.
function HelpBanner({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border bg-muted/40">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground/80 hover:text-foreground">
        <Info className="size-3.5 text-primary" /> What you do here
        {open ? <ChevronDown className="ml-auto size-3.5 text-muted-foreground" /> : <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />}
      </button>
      {open && <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">{text}</p>}
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {STATUS_LEGEND.map((s) => <StatusPill key={s} status={s} />)}
    </div>
  );
}

export function Board({ roles, stages, pipelines, columns, rows, names, memberRoles = {}, memberships = {}, readOnly, reload }: BoardProps) {
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

  // Build the tab set, all peers at the top. Review queue comes FIRST (and is the
  // default) whenever the user is a reviewer; then one tab per work board (each
  // stage the user owns, named by the stage); then admin tabs.
  const [queueCount, setQueueCount] = useState(0);
  const pipelineName = useCallback((id: string) => pipelines.find((p) => p.id === id)?.name ?? id, [pipelines]);
  const workKey = (ws: WorkerStage) => `w:${ws.pipelineId}:${ws.statusCol}`;
  // Suffix the system name when the user works stages across more than one system,
  // so e.g. two "Topic" tabs read "Topic · Standard" / "Topic · Tut 2".
  const multiSystem = new Set(activeWorkerStages.map((w) => w.pipelineId)).size > 1;
  const tabs: { key: TabKey; label: string }[] = [];
  if (canReview) tabs.push({ key: "review", label: `Review queue${queueCount ? ` (${queueCount})` : ""}` });
  for (const ws of activeWorkerStages) {
    tabs.push({ key: workKey(ws), label: multiSystem ? `${ws.label} · ${pipelineName(ws.pipelineId)}` : ws.label });
  }
  if (isAdmin) {
    tabs.push({ key: "pipeline", label: "Pipeline" });
    tabs.push({ key: "team", label: "Team" });
  }
  const defaultTab: TabKey = canReview ? "review" : (activeWorkerStages[0] ? workKey(activeWorkerStages[0]) : (tabs[0]?.key ?? "review"));
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
    setQueueCount(data.count);
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
  const [nvPipeline, setNvPipeline] = useState<string>(pipelines[0]?.id ?? "standard");
  const nvFields = createFieldsOf(getPipeline(nvPipeline));
  const blankNv = (fields = nvFields) => Object.fromEntries(fields.map((f) => [f.col, ""])) as Record<string, string>;
  const [showNewVideo, setShowNewVideo] = useState(false);
  const [nv, setNv] = useState<Record<string, string>>(() => blankNv());
  const [nvBusy, setNvBusy] = useState(false);
  const [nvError, setNvError] = useState<string | null>(null);

  async function submitNewVideo() {
    const missing = nvFields.filter((f) => !(nv[f.col] ?? "").trim());
    if (missing.length) { setNvError(`${missing.map((f) => f.label).join(", ")} ${missing.length === 1 ? "is" : "are"} required.`); return; }
    setNvBusy(true); setNvError(null);
    try {
      const payload = { ...Object.fromEntries(nvFields.map((f) => [f.col, (nv[f.col] ?? "").trim()])), pipeline: nvPipeline };
      await createVideo(payload);
      setShowNewVideo(false); setNv(blankNv());
      // jump to the Topic work board for the chosen system (admin owns every Topic).
      const topicWs = workerStages.find((ws) => ws.pipelineId === nvPipeline && ws.stageId === "topic");
      setTab(topicWs ? workKey(topicWs) : defaultTab);
      reload();
    } catch (err) { setNvError(err instanceof Error ? err.message : String(err)); }
    finally { setNvBusy(false); }
  }

  // ── Lane board renderer ──────────────────────────────────────────────────────
  function renderLaneBoard(statusCol: Column, sourceRows: BoardRow[]) {
    const lanes = lanesFor(statusCol, sourceRows[0]);
    const groups = groupByLane(sourceRows, statusCol, lanes);
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {groups.map(({ lane, rows: laneRows }) => {
          const m = statusMeta(lane);
          return (
            <div key={lane} className="flex min-w-0 flex-col rounded-xl border border-border bg-muted/30">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className={cn("size-2 rounded-full", toneDot(m.tone))} />
                <span className="text-xs font-semibold tracking-tight text-foreground/80">{m.label}</span>
                <span className="ml-auto rounded-full bg-background px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground ring-1 ring-inset ring-border">{laneRows.length}</span>
              </div>
              <div className="flex flex-col gap-2 px-2 pb-2">
                {laneRows.map((row) => (
                  <Card key={row.row_id} row={row} statusCol={statusCol} names={names} readOnly={readOnly}
                    showAssignee={isAdmin} showDwell={showDwell}
                    canDelete={isAdmin && !readOnly}
                    onDelete={() => void handleDelete(row.row_id ?? "", row.video_title ?? "")}
                    /* A work board is the doer's view — never show reviewer actions here */
                    transitions={transitionsForStageCol(row, statusCol).filter((t) => t.by === "doer")}
                    onOpen={() => openDetail(row, stageByStatusColIn(pipeOf(row), statusCol)?.id, "doer")}
                    onAction={(t) => void doAction(row, t)} />
                ))}
                {laneRows.length === 0 && <div className="px-2 py-3 text-center text-xs text-muted-foreground/60">No items</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── A single work board (one stage the user owns; one tab each) ──────────────
  function renderWork(ws: WorkerStage) {
    const mine = rows.filter((r) => (r as Record<string, unknown>).pipeline === ws.pipelineId && (r._stages ?? []).includes(ws.statusCol));
    return (
      <>
        {STAGE_GUIDE[ws.stageId] && <HelpBanner text={STAGE_GUIDE[ws.stageId]} />}
        {mine.length === 0
          ? <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">Nothing in your {ws.label} right now.</div>
          : renderLaneBoard(ws.statusCol as Column, mine)}
      </>
    );
  }

  const newVideoModal = (
    <Dialog open={showNewVideo} onOpenChange={(o) => { if (!nvBusy) setShowNewVideo(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New video</DialogTitle>
          <DialogDescription>Adds a topic at the start of the pipeline (Topic → To Do).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {pipelines.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground/80">Video type <span className="text-primary">*</span></label>
              <Select value={nvPipeline} onValueChange={(p) => { setNvPipeline(p); setNv(blankNv(createFieldsOf(getPipeline(p)))); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {nvFields.map((f, i) => {
            const set = (v: string) => setNv((prev) => ({ ...prev, [f.col]: v }));
            return (
              <div className="space-y-1.5" key={f.col}>
                <label className="text-xs font-medium text-foreground/80">{f.label} <span className="text-primary">*</span></label>
                {f.type === "textarea" ? (
                  <textarea rows={4} value={nv[f.col] ?? ""} onChange={(e) => set(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" />
                ) : f.type === "combo" ? (
                  <ComboSelect id={`nv-${f.col}`} value={nv[f.col] ?? ""}
                    options={f.options === "subcategory" ? subcategoryOptions : categoryOptions}
                    placeholder={`New ${f.label.toLowerCase()}…`} onChange={set} />
                ) : (
                  <Input value={nv[f.col] ?? ""} autoFocus={i === 0} onChange={(e) => set(e.target.value)} />
                )}
              </div>
            );
          })}
          {nvError && <p className="text-xs font-medium text-destructive">{nvError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowNewVideo(false)} disabled={nvBusy}>Cancel</Button>
          <Button onClick={() => void submitNewVideo()} disabled={nvBusy}>{nvBusy ? "Creating…" : "Create video"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const activeTab = tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? "review");
  // A work-board tab is active when the active key matches one of the user's stages.
  const activeWorkerStage = activeWorkerStages.find((ws) => workKey(ws) === activeTab);

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
            <Button size="sm" className="mb-1.5 ml-auto h-8" onClick={() => { setNvPipeline(matrixPipeline); setShowNewVideo(true); }}>
              <Plus className="size-4" /> New video
            </Button>
          )}
        </div>
      )}

      {activeWorkerStage && <StatusLegend />}

      {activeWorkerStage && renderWork(activeWorkerStage)}
      {activeTab === "review" && (
        <>
          <HelpBanner text={REVIEWER_GUIDE} />
          <ReviewQueue items={queueItems} onOpen={(item) => openDetail(item.row, item.stageId, "reviewer")} />
        </>
      )}
      {activeTab === "pipeline" && (
        <>
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
        <CardDetail row={detailRow} columns={columns} roles={roles} names={names} memberRoles={memberRoles} memberships={memberships} readOnly={readOnly}
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
