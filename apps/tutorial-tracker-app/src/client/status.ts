// Status display: one consistent label + colour for every lifecycle state,
// used identically on cards, lanes, pills, and the legend.

export interface StatusMeta { label: string; tone: string; } // tone -> CSS class suffix

export const STATUS_META: Record<string, StatusMeta> = {
  "To Do":        { label: "To Do",         tone: "todo" },
  "In Progress":  { label: "In Progress",   tone: "prog" },
  "In Review":    { label: "In Review",     tone: "review" },
  "Need Changes": { label: "Needs changes", tone: "warn" },
  "Done":         { label: "Done",          tone: "done" },
  "Uploaded":     { label: "Uploaded",      tone: "pub" },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status || "To Do", tone: "todo" };
}

// Functional colour per tone, expressed as Tailwind classes so cards, lanes,
// pills and the legend stay in lockstep. Status hues are semantic (not the amber
// brand accent): neutral / blue / amber / red / emerald / violet.
export const TONE_BADGE: Record<string, string> = {
  todo:   "bg-muted text-muted-foreground ring-border",
  prog:   "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-400/20",
  review: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20",
  warn:   "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",
  done:   "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20",
  pub:    "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-400/20",
};

export const TONE_DOT: Record<string, string> = {
  todo:   "bg-neutral-400",
  prog:   "bg-blue-500",
  review: "bg-amber-500",
  warn:   "bg-red-500",
  done:   "bg-emerald-500",
  pub:    "bg-violet-500",
};

export function toneBadge(tone: string): string { return TONE_BADGE[tone] ?? TONE_BADGE.todo; }
export function toneDot(tone: string): string { return TONE_DOT[tone] ?? TONE_DOT.todo; }

/** The ordered legend shown to users so the colour system is learnable. */
export const STATUS_LEGEND: string[] = ["To Do", "In Progress", "In Review", "Need Changes", "Done"];
