import { useState, useEffect, useRef } from "react";
import { Lock, ExternalLink, Trash2, AlertTriangle, RotateCcw, Sparkles, ChevronDown, CheckCircle2 } from "lucide-react";
import type { Column } from "../shared/columns";
import type { Row, Transition } from "../shared/rbac";
import { canEditForRoles, isAdminRoles } from "../shared/engine/rbac";
import { PROTECTED_ADMIN_EMAIL, PIPELINES } from "../shared/engine/registry";
import { holdsRoleInSystem } from "../shared/engine/memberships";
import { fieldType, ALL_FORM_COLS } from "./columnMeta";
import {
  pipeOf, stageByIdIn, statusOf, showColumns, editColumns, requiredToApprove, requiredToSubmitFrom,
  missingColumns, colOf, assigneeColOf, reviewerColOf, instructionColOf,
  workLinkColOf, etaColOf, extraColsOf, isReviewable, feedbackColOf, isBrief, briefFieldsOf,
  isStageComplete, isGateOpen, holderOf, sinceOf,
  type RoleKind, type StageDef,
} from "./stages";
import {
  applyTransition, updateCell, affiliateCatalog, saveVideoTools, linkPreview, linkConfirm, displayName, personLabel, getCardEvents,
  type BoardRow, type CardEvent, type AffiliateCatalogItem, type PreviewResult
} from "./api";
import { LinkResultModal } from "./LinkReviewModal";
import { fieldLabel, LINK_HINTS, LINK_COLS, isUrl, etaBadge } from "./labels";
import { daysSince } from "./pipeline";
import { StatusPill } from "./Card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface CardDetailProps {
  row: BoardRow;
  columns: Column[];
  roles: string[];
  names: Record<string, string>;
  memberRoles?: Record<string, string>;
  /** email -> systemId -> roles, so assignment dropdowns can scope to the card's system. */
  memberships?: Record<string, Record<string, string[]>>;
  readOnly?: boolean;
  viewerEmail?: string;
  /** Which stage the card was opened while working — scopes the fields/actions shown. */
  contextStageId?: string;
  /** Whose actions to show: doer (My work), reviewer (Review queue), or all (Pipeline). */
  perspective?: "doer" | "reviewer" | "all";
  categoryOptions?: string[];
  subcategoryOptions?: string[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;        // admin: delete this video (confirm handled by caller)
  onApplyDefaults?: () => void; // admin: fill blank assignees/reviewers from the category/subcategory defaults
}

// Shared input styling so native inputs/selects/textareas match the shadcn look
// (kept native to avoid the empty-string-value limitation on assignee selects).
const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";
const labelCls = "flex items-center gap-1.5 text-xs font-medium text-foreground/80";

const ETA_TONE: Record<string, string> = {
  over: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",
  late: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",
  soon: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20",
  today: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20",
};
const etaTone = (t: string) => ETA_TONE[t] ?? "bg-muted text-muted-foreground ring-border";

function EtaBadge({ value }: { value: string }) {
  const b = etaBadge(value);
  if (!b) return null;
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset", etaTone(b.tone))}>{b.text}</span>;
}

// A select of existing values + an "Add new…" escape hatch.
export function ComboSelect({ id, value, options, placeholder, onChange }: {
  id: string; value: string; options: string[]; placeholder: string; onChange: (v: string) => void;
}) {
  const ADD = "__add_new__";
  const [adding, setAdding] = useState(false);
  if (adding) {
    return (
      <div className="flex gap-1.5">
        <input id={id} type="text" autoFocus value={value} placeholder={placeholder} className={inputCls} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" title="Pick from the list instead" onClick={() => setAdding(false)}>
          <ChevronDown className="size-4" />
        </Button>
      </div>
    );
  }
  return (
    <select id={id} value={value} className={inputCls} onChange={(e) => {
      if (e.target.value === ADD) { onChange(""); setAdding(true); } else onChange(e.target.value);
    }}>
      <option value="">— None —</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value={ADD}>＋ Add new…</option>
    </select>
  );
}

