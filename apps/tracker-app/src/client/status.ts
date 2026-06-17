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

/** The ordered legend shown to users so the colour system is learnable. */
export const STATUS_LEGEND: string[] = ["To Do", "In Progress", "In Review", "Need Changes", "Done"];
