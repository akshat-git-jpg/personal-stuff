export { ComboSelect } from "./CardDetailUtils";
import { useState, useEffect, useRef, useMemo } from "react";
import { Lock, ExternalLink, Trash2, AlertTriangle, RotateCcw, ChevronDown } from "lucide-react";
import type { Column } from "../shared/columns";
import type { Row, Transition } from "../shared/engine/rbac";
import { canEditForRoles, isAdminRoles } from "../shared/engine/rbac";
import { PROTECTED_ADMIN_EMAIL } from "../shared/engine/registry";
import { holdsRoleInSystem } from "../shared/engine/memberships";
import { pipeOf, stageByIdIn, statusOf, showColumns, editColumns, requiredToApprove, requiredToSubmitFrom, missingColumns, colOf, isReviewable, feedbackColOf, isBrief, isStageComplete, isGateOpen, holderOf, sinceOf, type RoleKind } from "./stages";
import { applyTransition, updateCell, displayName, personLabel, getCardEvents, type BoardRow, type CardEvent } from "./api";
import { fieldLabel, LINK_HINTS, LINK_COLS, isUrl } from "./labels";
import { daysSince } from "./pipeline";
import { StatusPill } from "./Card";
import { cn } from "@/lib/utils";
import { inputCls, labelCls, EtaBadge, ASSIGNEE_COLS, MULTILINE_COLS, ETA_COLS, DATE_COLS, STATUS_COLS, ASSIGNEE_ROLE, REVIEWER_COL_SET, sectionsForPipeline } from "./CardDetailUtils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LinkStudio } from "./LinkStudio";
interface CardDetailProps {
  row: BoardRow;
  columns: Column[];
  roles: string[];
  names: Record<string, string>;
  memberRoles?: Record<string, string>;

  memberships?: Record<string, Record<string, string[]>>;
  readOnly?: boolean;
  viewerEmail?: string;

  contextStageId?: string;

  perspective?: "doer" | "reviewer" | "all";
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  onApplyDefaults?: () => void; }

