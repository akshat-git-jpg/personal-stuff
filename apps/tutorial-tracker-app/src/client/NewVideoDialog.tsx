import { useState, useEffect } from "react";
import { getPipeline, createFieldsOf } from "./stages";
import { createVideo, resolveDefaults, personLabel } from "./api";
import type { PipelineSummary } from "./Board";
import { ComboSelect } from "./CardDetail";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { holdsRoleInSystem } from "../shared/engine/memberships";
import { colOf, stageHasReviewerSlot, requiredToCreate, stageKind } from "../shared/engine/types";
import { cn } from "@/lib/utils";

export interface NewVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: PipelineSummary[];
  defaultPipeline: string;
  categoryOptions: string[];
  subcategoryOptions: string[];
  names: Record<string, string>;
  memberRoles: Record<string, string>;
  memberships: Record<string, Record<string, string[]>>;
  onCreated: (pipelineId: string) => void;
}

export function NewVideoDialog({
  open, onOpenChange, pipelines, defaultPipeline,
  categoryOptions, subcategoryOptions, names, memberRoles, memberships, onCreated
}: NewVideoDialogProps) {
  const [nvPipeline, setNvPipeline] = useState<string>(defaultPipeline);
  
  useEffect(() => {
    // eslint-disable-next-line
    if (open) setNvPipeline(defaultPipeline);
  }, [open, defaultPipeline]);

  const pDef = getPipeline(nvPipeline);
  const nvFields = createFieldsOf(pDef);
  
  // doer stages
  const doerStages = pDef.stages.filter((_, i) => i > 0 && stageKind(pDef.stages[i]) === "work");
  
  const [nv, setNv] = useState<Record<string, string>>({});
  const [nvBusy, setNvBusy] = useState(false);
  const [nvError, setNvError] = useState<string | null>(null);
  const [prefillNotice, setPrefillNotice] = useState<string>("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line
      setNv(Object.fromEntries(nvFields.map(f => [f.col, ""])) as Record<string, string>);
      setNvError(null);
      setPrefillNotice("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultPipeline]);

  // fetch defaults when category/subcategory changes
  const category = nv.category ?? "";
  const subcategory = nv.subcategory ?? "";
  
  useEffect(() => {
    if (!open || !category) return;
    let active = true;
    const fetchD = async () => {
      try {
        const defs = await resolveDefaults(nvPipeline, category, subcategory);
        if (!active) return;
        setNv(prev => {
          const next = { ...prev };
          let changed = false;
          for (const [col, email] of Object.entries(defs)) {
            if (!next[col] && email) {
              next[col] = email;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        setPrefillNotice(`pre-filled from your ${category} defaults`);
      } catch (e) { console.warn("Failed to fetch defaults:", e); }
    };
    fetchD();
    return () => { active = false; };
  }, [open, nvPipeline, category, subcategory]);

  const reqCols = requiredToCreate(pDef);
  const missingCols = reqCols.filter(c => !(nv[c] ?? "").trim());
  
  const fieldLabel = (col: string) => {
    const f = nvFields.find(x => x.col === col);
    if (f) return f.label;
    for (const s of pDef.stages) if (colOf(s, "assignee") === col) return s.role;
    return col;
  };
  
  const missingLabels = missingCols.map(fieldLabel);

  async function submitNewVideo() {
    if (missingCols.length) { 
      setNvError(`${missingLabels.join(", ")} ${missingCols.length === 1 ? "is" : "are"} required.`); 
      return; 
    }
    setNvBusy(true); setNvError(null);
    try {
      const payload = { ...nv, pipeline: nvPipeline };
      await createVideo(payload);
      onCreated(nvPipeline);
    } catch (err) { 
      setNvError(err instanceof Error ? err.message : String(err)); 
    } finally { 
      setNvBusy(false); 
    }
  }

  const set = (col: string, val: string) => setNv(prev => ({ ...prev, [col]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!nvBusy) onOpenChange(o); }}>
      {/* Header and footer sit OUTSIDE the scrolling middle, so the title and
          the Create button stay put however tall the people column grows. */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[800px]">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>New video &mdash; set up first</DialogTitle>
          <DialogDescription>A complete setup is required before a video reaches the board.</DialogDescription>
        </DialogHeader>

        <div data-testid="new-video-body" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        {pipelines.length > 1 && (
          <div className="mb-4 space-y-1.5 w-64">
            <label className="text-xs font-medium text-foreground/80">Pipeline <span className="text-primary">*</span></label>
            <Select value={nvPipeline} onValueChange={(p) => { setNvPipeline(p); setNv(Object.fromEntries(createFieldsOf(getPipeline(p)).map(f => [f.col, ""])) as Record<string, string>); setPrefillNotice(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* One column on a narrow window — two cramped columns on a small
            laptop is what made this dialog so tall in the first place. */}
        <div className="grid gap-8 py-2 sm:grid-cols-2">
          {/* Left: The video */}
          <div className="space-y-4">
            <h3 className="font-semibold">The video</h3>
            <div className="space-y-4">
              {nvFields.map((f, i) => {
                const isMissing = missingCols.includes(f.col);
                const inputCls = cn(
                  "flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
                  isMissing ? "border-primary/70 ring-2 ring-primary/20" : "border-input"
                );
                return (
                  <div className="space-y-1.5" key={f.col}>
                    <label htmlFor={`nv-${f.col}`} className="text-xs font-medium text-foreground/80">{f.label} <span className="text-primary">*</span></label>
                    {f.type === "textarea" ? (
                      <textarea id={`nv-${f.col}`} rows={4} value={nv[f.col] ?? ""} onChange={(e) => set(f.col, e.target.value)} className={inputCls} />
                    ) : f.type === "combo" ? (
                      <div className={isMissing ? "rounded-md border-primary/70 ring-2 ring-primary/20" : ""}>
                        <ComboSelect id={`nv-${f.col}`} value={nv[f.col] ?? ""}
                          options={f.options === "subcategory" ? subcategoryOptions : categoryOptions}
                          placeholder={`New ${f.label.toLowerCase()}…`} onChange={(v) => set(f.col, v)} />
                      </div>
                    ) : (
                      <input id={`nv-${f.col}`} type="text" value={nv[f.col] ?? ""} autoFocus={i === 0} onChange={(e) => set(f.col, e.target.value)} className={inputCls} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: The people */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center justify-between">
              The people
              {prefillNotice && <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">{prefillNotice}</span>}
            </h3>
            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
              {doerStages.map(stage => {
                const aCol = colOf(stage, "assignee");
                const rCol = colOf(stage, "reviewer");
                const hasReviewer = stageHasReviewerSlot(stage);
                
                const aMissing = missingCols.includes(aCol);
                const rMissing = missingCols.includes(rCol);
                
                const aPeople = Object.keys(names)
                  .filter(email => holdsRoleInSystem(memberships[email.toLowerCase()] ?? {}, pDef.id, stage.role))
                  .sort((a, b) => names[a].localeCompare(names[b]));
                
                const rPeople = hasReviewer ? Object.keys(names)
                  .filter(email => holdsRoleInSystem(memberships[email.toLowerCase()] ?? {}, pDef.id, "Reviewer"))
                  .sort((a, b) => names[a].localeCompare(names[b])) : [];

                return (
                  <div key={stage.id} className="space-y-3 pb-4 mb-4 border-b last:border-0 last:mb-0 last:pb-0 border-border/50">
                    <div className="space-y-1.5">
                      <label htmlFor={`nv-${aCol}`} className="text-xs font-medium text-foreground/80">{stage.role} (doer) <span className="text-primary">*</span></label>
                      <select id={`nv-${aCol}`} value={nv[aCol] ?? ""} onChange={e => set(aCol, e.target.value)}
                        className={cn("flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2", 
                          aMissing ? "border-primary/70 ring-2 ring-primary/20" : "border-input")}
                      >
                        <option value="">— Unassigned —</option>
                        {aPeople.map(e => <option key={e} value={e}>{personLabel(e, names, memberRoles)}</option>)}
                      </select>
                    </div>
                    {hasReviewer && (
                      <div className="space-y-1.5">
                        <label htmlFor={`nv-${rCol}`} className="text-xs font-medium text-foreground/80">{stage.label} Reviewer</label>
                        <select id={`nv-${rCol}`} value={nv[rCol] ?? ""} onChange={e => set(rCol, e.target.value)}
                          className={cn("flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2", 
                            rMissing ? "border-primary/70 ring-2 ring-primary/20" : "border-input")}
                        >
                          <option value="">— No review (auto-approve) —</option>
                          {rPeople.map(e => <option key={e} value={e}>{personLabel(e, names, memberRoles)}</option>)}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">Leaving the reviewer empty means that stage is approved the moment it is submitted.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        </div>

        <DialogFooter className="shrink-0 items-center gap-3 border-t border-border px-6 py-4 sm:justify-between">
          <div className="text-sm font-medium text-destructive">
            {missingCols.length > 0 ? (
              <span>{missingCols.length} {missingCols.length === 1 ? "thing" : "things"} left: {missingLabels.join(", ")}</span>
            ) : nvError ? (
              <span>{nvError}</span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={nvBusy}>Cancel</Button>
            <Button onClick={() => void submitNewVideo()} disabled={nvBusy || missingCols.length > 0}>{nvBusy ? "Creating…" : "Create video"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
