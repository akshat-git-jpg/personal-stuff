import { useState } from "react";
import { Clock, Trash2, Hourglass, Link2, CalendarDays } from "lucide-react";
import type { Row, Transition } from "../shared/engine/rbac";
import {
  pipeOf, stageByStatusColIn, normalizeStatusIn, feedbackColOf, assigneeColOf, sinceOf,
  etaColOf, workLinkColOf, requiredToSubmitFrom, missingColumns,
} from "./stages";
import { displayName } from "./api";
import { daysSince } from "./pipeline";
import { statusMeta, toneBadge, toneDot } from "./status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CardProps {
  row: Row;
  statusCol: string;             // the lane/status column this card is shown under
  transitions?: Transition[];    // allowed transitions for this stage + user
  names?: Record<string, string>;
  readOnly?: boolean;
  showAssignee?: boolean;        // admin/reviewer views where many people mix
  showDwell?: boolean;           // show "in <status> since N days"
  showStage?: boolean;           // name the stage in the meta line
  showSystem?: boolean;          // name the system in the meta line
  canDelete?: boolean;           // admin: show the delete affordance
  footNote?: string;             // e.g. "Then yours: Thumbnail" — the same card's later stage
  onDelete?: () => void;
  onOpen: () => void;
  onAction?: (t: Transition) => void;
  /** Save one field straight from the card (inline ETA / work link). */
  onSaveField?: (col: string, value: string, prev: string) => void;
}

// One status pill, identical on cards / lanes / legend.
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", toneBadge(meta.tone), className)}>
      <span className={cn("size-1.5 rounded-full", toneDot(meta.tone))} />
      {meta.label}
    </span>
  );
}

/**
 * One inline field the doer can fill without leaving the card. The old UI put
 * the ETA and the work link behind the detail modal, then blocked the action
 * button with a warning ("Add the Script ETA first") — two steps to learn one
 * thing. Here the field sits next to the button that needs it.
 */