// Widget membership is derived from the column metadata (columnMeta.ts) across
// ALL pipelines (ALL_FORM_COLS), so a new pipeline's columns classify correctly
// with no per-column entry here. ETA is a date with a countdown badge.
const ASSIGNEE_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "assignee"));
const MULTILINE_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "textarea"));
const COMBO_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "combo"));
const ETA_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "eta"));
const DATE_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "date" || fieldType(c) === "eta"));

// Membership/role lookups — union across ALL pipelines (cols are unique per system).
const STATUS_COLS = new Set<string>(Object.values(PIPELINES).flatMap((p) => p.stages.map((s) => colOf(s, "status"))));
const ASSIGNEE_ROLE: Record<string, string> = { reviewer_email: "Reviewer", admin_email: "Admin" };
for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
  ASSIGNEE_ROLE[assigneeColOf(s)] = s.role;
  const rc = reviewerColOf(s);
  if (rc) ASSIGNEE_ROLE[rc] = "Reviewer";
}
// Per-stage reviewer fields: blank means "no review — auto-approve on submit".
const REVIEWER_COL_SET = new Set<string>(
  Object.values(PIPELINES).flatMap((p) => p.stages.map(reviewerColOf).filter(Boolean) as string[]),
);

interface SectionDef { id: string; label: string; cols: Column[]; }

/** The brief stage's assignment block + each stage's work fields — per card's pipeline. */
function sectionsForPipeline(stages: StageDef[]): { sections: SectionDef[]; assigneeSeq: string[] } {
  const briefAssignee = stages[0] ? assigneeColOf(stages[0]) : "";
  const assigneeSeq = [...new Set<string>([
    briefAssignee,
    ...stages.flatMap((s) => [
      ...(assigneeColOf(s) !== briefAssignee ? [assigneeColOf(s)] : []),
      ...(reviewerColOf(s) ? [reviewerColOf(s)!] : []),
    ]),
  ])];
  const sections = stages.map((s) => ({
    id: s.id,
    label: isBrief(s) ? "Brief & assignments" : s.label,
    cols: (isBrief(s)
      ? [...briefFieldsOf(s), ...assigneeSeq]
      : [instructionColOf(s), workLinkColOf(s), etaColOf(s), ...extraColsOf(s)]
    ).filter(Boolean) as Column[],
  }));
  return { sections, assigneeSeq };
}