export function CardDetail({ row, columns, roles, names, memberRoles = {}, memberships = {}, readOnly, viewerEmail, contextStageId, perspective = "all", onClose, onSaved, onDelete, onApplyDefaults }: CardDetailProps) {
  const locks = row._locks ?? {};
  const actionGroups = row._actions ?? [];
  const isAdmin = isAdminRoles(roles);
  const colSet = new Set<string>(columns);

  const pipeline = pipeOf(row as Record<string, unknown>);
  const { sections: SECTIONS } = sectionsForPipeline(pipeline.stages);

  const contextStage = stageByIdIn(pipeline, contextStageId ?? "") ?? pipeline.stages[0];
  const [showAll, setShowAll] = useState(false);

  const kind: RoleKind = perspective === "reviewer" ? "reviewer" : "worker";
  const ctxStatus = statusOf(contextStage, row);
  const editSet = new Set<string>(editColumns(pipeline, contextStage, kind, ctxStatus));
  const [draft, setDraft] = useState<Partial<Record<Column, string>>>({});

  const savedRef = useRef<Partial<Record<Column, string>>>({});
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve());

  function persistField(col: Column, value: string): Promise<{ ok: boolean; error?: string }> {
    const run = writeQueue.current.then(async (): Promise<{ ok: boolean; error?: string }> => {
      if (!row.row_id) return { ok: true };
      const prev = savedRef.current[col] ?? "";
      if (value === prev) return { ok: true };
      try {
        await updateCell(row.row_id, col, value, prev);
        savedRef.current = { ...savedRef.current, [col]: value };
        setTouched(true);
        return { ok: true }; } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Save failed" }; } });
    writeQueue.current = run;
    return run; }
  const [fieldStatus, setFieldStatus] = useState<Partial<Record<Column, "saving" | "saved" | "error">>>({});
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Column, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  // The doer's side of the same conversation: what changed, per stage.
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  // The link generator lives back on the card (it belongs to ONE video), but
  // folded: the panel's job is the stage work, and the generator is a sub-app.
  const [showLinks, setShowLinks] = useState(false);
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
          setEventsLoaded(true); })
        .catch(() => {
          setEvents([]);
          setEventsLoaded(true);
          setEventsError(true); })
        .finally(() => {
          setEventsLoading(false); }); } }, [showActivity, eventsLoaded, eventsLoading, row.row_id]);
  useEffect(() => {
    const init: Partial<Record<Column, string>> = {};
    for (const col of columns) init[col] = (row[col] as string) ?? "";
    setDraft(init);
    savedRef.current = init;
    setFieldStatus({});
    setTouched(false); }, [row, columns]);
  function editableNow(col: Column): boolean {
    if (readOnly) return false;
    if (STATUS_COLS.has(col)) return false;
    if (col === "admin_email") return false;
    if (col in locks) return false;
    if (!canEditForRoles(roles, pipeline, col)) return false;
    if (isAdmin) return true;

    return editSet.has(col); }

  const effectiveRow = { ...row, ...draft } as BoardRow;
  function handleChange(col: Column, value: string) {
    setDraft((d) => ({ ...d, [col]: value }));
    setErrors((e) => ({ ...e, [col]: undefined }));
    setFormError(null); }

  async function autoSaveField(col: Column, value: string) {
    if (!row.row_id || !editableNow(col)) return;
    if (value === (savedRef.current[col] ?? "")) return;
    setFieldStatus((s) => ({ ...s, [col]: "saving" }));
    const res = await persistField(col, value);
    if (res.ok) {
      setFieldStatus((s) => ({ ...s, [col]: "saved" }));
      setErrors((e) => ({ ...e, [col]: undefined })); } else {
      setFieldStatus((s) => ({ ...s, [col]: "error" }));
      setErrors((e) => ({ ...e, [col]: res.error ?? "Save failed" })); } }

  async function flushPending(): Promise<boolean> {
    const newErrors: Partial<Record<Column, string>> = {};
    let anyError = false;
    for (const col of columns) {
      if (!editableNow(col) || !row.row_id) continue;
      const res = await persistField(col, draft[col] ?? "");
      if (!res.ok) {
        anyError = true;
        newErrors[col] = res.error ?? "Save failed"; } }
    if (anyError) {
      setErrors(newErrors);
      return false; }
    return true; }

  function closeCard() {
    (touched ? onSaved : onClose)(); }
  async function runTransition(t: Transition, currentStatus: string, feedback?: string) {
    if (!row.row_id) return;
    setActingId(t.stageId + t.to);

    if (!(await flushPending())) {
      setActingId(null);
      setFormError("Couldn't save your changes — fix the highlighted fields and try again.");
      return; }
    try {
      await applyTransition(row.row_id, t, currentStatus, feedback);
      onSaved();
      onClose(); } catch (err) {
      setFormError(err instanceof Error ? err.message : "Action failed");
      setActingId(null); } }

  function renderField(col: Column) {
    const value = col === "admin_email" ? draft[col] || PROTECTED_ADMIN_EMAIL : (draft[col] ?? "");
    const label = fieldLabel(col);

    const isLink = LINK_COLS.has(col);
    const baseLabel = label.replace(/\s*links?$/i, "");
    const displayLabel = isLink && !/link/i.test(label) ? `${label} link` : label;
    const lockReason = locks[col];
    const editable = editableNow(col);
    if (!editable) {
      return ( <div key={col} className="space-y-1"> <div className={labelCls}> {displayLabel} {lockReason && <Lock className="size-3 text-muted-foreground" aria-label={lockReason} />} </div> {ETA_COLS.has(col) ? (
            <div className="flex items-center gap-2 text-sm"> {value || <span className="text-muted-foreground/50">—</span>} <EtaBadge value={value} /> </div>
          ) : ASSIGNEE_COLS.has(col) && value ? ( <div className="text-sm"> {displayName(value, names)} <span className="text-xs text-muted-foreground">{value}</span> </div>
          ) : LINK_COLS.has(col) && isUrl(value) ? ( <div className="flex items-center gap-2 text-sm"> <span className="min-w-0 truncate text-muted-foreground">{value}</span> <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline">
                Open <ExternalLink className="size-3" /> </a> </div>
          ) : ( <div className={cn("break-words text-sm", MULTILINE_COLS.has(col) && "whitespace-pre-wrap leading-relaxed")}>{value || <span className="text-muted-foreground/50">—</span>}</div>
          )} {lockReason && <div className="text-[11px] text-muted-foreground">{lockReason}</div>} </div>
      ); }
    const err = errors[col];
    const st = fieldStatus[col];
    const indicator = st === "saving" ? <span className="text-[11px] text-muted-foreground">Saving…</span> : st === "saved" ? <span className="text-[11px] text-emerald-600">Saved ✓</span> : null;
    return ( <div key={col} className="space-y-1"> <label htmlFor={`f-${col}`} className={labelCls}> {displayLabel} {indicator} </label> {ASSIGNEE_COLS.has(col) ? (
          (() => {
            const requiredRole = ASSIGNEE_ROLE[col];

            const inSystem = (email: string) => !requiredRole || holdsRoleInSystem(memberships[email.toLowerCase()] ?? {}, pipeline.id, requiredRole);
            const people = Object.keys(names)
              .filter(inSystem)
              .sort((a, b) => names[a].localeCompare(names[b]));
            const cur = value.toLowerCase();
            return ( <select
                id={`f-${col}`}
                value={value}
                className={inputCls}
                onChange={(e) => {
                  handleChange(col, e.target.value);
                  void autoSaveField(col, e.target.value); }} > <option value="">{REVIEWER_COL_SET.has(col) ? "— No review (auto-approve) —" : "— Unassigned —"}</option> {value && !people.includes(cur) && <option value={value}>{personLabel(value, names, memberRoles)}</option>}
                {people.map((email) => ( <option key={email} value={email}> {personLabel(email, names, memberRoles)} </option>
                ))} </select>
            ); })()
        ) : DATE_COLS.has(col) ? ( <div className="flex items-center gap-2"> <input
              id={`f-${col}`}
              type="date"
              value={value}
              className={inputCls}
              onChange={(e) => {
                handleChange(col, e.target.value);
                void autoSaveField(col, e.target.value); }} /> {ETA_COLS.has(col) && <EtaBadge value={value} />} </div>
        ) : MULTILINE_COLS.has(col) ? ( <textarea id={`f-${col}`} className={cn(inputCls, "h-auto min-h-24 py-2")} value={value} rows={5} placeholder={`Write the ${label.toLowerCase()}…`} onChange={(e) => handleChange(col, e.target.value)} onBlur={(e) => void autoSaveField(col, e.target.value)} />
        ) : ( <> <input id={`f-${col}`} type="text" value={value} className={inputCls} placeholder={isLink ? `Enter the ${baseLabel.toLowerCase()} public link…` : `Enter the ${label.toLowerCase()}…`} onChange={(e) => handleChange(col, e.target.value)} onBlur={(e) => void autoSaveField(col, e.target.value)} />
            {LINK_COLS.has(col) && isUrl(value) && ( <a href={value} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                Open <ExternalLink className="size-3" /> </a>
            )} </>
        )} {LINK_HINTS[col] && <div className="text-[11px] text-muted-foreground">🔗 {LINK_HINTS[col]}</div>} {err && <div className="text-[11px] font-medium text-destructive">{err}</div>} </div>
    ); }

  const inPerspective = (t: Transition) => perspective === "all" || t.by === perspective;
  const visibleGroups = readOnly ? [] : actionGroups.map((g) => ({ ...g, transitions: g.transitions.filter(inPerspective) })).filter((g) => g.transitions.length > 0);
  function renderStageActions(stageId: string) {
    const g = visibleGroups.find((x) => x.stageId === stageId);
    const stage = g ? stageByIdIn(pipeline, g.stageId) : undefined;
    if (!g || !stage) return null;
    const status = statusOf(stage, row);

    const rawStatus = (row[g.statusCol as Column] as string) ?? "";
    const feedback = feedbackTexts[g.stageId] ?? "";
    const note = noteTexts[g.stageId] ?? "";
    /** A move that needs words typed first can't be a plain button. */
    const needsWords = (t: Transition) => t.requiresFeedback || t.requiresNote;
    const blockReason = (t: Transition): string | undefined => {
      let cols: string[];
      if (t.kind === "approve") cols = requiredToApprove(pipeline, stage);
      else if (t.kind === "submit" || t.kind === "advance") cols = requiredToSubmitFrom(pipeline, stage, status);
      else if (t.kind === "start" && status === "To Do") cols = requiredToSubmitFrom(pipeline, stage, "To Do");
      else return undefined;
      const missing = missingColumns(cols, effectiveRow as Record<string, unknown>);
      return missing.length ? `Add the ${missing.map(fieldLabel).join(", ")} first.` : undefined; };
    const hint = g.transitions.map(blockReason).find(Boolean);
    return ( <div key={g.stageId} className="space-y-2"> <div className="flex items-center gap-2 text-sm"> <strong className="font-semibold">{stage.label}</strong> <StatusPill status={status} /> </div>
        {g.transitions.some((t) => !needsWords(t)) && ( <div className="flex flex-wrap gap-2"> {g.transitions
              .filter((t) => !needsWords(t))
              .map((t) => {
                const reason = blockReason(t);
                const reject = t.kind === "reject",
                  reopen = t.kind === "reopen";
                return ( <Button
                    key={t.to + t.kind}
                    size="sm"
                    variant={reject ? "outline" : reopen ? "ghost" : "default"}
                    className={cn(reject && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                    disabled={actingId !== null || !!reason}
                    title={reason ?? ""}
                    onClick={() => {
                      if (!reason) void runTransition(t, rawStatus); }} > {t.label} </Button>
                ); })} </div>
        )} {hint && ( <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400" role="status"> <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
            <span>{hint}</span> </div>
        )} {g.transitions
          .filter((t) => t.requiresNote)
          .map((t) => {
            const reason = blockReason(t);
            // A resubmit answers a send-back, so ask the pointed question then;
            // a first submit is an introduction, so ask the open one.
            const resubmit = status === "Need Changes";
            return ( <div key={"note" + t.to} data-testid="submit-note-box" className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
                <label className="text-xs font-medium text-foreground/80" htmlFor={`note-${g.stageId}`}>
                  {resubmit ? "What did you change? The reviewer reads this first." : "Anything the reviewer should know before they look?"}
                </label>
                <textarea id={`note-${g.stageId}`} data-testid="submit-note-input" className={cn(inputCls, "h-auto min-h-16 py-2")} rows={3}
                  placeholder={resubmit ? "Fixed the audio drift at 4:10 and re-cut the intro." : "Recorded at 1440p; the last 20s are a placeholder."}
                  value={note} onChange={(e) => setNoteTexts((m) => ({ ...m, [g.stageId]: e.target.value }))} />
                <Button size="sm" data-testid="submit-note-send" disabled={actingId !== null || !note.trim() || !!reason}
                  title={reason ?? (note.trim() ? "" : "Add a note first")}
                  onClick={() => { if (!reason) void runTransition(t, rawStatus, note.trim()); }}>
                  {t.label} </Button> </div>
            ); })} {g.transitions
          .filter((t) => t.requiresFeedback)
          .map((t) => ( <div key={"fb" + t.to} className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3"> <label className="text-xs font-medium text-foreground/80">Or send it back — say what to change:</label>
              <textarea className={cn(inputCls, "h-auto min-h-16 py-2")} rows={3} placeholder="What needs to change?" value={feedback} onChange={(e) => setFeedbackTexts((m) => ({ ...m, [g.stageId]: e.target.value }))} />
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={actingId !== null || !feedback.trim()} onClick={() => void runTransition(t, rawStatus, feedback.trim())}>
                {t.label} </Button> </div>
          ))} </div>
    ); }

  // Links are only mintable once the video has cleared its way to Upload — before
  // that there is nothing to describe. Admin-only: the catalog endpoint is too.
  const uploadStage = pipeline.stages.find((s) => s.id === "upload");
  const linksReady = isAdmin && !readOnly && !!row.row_id && !!uploadStage
    && isGateOpen(pipeline, uploadStage, row as Record<string, unknown>);
  const initialToolsStr = ((row as Record<string, unknown>).video_tools as string) || "[]";
  const initialTools = useMemo(() => {
    try { return JSON.parse(initialToolsStr) as unknown[]; } catch { return []; }
  }, [initialToolsStr]);
  const toolCount = initialTools.length;

  const feedbackBanners = pipeline.stages
    .filter((s) => (showAll || s.id === contextStage.id) && isReviewable(s) && feedbackColOf(s) && colSet.has(feedbackColOf(s)!) && statusOf(s, row) !== "Done")
    .map((s) => ({ stage: s, text: ((row[feedbackColOf(s)! as Column] as string) ?? "").trim() }))
    .filter((b) => b.text);
  const title = row.video_title ?? "(no title)";
  const contextCols = showColumns(pipeline, contextStage, kind, ctxStatus).filter((c) => colSet.has(c));
  const fullSections = SECTIONS.map((sec) => ({ ...sec, cols: sec.cols.filter((c) => colSet.has(c)) })).filter((sec) => sec.cols.length > 0);
  const sectionsToShow = showAll ? fullSections : [{ id: contextStage.id, label: isBrief(contextStage) ? "Brief & assignments" : contextStage.label, cols: contextCols }].filter((sec) => sec.cols.length > 0);
  const actions = renderStageActions(contextStage.id);

  const railStages = pipeline.stages.filter((s) => colSet.has(colOf(s, "status")) || isAdmin);
  const liveStage = railStages.find((s) => !isStageComplete(s, row as Row) && isGateOpen(pipeline, s, row as Row));
  const whereLine = (() => {
    if (!liveStage) return "Every stage done";
    const st = statusOf(liveStage, row as Row);
    const holder = holderOf(liveStage, row as Record<string, unknown>, st);
    const who = holder.kind !== "none" && holder.email ? displayName(holder.email, names) : "";
    const days = daysSince(sinceOf(row as Record<string, unknown>, colOf(liveStage, "status")));
    return [liveStage.label, st.toLowerCase(), who && `with ${who}`, days === null ? "" : `${days}d`].filter(Boolean).join(" · "); })();
  return ( <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeCard(); }} > <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"> <DialogHeader className="border-b border-border px-5 py-4"> <DialogTitle className="flex items-center gap-2 pr-6 text-lg tracking-tight">
            <span className="text-balance">{title}</span> <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground/70">{pipeline.name}</span> </DialogTitle>
        </DialogHeader> {} <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4"> {} <div className="space-y-2" data-testid="card-detail-your-part"> <div className="flex items-baseline justify-between gap-3"> <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{perspective === "doer" ? "Your part in this video" : "Progress"}</h3>
              <span className="text-xs text-muted-foreground">{whereLine}</span> </div> <div className="flex items-center gap-1.5"> {railStages.map((s) => {
                const done = isStageComplete(s, row as Row);
                const live = s.id === liveStage?.id;
                return ( <div key={s.id} className="flex-1" title={`${s.label}: ${done ? "done" : live ? statusOf(s, row as Row) : !isGateOpen(pipeline, s, row as Row) && s.gate ? `opens after ${stageByIdIn(pipeline, s.gate)?.label ?? s.gate} is approved` : "not open yet"}`}>
                    <div className={cn("h-1.5 w-full rounded-full", done ? "bg-emerald-500" : live ? "bg-primary ring-4 ring-primary/20" : "bg-border")} /> </div>
                ); })} </div> <div className="flex items-center gap-1.5"> {railStages.map((s) => {
                const isYou = !!viewerEmail && (row as Record<string, unknown>)[colOf(s, "assignee")] === viewerEmail;
                const live = s.id === liveStage?.id;
                return ( <div key={s.id} className={cn("flex-1 truncate text-center text-[10px] tracking-wide", live ? "font-semibold text-foreground" : "text-muted-foreground", isYou && !live && "text-foreground/70")} title={isYou ? `${s.label} — yours` : s.label}>
                    {s.label} {isYou && <span className="text-primary"> ·</span>} </div>
                ); })} </div> </div> {feedbackBanners.map(({ stage, text }) => ( <div key={stage.id} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm dark:border-red-900/50 dark:bg-red-950/40">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" /> <div className="min-w-0"> <div className="font-semibold text-red-800 dark:text-red-200">{stage.label} — changes requested</div>
                <div className="break-words text-red-700 dark:text-red-300">{text}</div> </div> </div>
          ))} {isAdmin && !readOnly && onApplyDefaults && ( <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" title="Fills blank assignees and reviewers from this card's category × subcategory." onClick={onApplyDefaults}>
              <RotateCcw className="size-3.5" /> Apply assignment defaults </Button>
          )}  {} <div className="space-y-5">
            {/* eslint-disable-next-line react-hooks/refs */}
            {sectionsToShow.map((sec) => ( <div key={sec.id} className="space-y-3"> <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec.label}</div> <div className="space-y-3">{sec.cols.map((c) => renderField(c as Column))}</div>
                {} {sec.id !== contextStage.id && renderStageActions(sec.id)} </div>
            ))} </div> {isAdmin && ( <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setShowAll((v) => !v)}> {showAll ? "Show only this stage's fields" : "Show all fields"}
            </button>
          )} {linksReady && ( <div className="mt-6 border-t border-border pt-4"> <button type="button" data-testid="card-links-toggle" className="flex items-center gap-1.5 text-sm font-semibold text-foreground" onClick={() => setShowLinks((v) => !v)}>
              Affiliate links &amp; description <ChevronDown className={cn("size-4 transition-transform", showLinks && "rotate-180")} /> </button>
            {!showLinks && <div className="mt-1 text-xs text-muted-foreground">{toolCount > 0 ? `${toolCount} tool${toolCount === 1 ? "" : "s"} picked` : "Pick the tools this video mentions, then mint the links."}</div>}
            {showLinks && ( <div className="mt-4" data-testid="card-link-studio">
                <LinkStudio rowId={row.row_id!} videoTitle={row.video_title || row.row_id!} initialTools={initialTools} onSaved={onSaved} /> </div>
            )} </div>
        )} <div className="border-t border-border pt-4"> <button type="button" className="flex items-center gap-1.5 text-sm font-semibold text-foreground" onClick={() => setShowActivity(!showActivity)}>
              Activity <ChevronDown className={cn("size-4 transition-transform", showActivity && "rotate-180")} /> </button> {showActivity && ( <div className="mt-4 space-y-4" data-testid="activity-feed">
                {eventsLoading && <div className="text-xs text-muted-foreground">Loading...</div>} {!eventsLoading && events.length === 0 && eventsError && ( <div className="flex items-center gap-2 text-xs text-destructive">
                    Couldn't load activity <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEventsLoaded(false)}>
                      Retry </Button> </div>
                )} {!eventsLoading && events.length === 0 && !eventsError && <div className="text-xs text-muted-foreground">No activity yet.</div>} {!eventsLoading &&
                  events.map((ev) => {
                    const stage = stageByIdIn(pipeline, ev.stage_id);
                    const isSendback = ev.type === "sendback" || ev.type === "reopen";
                    return ( <div key={ev.id} className="text-sm"> <div className="flex items-center gap-2"> <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">{stage?.label ?? ev.stage_id}</span>
                          <span className="text-foreground/90"> <span className="font-medium">{ev.actorName}</span> {ev.type === "submit" ? "submitted for review" : ev.type === "approve" ? "approved" : ev.type === "sendback" ? "requested changes" : ev.type === "reopen" ? "reopened" : ev.type === "start" ? "started work" : "completed"}
                          </span> <span className="text-xs text-muted-foreground" title={new Date(ev.created_at).toLocaleString()}> {} {new Date(ev.created_at).toLocaleDateString()} {new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span> </div> {isSendback && ev.detail && <div className="mt-1.5 ml-1 border-l-2 border-red-300 pl-3 py-1 text-sm text-red-800 dark:border-red-900/50 dark:text-red-200 bg-red-50/50 dark:bg-red-950/20 rounded-r-sm">{ev.detail}</div>}
                        {} {ev.type === "submit" && ev.detail && <div data-testid="activity-submit-note" className="mt-1.5 ml-1 rounded-r-sm border-l-2 border-border bg-muted/40 py-1 pl-3 text-sm text-foreground/80">{ev.detail}</div>}
                      </div>
                    ); })} </div>
            )} </div> {isAdmin && !readOnly && onDelete && ( <div className="border-t border-border pt-3"> <Button type="button" variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
                <Trash2 className="size-3.5" /> Delete video </Button> </div>
          )} </div> {} {(actions || formError) && ( <div className="max-h-[40vh] shrink-0 space-y-2 overflow-y-auto border-t border-border bg-muted/20 px-5 py-4"> {formError && <div className="text-xs font-medium text-destructive">{formError}</div>}
            {actions} </div>
        )} </DialogContent> </Dialog>
  ); }