function InlineField({
  icon, label, type, placeholder, value, locked, attention, onCommit,
}: {
  icon: React.ReactNode;
  label?: string;
  type: "date" | "url";
  placeholder?: string;
  value: string;
  locked?: string;
  /** This is the empty field holding the action back — say so visually. */
  attention?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Re-sync when the server value changes under us (after a board reload). This
  // is React's adjust-state-when-a-prop-changes pattern — an effect here would
  // render the stale value once first, and flash the old text back at the user.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setDraft(value); }

  const commit = () => { if (draft.trim() !== value.trim()) onCommit(draft.trim()); };

  return (
    <label
      title={locked}
      className={cn(
        "flex h-9 min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 shadow-xs transition",
        attention && !locked ? "border-primary/70 ring-2 ring-primary/20" : "border-input",
        locked ? "opacity-60" : "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        type === "url" && "flex-1",
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {label && <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>}
      <input
        type={type === "date" ? "date" : "text"}
        value={draft}
        placeholder={placeholder}
        disabled={!!locked}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") { e.preventDefault(); commit(); (e.target as HTMLInputElement).blur(); }
        }}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
      />
    </label>
  );
}

export function Card({
  row, statusCol, transitions = [], names = {}, readOnly, showAssignee, showDwell,
  showStage, showSystem, canDelete, footNote, onDelete, onOpen, onAction, onSaveField,
}: CardProps) {
  const p = pipeOf(row as Record<string, unknown>);
  const stage = stageByStatusColIn(p, statusCol);
  const status = stage ? normalizeStatusIn(stage, row[statusCol as keyof Row] as string) : "To Do";
  const meta = statusMeta(status);

  // Days THIS STAGE has sat in its current status (falls back to the card-level
  // stamp for stages that predate per-stage `_since` tracking).
  const dwell = showDwell ? daysSince(sinceOf(row as Record<string, unknown>, statusCol)) : null;

  const title = row.video_title ?? "(no title)";
  const notes = row.video_notes ?? "";

  // Need-Changes reason (always present by construction when status is Need Changes).
  const feedbackCol = stage ? feedbackColOf(stage) : undefined;
  const feedback = feedbackCol ? ((row[feedbackCol as keyof Row] as string) ?? "").trim() : "";

  const assigneeCol = stage ? assigneeColOf(stage) : undefined;
  const assignee = assigneeCol ? ((row[assigneeCol as keyof Row] as string) ?? "") : "";

  // One meta line instead of a row of chips. The old card stacked a status pill,
  // a stage chip, a system chip, a clock chip and the assignee ABOVE the title,
  // which buried the one thing you scan for.
  const metaParts: string[] = [];
  if (showStage && stage) metaParts.push(stage.label);
  if (showSystem) metaParts.push(p.name);
  if (showAssignee && assignee) metaParts.push(displayName(assignee, names));

  const locks = (row as Record<string, unknown>)._locks as Record<string, string> | undefined;
  const etaCol = stage ? etaColOf(stage) : undefined;
  const linkCol = stage ? workLinkColOf(stage) : undefined;
  const etaValue = etaCol ? String((row as Record<string, unknown>)[etaCol] ?? "") : "";
  const linkValue = linkCol ? String((row as Record<string, unknown>)[linkCol] ?? "") : "";

  const canEditInline = !readOnly && !!onSaveField;
  // The ETA is what the doer promises; ask for it while the work is still ahead.
  const showEta = canEditInline && !!etaCol && (status === "To Do" || status === "In Progress" || status === "Need Changes");
  // The deliverable link is only meaningful once the work is under way.
  const showLink = canEditInline && !!linkCol && (status === "In Progress" || status === "Need Changes");

  const blocked = transitions.find((t) => t.disabledReason);
  // Which required fields are still empty — so the ring lands on the exact input
  // the button is waiting for, instead of only naming it in a sentence.
  const missing = blocked && stage
    ? missingColumns(requiredToSubmitFrom(p, stage, status), row as Record<string, unknown>)
    : [];

  return (
    <article
      role="button" tabIndex={0} aria-label={title}
      onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-[10px] border border-border bg-card p-4 text-left shadow-xs transition-all hover:border-foreground/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-balance text-foreground">{title}</h3>
          {metaParts.length > 0 && (
            <div className="text-xs text-muted-foreground">{metaParts.join(" · ")}</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {dwell !== null && (
            <span className="inline-flex items-center gap-1 pt-0.5 text-[11px] tabular-nums text-muted-foreground"
              title={`In ${meta.label} for ${dwell} day${dwell === 1 ? "" : "s"}`}>
              <Clock className="size-3" /> {dwell === 0 ? "today" : `${dwell}d`}
            </span>
          )}
          {canDelete && onDelete && (
            <button type="button" title="Delete this video" aria-label={`Delete ${title}`}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="rounded-md p-1 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {notes && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">{notes}</p>}

      {status === "Need Changes" && feedback && (
        <div className="break-words rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <span className="font-semibold">Needs changes:</span> {feedback}
          {dwell !== null && <span className="block pt-0.5 text-[11px] text-red-700/70 dark:text-red-300/70">sent back {dwell === 0 ? "today" : `${dwell}d ago`}</span>}
        </div>
      )}

      {(showEta || showLink) && (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {showEta && etaCol && (
            <InlineField
              icon={<CalendarDays className="size-3.5" />}
              label="Finish by"
              type="date"
              value={etaValue}
              locked={locks?.[etaCol]}
              attention={missing.includes(etaCol)}
              onCommit={(next) => onSaveField?.(etaCol, next, etaValue)}
            />
          )}
          {showLink && linkCol && (
            <InlineField
              icon={<Link2 className="size-3.5" />}
              type="url"
              placeholder={`Paste the ${(stage?.label ?? "work").toLowerCase()} link`}
              value={linkValue}
              locked={locks?.[linkCol]}
              attention={missing.includes(linkCol)}
              onCommit={(next) => onSaveField?.(linkCol, next, linkValue)}
            />
          )}
        </div>
      )}

      {!readOnly && transitions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {transitions.map((t, i) => {
            const reject = t.kind === "reject";
            // One clear primary action per card; anything else stays quiet.
            const primary = i === 0 && !reject;
            return (
              <Button
                key={t.to + t.kind}
                size="sm"
                variant={primary ? "default" : reject ? "outline" : "ghost"}
                disabled={!!t.disabledReason}
                title={t.disabledReason ?? ""}
                className={cn("h-11 sm:h-9 px-3.5 text-[13px]", reject && "border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                onClick={() => { if (t.disabledReason) return; if (t.requiresFeedback || t.requiresNote) onOpen(); else onAction?.(t); }}
              >
                {t.label}
              </Button>
            );
          })}
          {blocked && (
            <span className="text-[11px] leading-relaxed text-muted-foreground" role="status">{blocked.disabledReason}</span>
          )}
        </div>
      )}

      {!readOnly && status === "In Review" && transitions.length === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Hourglass className="size-3" /> Waiting for review
        </div>
      )}

      {footNote && <div className="text-[11px] text-muted-foreground/70">{footNote}</div>}
    </article>
  );
}
