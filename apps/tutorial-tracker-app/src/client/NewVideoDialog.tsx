import { useState, useEffect } from "react";
import { getPipeline, createFieldsOf } from "./stages";
import { createVideo } from "./api";
import type { PipelineSummary } from "./Board";
import { ComboSelect } from "./CardDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface NewVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: PipelineSummary[];
  defaultPipeline: string;
  categoryOptions: string[];
  subcategoryOptions: string[];
  onCreated: (pipelineId: string) => void;
}

export function NewVideoDialog({
  open,
  onOpenChange,
  pipelines,
  defaultPipeline,
  categoryOptions,
  subcategoryOptions,
  onCreated
}: NewVideoDialogProps) {
  const [nvPipeline, setNvPipeline] = useState<string>(defaultPipeline);
  
  // Sync when defaultPipeline changes
  useEffect(() => {
    if (open) setNvPipeline(defaultPipeline);
  }, [open, defaultPipeline]);

  const nvFields = createFieldsOf(getPipeline(nvPipeline));
  const blankNv = (fields = nvFields) => Object.fromEntries(fields.map((f) => [f.col, ""])) as Record<string, string>;
  
  const [nv, setNv] = useState<Record<string, string>>(() => blankNv());
  const [nvBusy, setNvBusy] = useState(false);
  const [nvError, setNvError] = useState<string | null>(null);

  // reset form when opened
  useEffect(() => {
    if (open) {
      setNv(blankNv(createFieldsOf(getPipeline(defaultPipeline))));
      setNvError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submitNewVideo() {
    const missing = nvFields.filter((f) => !(nv[f.col] ?? "").trim());
    if (missing.length) { setNvError(`${missing.map((f) => f.label).join(", ")} ${missing.length === 1 ? "is" : "are"} required.`); return; }
    setNvBusy(true); setNvError(null);
    try {
      const payload = { ...Object.fromEntries(nvFields.map((f) => [f.col, (nv[f.col] ?? "").trim()])), pipeline: nvPipeline };
      await createVideo(payload);
      onCreated(nvPipeline);
    } catch (err) { 
      setNvError(err instanceof Error ? err.message : String(err)); 
    } finally { 
      setNvBusy(false); 
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!nvBusy) onOpenChange(o); }}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={nvBusy}>Cancel</Button>
          <Button onClick={() => void submitNewVideo()} disabled={nvBusy}>{nvBusy ? "Creating…" : "Create video"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