export function CardDetail({ row, columns, roles, names, memberRoles = {}, memberships = {}, readOnly, viewerEmail, contextStageId, perspective = "all", categoryOptions = [], subcategoryOptions = [], onClose, onSaved, onDelete, onApplyDefaults }: CardDetailProps) {
  const locks = row._locks ?? {};
  const actionGroups = row._actions ?? [];
  const isAdmin = isAdminRoles(roles);
  const colSet = new Set<string>(columns);

  // This card's pipeline (system) drives everything below.
  const pipeline = pipeOf(row as Record<string, unknown>);
  const { sections: SECTIONS } = sectionsForPipeline(pipeline.stages);

  // The card is scoped to the stage it was opened from: only that stage's curated
  // fields + actions show. Admins get a "Show all fields" escape hatch.
  const contextStage = stageByIdIn(pipeline, contextStageId ?? "") ?? pipeline.stages[0];
  const [showAll, setShowAll] = useState(false);

  // The form is driven by the control tables: which columns show / are editable
  // depends on (stage, role-kind, current status). `worker` = the stage owner's
  // view (My work); `reviewer` = the card reviewer's view (Review queue).
  const kind: RoleKind = perspective === "reviewer" ? "reviewer" : "worker";
  const ctxStatus = statusOf(contextStage, row);
  const editSet = new Set<string>(editColumns(pipeline, contextStage, kind, ctxStatus));

  const [draft, setDraft] = useState<Partial<Record<Column, string>>>({});
  // Serialize every cell write for this card through one queue, with the
  // last-persisted value held in a ref (not React state). This is what keeps
  // `prev` — the optimistic-lock "expected" value — always current. Without it,
  // a field's auto-save (fired on blur when a button steals focus) and the
  // pre-action flush both read a STALE `savedMap` from their closure and issue
  // two writes for the same cell with the same `prev`; the server sees the
  // second one's `prev` no longer matches and 409s, surfacing a bogus
  // "Couldn't save your changes" even though the value was saved fine. Queued,
  // the flush runs after the auto-save and simply no-ops (value already saved).
  const savedRef = useRef<Partial<Record<Column, string>>>({});
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());

  // Persist one field, serialized behind any in-flight write. Never rejects:
  // resolves { ok:true } on success or when the value is already saved,
  // { ok:false, error } on failure — so the queue chain always stays alive.
  function persistField(col: Column, value: string): Promise<{ ok: boolean; error?: string }> {
    const run = writeQueue.current.then(async (): Promise<{ ok: boolean; error?: string }> => {
      if (!row.row_id) return { ok: true };
      const prev = savedRef.current[col] ?? "";
      if (value === prev) return { ok: true }; // already persisted by an earlier queued write
      try {
        await updateCell(row.row_id, col, value, prev);
        savedRef.current = { ...savedRef.current, [col]: value };
        setTouched(true);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
      }
    });
    writeQueue.current = run; // run never rejects, so the chain survives errors
    return run;
  }
  const [fieldStatus, setFieldStatus] = useState<Partial<Record<Column, "saving" | "saved" | "error">>>({});
  const [touched, setTouched] = useState(false); // did we auto-save anything this session?
  const [errors, setErrors] = useState<Partial<Record<Column, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // "Request changes" note (the box is always shown for a reviewer; the button
  // commits the send-back and is enabled once a note is typed).
  const [feedbackText, setFeedbackText] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  // Link generation (admin).
  const [toolsDraft, setToolsDraft] = useState<any[]>(() => {
    try { return JSON.parse(((row as any).video_tools as string) || "[]"); } catch { return []; }
  });
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
    if (isAdmin && !readOnly && catalog.length === 0 && !catalogLoading) {
      setCatalogLoading(true);
      affiliateCatalog().then(setCatalog).finally(() => setCatalogLoading(false));
    }
  }, [isAdmin, readOnly, catalog.length, catalogLoading]);

  useEffect(() => {
    if (!catalogOpen) return;
    const onDown = (e: MouseEvent) => {
      if (catalogBoxRef.current && !catalogBoxRef.current.contains(e.target as Node)) setCatalogOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [catalogOpen]);

  // One click: reserve the real short-code + build the plan (preview), then mint
  // the redirects + write the description to the card (confirm), then show the
  // finished result read-only. No separate confirm step — the admin already chose
  // the tools, so there's nothing left to approve.
  async function handleGenerate() {
    if (!row.row_id) return;
    setPreviewLoading(true); setPreviewError(null);
    try {
      const plan = await linkPreview(row.row_id);
      await linkConfirm(row.row_id, plan.plan_hash);
      setPreviewData(plan); // plan already carries the real links → display it
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function saveTools(newTools: any[]) {
    const prev = toolsDraft;
    setToolsDraft(newTools);
    if (!row.row_id) return;
    try {
      await saveVideoTools(row.row_id, newTools);
      setPreviewError(null);
      setTouched(true); // so closing the card refreshes the board and the selection rehydrates on reopen
    } catch (err) {
      setToolsDraft(prev); // revert optimistic update so the UI reflects what's actually saved
      setPreviewError(`Couldn't save tools: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const [showActivity, setShowActivity] = useState(false);
  const [events, setEvents] = useState<CardEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const [eventsError, setEventsError] = useState(false);

  useEffect(() => {
    if (showActivity && !eventsLoaded && !eventsLoading && row.row_id) {
      setEventsLoading(true);
      setEventsError(false);
      getCardEvents(row.row_id)
        .then((res) => {
          setEvents(res.events || []);
          setEventsLoaded(true);
        })
        .catch(() => {
          setEvents([]);
          setEventsLoaded(true);
          setEventsError(true);
        })
        .finally(() => {
          setEventsLoading(false);
        });
    }
  }, [showActivity, eventsLoaded, eventsLoading, row.row_id]);

  useEffect(() => {
    const init: Partial<Record<Column, string>> = {};
    for (const col of columns) init[col] = (row[col] as string) ?? "";
    setDraft(init);
    savedRef.current = init;
    setFieldStatus({});
    setTouched(false);
  }, [row, columns]);

  function editableNow(col: Column): boolean {
    if (readOnly) return false;
    if (STATUS_COLS.has(col)) return false;       // driven by action buttons
    if (col === "admin_email") return false;       // founding admin is fixed
    if (col in locks) return false;                // server says it's locked (submitted/approved/gate)
    if (!canEditForRoles(roles, pipeline, col)) return false;
    if (isAdmin) return true;                      // admin edits everything the policy allows
    // Everyone else: only what the control table marks editable at THIS status.
    return editSet.has(col);
  }

  // The card's values as they'd be after saving the current edits — used to
  // evaluate the required-field gate against what's typed, not just what's saved.
  const effectiveRow = { ...row, ...draft } as BoardRow;

  function handleChange(col: Column, value: string) {
    setDraft((d) => ({ ...d, [col]: value }));
    setErrors((e) => ({ ...e, [col]: undefined }));
    setFormError(null);
  }

  // Auto-save a single field (on blur / change). No "Save" button — fields
  // persist themselves through persistField, which tracks the last saved value
  // in savedRef so the optimistic-lock check uses the right expected value.
  async function autoSaveField(col: Column, value: string) {
    if (!row.row_id || !editableNow(col)) return;
    if (value === (savedRef.current[col] ?? "")) return;
    setFieldStatus((s) => ({ ...s, [col]: "saving" }));
    const res = await persistField(col, value);
    if (res.ok) {
      setFieldStatus((s) => ({ ...s, [col]: "saved" }));
      setErrors((e) => ({ ...e, [col]: undefined }));
    } else {
      setFieldStatus((s) => ({ ...s, [col]: "error" }));
      setErrors((e) => ({ ...e, [col]: res.error ?? "Save failed" }));
    }
  }

  // Flush any field not yet auto-saved (e.g. an action fired before a field's
  // blur). Each write is serialized via persistField, so a field already being
  // auto-saved is a no-op here instead of a racing duplicate write. Returns
  // false only on a genuine save error.
  async function flushPending(): Promise<boolean> {
    const newErrors: Partial<Record<Column, string>> = {};
    let anyError = false;
    for (const col of columns) {
      if (!editableNow(col) || !row.row_id) continue;
      const res = await persistField(col, draft[col] ?? "");
      if (!res.ok) { anyError = true; newErrors[col] = res.error ?? "Save failed"; }
    }
    if (anyError) { setErrors(newErrors); return false; }
    return true;
  }

  // Closing the card: if we auto-saved anything, refresh the board (via onSaved)
  // so it reflects the edits; otherwise just close.
  function closeCard() { (touched ? onSaved : onClose)(); }

  async function runTransition(t: Transition, currentStatus: string, feedback?: string) {
    if (!row.row_id) return;
    setActingId(t.stageId + t.to);
    // Flush any not-yet-saved field FIRST, so the status change carries it along.
    if (!(await flushPending())) {
      setActingId(null);
      setFormError("Couldn't save your changes — fix the highlighted fields and try again.");
      return;
    }
    try {
      await applyTransition(row.row_id, t, currentStatus, feedback);
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Action failed");
      setActingId(null);
    }
  }



  // ── Field renderer ─────────────────────────────────────────────────────────
  function renderField(col: Column) {
    // Admin is always the founding admin — show it prefilled and read-only even
    // when the cell is blank.
    const value = col === "admin_email" ? (draft[col] || PROTECTED_ADMIN_EMAIL) : (draft[col] ?? "");
    const label = fieldLabel(col);
    // Link fields read as "<thing> link" with a "public link" placeholder, so a
    // deliverable URL is unambiguous everywhere (e.g. "Outline link" / "Enter the
    // outline public link…"). baseLabel drops any existing "link(s)" suffix.
    const isLink = LINK_COLS.has(col);
    const baseLabel = label.replace(/\s*links?$/i, "");
    const displayLabel = isLink && !/link/i.test(label) ? `${label} link` : label;
    const lockReason = locks[col];
    const editable = editableNow(col);

    if (!editable) {
      return (
        <div key={col} className="space-y-1">
          <div className={labelCls}>{displayLabel}{lockReason && <Lock className="size-3 text-muted-foreground" aria-label={lockReason} />}</div>
          {ETA_COLS.has(col)
            ? <div className="flex items-center gap-2 text-sm">{value || <span className="text-muted-foreground/50">—</span>}<EtaBadge value={value} /></div>
            : ASSIGNEE_COLS.has(col) && value
            ? <div className="text-sm">{displayName(value, names)} <span className="text-xs text-muted-foreground">{value}</span></div>
            : LINK_COLS.has(col) && isUrl(value)
            ? <div className="flex items-center gap-2 text-sm"><span className="min-w-0 truncate text-muted-foreground">{value}</span><a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline">Open <ExternalLink className="size-3" /></a></div>
            : <div className={cn("break-words text-sm", MULTILINE_COLS.has(col) && "whitespace-pre-wrap leading-relaxed")}>{value || <span className="text-muted-foreground/50">—</span>}</div>}
          {lockReason && <div className="text-[11px] text-muted-foreground">{lockReason}</div>}
        </div>
      );
    }

    const err = errors[col];
    const st = fieldStatus[col];
    const indicator =
      st === "saving" ? <span className="text-[11px] text-muted-foreground">Saving…</span>
      : st === "saved" ? <span className="text-[11px] text-emerald-600">Saved ✓</span>
      : null;
    return (
      <div key={col} className="space-y-1">
        <label htmlFor={`f-${col}`} className={labelCls}>{displayLabel}{indicator}</label>
        {COMBO_COLS.has(col) ? (
          <ComboSelect id={`f-${col}`} value={value} options={col === "category" ? categoryOptions : subcategoryOptions}
            placeholder={`New ${label.toLowerCase()}…`} onChange={(v) => { handleChange(col, v); void autoSaveField(col, v); }} />
        ) : ASSIGNEE_COLS.has(col) ? (
          (() => {
            const requiredRole = ASSIGNEE_ROLE[col];
            // Scope to the card's system: only people who hold the required role
            // IN this card's system (reviewers may span systems). A Standard-only
            // freelancer never shows on a Tut-2 card.
            const inSystem = (email: string) =>
              !requiredRole || holdsRoleInSystem(memberships[email.toLowerCase()] ?? {}, pipeline.id, requiredRole);
            const people = Object.keys(names).filter(inSystem).sort((a, b) => names[a].localeCompare(names[b]));
            const cur = value.toLowerCase();
            return (
              <select id={`f-${col}`} value={value} className={inputCls} onChange={(e) => { handleChange(col, e.target.value); void autoSaveField(col, e.target.value); }}>
                <option value="">{REVIEWER_COL_SET.has(col) ? "— No review (auto-approve) —" : "— Unassigned —"}</option>
                {value && !people.includes(cur) && <option value={value}>{personLabel(value, names, memberRoles)}</option>}
                {people.map((email) => (
                  <option key={email} value={email}>{personLabel(email, names, memberRoles)}</option>
                ))}
              </select>
            );
          })()
        ) : DATE_COLS.has(col) ? (
          <div className="flex items-center gap-2">
            <input id={`f-${col}`} type="date" value={value} className={inputCls}
              onChange={(e) => { handleChange(col, e.target.value); void autoSaveField(col, e.target.value); }} />
            {ETA_COLS.has(col) && <EtaBadge value={value} />}
          </div>
        ) : MULTILINE_COLS.has(col) ? (
          <textarea id={`f-${col}`} className={cn(inputCls, "h-auto min-h-24 py-2")} value={value} rows={5} placeholder={`Write the ${label.toLowerCase()}…`}
            onChange={(e) => handleChange(col, e.target.value)} onBlur={(e) => void autoSaveField(col, e.target.value)} />
        ) : (
          <>
            <input id={`f-${col}`} type="text" value={value} className={inputCls}
              placeholder={isLink ? `Enter the ${baseLabel.toLowerCase()} public link…` : `Enter the ${label.toLowerCase()}…`}
              onChange={(e) => handleChange(col, e.target.value)} onBlur={(e) => void autoSaveField(col, e.target.value)} />
            {LINK_COLS.has(col) && isUrl(value) && <a href={value} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline">Open <ExternalLink className="size-3" /></a>}
          </>
        )}
        {LINK_HINTS[col] && <div className="text-[11px] text-muted-foreground">🔗 {LINK_HINTS[col]}</div>}
        {err && <div className="text-[11px] font-medium text-destructive">{err}</div>}
      </div>
    );
  }

  // ── Action area (scoped to the context stage + the viewer's perspective) ─────
  function renderActions() {
    const inPerspective = (t: Transition) => perspective === "all" || t.by === perspective;
    const groups = (showAll ? actionGroups : actionGroups.filter((g) => g.stageId === contextStage.id))
      .map((g) => ({ ...g, transitions: g.transitions.filter(inPerspective) }))
      .filter((g) => g.transitions.length > 0);
    if (readOnly || groups.length === 0) return null;
    return (
      <div className="space-y-4">
        {groups.map((g) => {
          const stage = stageByIdIn(pipeline, g.stageId);
          if (!stage) return null;
          const status = statusOf(stage, row);
          // Raw stored value for the optimistic-lock check (blank stays blank).
          const rawStatus = (row[g.statusCol as Column] as string) ?? "";
          const blockReason = (t: Transition): string | undefined => {
            let cols: string[];
            if (t.kind === "approve") cols = requiredToApprove(pipeline, stage);
            else if (t.kind === "submit" || t.kind === "advance") cols = requiredToSubmitFrom(pipeline, stage, status);
            else if (t.kind === "start" && status === "To Do") cols = requiredToSubmitFrom(pipeline, stage, "To Do");
            else return undefined;
            const missing = missingColumns(cols, effectiveRow as Record<string, unknown>);
            return missing.length ? `Add the ${missing.map(fieldLabel).join(", ")} first.` : undefined;
          };
          const hint = g.transitions.map(blockReason).find(Boolean);
          return (
            <div key={g.stageId} className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <strong className="font-semibold">{stage.label}</strong> <StatusPill status={status} />
              </div>
              {g.transitions.some((t) => !t.requiresFeedback) && (
                <div className="flex flex-wrap gap-2">
                  {g.transitions.filter((t) => !t.requiresFeedback).map((t) => {
                    const reason = blockReason(t);
                    const reject = t.kind === "reject", reopen = t.kind === "reopen";
                    return (
                      <Button key={t.to + t.kind} size="sm"
                        variant={reject ? "outline" : reopen ? "ghost" : "default"}
                        className={cn(reject && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                        disabled={actingId !== null || !!reason} title={reason ?? ""}
                        onClick={() => { if (!reason) void runTransition(t, rawStatus); }}>{t.label}</Button>
                    );
                  })}
                </div>
              )}
              {hint && (
                <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400" role="status">
                  <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
                  <span>{hint}</span>
                </div>
              )}
              {g.transitions.filter((t) => t.requiresFeedback).map((t) => (
                <div key={"fb" + t.to} className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
                  <label className="text-xs font-medium text-foreground/80">Or send it back — say what to change:</label>
                  <textarea className={cn(inputCls, "h-auto min-h-16 py-2")} rows={3} placeholder="What needs to change?"
                    value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
                  <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={actingId !== null || !feedbackText.trim()}
                    onClick={() => void runTransition(t, rawStatus, feedbackText.trim())}>{t.label}</Button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Feedback banners (reviewer notes while a stage is being reworked). ──────
  const feedbackBanners = pipeline.stages
    .filter((s) => (showAll || s.id === contextStage.id) && isReviewable(s) && feedbackColOf(s) && colSet.has(feedbackColOf(s)!) && statusOf(s, row) !== "Done")
    .map((s) => ({ stage: s, text: ((row[feedbackColOf(s)! as Column] as string) ?? "").trim() }))
    .filter((b) => b.text);

  const title = row.video_title ?? "(no title)";

  const contextCols = showColumns(pipeline, contextStage, kind, ctxStatus).filter((c) => colSet.has(c));
  const fullSections = SECTIONS
    .map((sec) => ({ ...sec, cols: sec.cols.filter((c) => colSet.has(c)) }))
    .filter((sec) => sec.cols.length > 0);
  const sectionsToShow = showAll
    ? fullSections
    : [{ id: contextStage.id, label: isBrief(contextStage) ? "Brief & assignments" : contextStage.label, cols: contextCols }]
        .filter((sec) => sec.cols.length > 0);

  const actions = renderActions();

  return (
    <Dialog open onOpenChange={(o) => { if (!o) closeCard(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 pr-6 text-lg tracking-tight">
            <span className="text-balance">{title}</span>
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground/70">{pipeline.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Stage status overview - Journey Rail */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{perspective === "doer" ? "Your part in this video" : "Pipeline progress"}</h3>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-5 px-5 hide-scrollbar">
              {pipeline.stages.filter((s) => colSet.has(colOf(s, "status")) || isAdmin).map((s, i, arr) => {
                const status = statusOf(s, row as Row);
                const done = isStageComplete(s, row as Row);
                const isYou = !!viewerEmail && (row as any)[colOf(s, "assignee")] === viewerEmail;
                const open = isGateOpen(pipeline, s, row as Row);
                const isLast = i === arr.length - 1;
                const since = sinceOf(row as Record<string, unknown>, colOf(s, "status"));
                const days = daysSince(since);
                const holder = holderOf(s, row as Record<string, unknown>, status);
                const holderName = holder.kind !== "none" && holder.email ? displayName(holder.email, names) : undefined;
                const timing =
                  done ? (since ? new Date(since).toLocaleDateString() : undefined)
                  : open && days !== null ? `${days}d in ${status}${holderName ? ` · with ${holderName}` : ""}`
                  : undefined;

                return (
                  <div key={s.id} className="flex items-center shrink-0">
                    <div className={cn(
                      "flex flex-col gap-1.5 rounded-lg border px-3 py-2 transition-all",
                      done ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10" :
                      open ? "border-primary/20 bg-muted/40 shadow-xs" :
                      "border-transparent bg-transparent opacity-50"
                    )}
                    title={!open && s.gate ? `Opens after ${stageByIdIn(pipeline, s.gate)?.label || s.gate} is approved` : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {!open && <Lock className="size-3 text-muted-foreground" />}
                        {done && <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
                        <span className={cn("text-[11px] font-semibold", done ? "text-emerald-700 dark:text-emerald-300" : "text-foreground")}>{s.label}</span>
                        {isYou && <span className="rounded bg-primary/10 px-1 text-[9px] font-bold uppercase tracking-wider text-primary">You</span>}
                      </div>
                      <StatusPill status={status} />
                      {timing && <span className="text-[11px] text-muted-foreground">{timing}</span>}
                    </div>
                    {!isLast && <div className={cn("h-px w-6 mx-1", done ? "bg-emerald-200 dark:bg-emerald-800" : "bg-border")} />}
                  </div>
                );
              })}
            </div>
          </div>

          {feedbackBanners.map(({ stage, text }) => (
            <div key={stage.id} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm dark:border-red-900/50 dark:bg-red-950/40">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0"><div className="font-semibold text-red-800 dark:text-red-200">{stage.label} — changes requested</div><div className="break-words text-red-700 dark:text-red-300">{text}</div></div>
            </div>
          ))}

          {isAdmin && !readOnly && onApplyDefaults && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Button type="button" variant="outline" size="sm" onClick={onApplyDefaults}><RotateCcw className="size-3.5" /> Apply assignment defaults</Button>
              <span className="text-[11px] text-muted-foreground">Fills blank assignees/reviewers from this card&rsquo;s category × subcategory.</span>
            </div>
          )}

          {isAdmin && !readOnly && (
            <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Video tools</h3>
                <span className="text-xs text-muted-foreground">{toolsDraft.length} selected</span>
              </div>
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
            </div>
          )}
          {previewData && (
            <LinkResultModal
              result={previewData}
              onClose={() => { setPreviewData(null); setTouched(true); }}
              onSaveDescription={async (text) => { if (row.row_id) await updateCell(row.row_id, "video_description" as Column, text); }}
            />
          )}

          {/* Field sections — scoped to the context stage; admins can expand to all */}
          <div className="space-y-5">
            {sectionsToShow.map((sec) => (
              <div key={sec.id} className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.label}</div>
                <div className="space-y-3">{sec.cols.map((c) => renderField(c as Column))}</div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show only this stage's fields" : "Show all fields"}
            </button>
          )}

          <div className="border-t border-border pt-4">
            <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-foreground" onClick={() => setShowActivity(!showActivity)}>
              Activity <ChevronDown className={cn("size-4 transition-transform", showActivity && "rotate-180")} />
            </button>
            {showActivity && (
              <div className="mt-4 space-y-4" data-testid="activity-feed">
                {eventsLoading && <div className="text-xs text-muted-foreground">Loading...</div>}
                {!eventsLoading && events.length === 0 && eventsError && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    Couldn't load activity
                    <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEventsLoaded(false)}>Retry</Button>
                  </div>
                )}
                {!eventsLoading && events.length === 0 && !eventsError && <div className="text-xs text-muted-foreground">No activity yet.</div>}
                {!eventsLoading && events.map((ev) => {
                  const stage = stageByIdIn(pipeline, ev.stage_id);
                  const isSendback = ev.type === "sendback" || ev.type === "reopen";
                  return (
                    <div key={ev.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">{stage?.label ?? ev.stage_id}</span>
                        <span className="text-foreground/90">
                          <span className="font-medium">{ev.actorName}</span>
                          {" "}
                          {ev.type === "submit" ? "submitted for review" :
                           ev.type === "approve" ? "approved" :
                           ev.type === "sendback" ? "requested changes" :
                           ev.type === "reopen" ? "reopened" :
                           ev.type === "start" ? "started work" :
                           "completed"}
                        </span>
                        <span className="text-xs text-muted-foreground" title={new Date(ev.created_at).toLocaleString()}>
                          {/* Very crude relative time format since date-fns isn't here; could just show short date */}
                          {new Date(ev.created_at).toLocaleDateString()} {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {isSendback && ev.detail && (
                        <div className="mt-1.5 ml-1 border-l-2 border-red-300 pl-3 py-1 text-sm text-red-800 dark:border-red-900/50 dark:text-red-200 bg-red-50/50 dark:bg-red-950/20 rounded-r-sm">
                          {ev.detail}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isAdmin && !readOnly && onDelete && (
            <div className="border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
                <Trash2 className="size-3.5" /> Delete video
              </Button>
            </div>
          )}
        </div>

        {/* Single action footer — fields above auto-save; this is the one CTA. */}
        {(actions || formError) && (
          <div className="space-y-2 border-t border-border bg-muted/20 px-5 py-4">
            {formError && <div className="text-xs font-medium text-destructive">{formError}</div>}
            {actions}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
