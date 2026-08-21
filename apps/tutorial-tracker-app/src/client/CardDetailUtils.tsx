import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { etaBadge } from "./labels";
import { fieldType, ALL_FORM_COLS } from "./columnMeta";
import { PIPELINES } from "../shared/engine/registry";
import { colOf, assigneeColOf, reviewerColOf, isBrief, briefFieldsOf, instructionColOf, workLinkColOf, etaColOf, extraColsOf, type StageDef } from "./stages";
import type { Column } from "../shared/columns";

export const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";
export const labelCls = "flex items-center gap-1.5 text-xs font-medium text-foreground/80";

export const ETA_TONE: Record<string, string> = {
  over: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",
  late: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",
  soon: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20",
  today: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/20",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-400/20",
};
const etaTone = (t: string) => ETA_TONE[t] ?? "bg-muted text-muted-foreground ring-border";
export function EtaBadge({ value }: { value: string }) {
  const b = etaBadge(value);
  if (!b) return null;
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset", etaTone(b.tone))}>{b.text}</span>;
}
export function ComboSelect({ id, value, options, placeholder, onChange }: { id: string; value: string; options: string[]; placeholder: string; onChange: (v: string) => void }) {
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
    <select
      id={id}
      value={value}
      className={inputCls}
      onChange={(e) => {
        if (e.target.value === ADD) {
          onChange("");
          setAdding(true);
        } else onChange(e.target.value);
      }}
    >
      <option value="">— None —</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={ADD}>＋ Add new…</option>
    </select>
  );
}
export const ASSIGNEE_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "assignee"));
export const MULTILINE_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "textarea"));
export const COMBO_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "combo"));
export const ETA_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "eta"));
export const DATE_COLS = new Set(ALL_FORM_COLS.filter((c) => fieldType(c) === "date" || fieldType(c) === "eta"));
export const STATUS_COLS = new Set<string>(Object.values(PIPELINES).flatMap((p) => p.stages.map((s) => colOf(s, "status"))));
export const ASSIGNEE_ROLE: Record<string, string> = { reviewer_email: "Reviewer", admin_email: "Admin" };
for (const p of Object.values(PIPELINES))
  for (const s of p.stages) {
    ASSIGNEE_ROLE[assigneeColOf(s)] = s.role;
    const rc = reviewerColOf(s);
    if (rc) ASSIGNEE_ROLE[rc] = "Reviewer";
  }
export const REVIEWER_COL_SET = new Set<string>(Object.values(PIPELINES).flatMap((p) => p.stages.map(reviewerColOf).filter(Boolean) as string[]));
interface SectionDef {
  id: string;
  label: string;
  cols: Column[];
}
export function sectionsForPipeline(stages: StageDef[]): { sections: SectionDef[]; assigneeSeq: string[] } {
  const briefAssignee = stages[0] ? assigneeColOf(stages[0]) : "";
  const assigneeSeq = [...new Set<string>([briefAssignee, ...stages.flatMap((s) => [...(assigneeColOf(s) !== briefAssignee ? [assigneeColOf(s)] : []), ...(reviewerColOf(s) ? [reviewerColOf(s)!] : [])])])];
  const sections = stages.map((s) => ({ id: s.id, label: isBrief(s) ? "Brief & assignments" : s.label, cols: (isBrief(s) ? [...briefFieldsOf(s), ...assigneeSeq] : [instructionColOf(s), workLinkColOf(s), etaColOf(s), ...extraColsOf(s)]).filter(Boolean) as Column[] }));
  return { sections, assigneeSeq };
}