/**
 * HandoverPanel.tsx — shown when a team change is refused because the person
 * still holds unfinished work. The admin picks a new person for every job, then
 * ONE button hands them all over and re-runs the refused change.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { updateCell, HoldsLiveWorkError, type Holding, type TeamMember } from "./api";
import type { Column } from "../shared/columns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const selectCls = "flex h-8 w-auto rounded-md border border-input bg-background px-2.5 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

export type HandoverAction =
  | { kind: "remove"; systemName: string }
  | { kind: "roles"; systemName: string; roles: string[] };

export interface HandoverResult { moved: number; to: string[] }

interface Props {
  personName: string;
  action: HandoverAction;
  jobs: Holding[];
  candidatesFor: (job: Holding) => TeamMember[];
  /** Re-runs the refused change once every job is handed over. */
  retry: () => Promise<void>;
  onDone: (result: HandoverResult) => void;
  onCancel: () => void;
  /** Opens the Add form with this role picked, for a group nobody can take. */
  onAddPerson?: (role: string) => void;
}

type RowState = "working" | "done" | "error";
const keyOf = (j: Holding) => `${j.row_id}:${j.col}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function HandoverPanel({ personName, action, jobs: initialJobs, candidatesFor, retry, onDone, onCancel, onAddPerson }: Props) {
  const [jobs, setJobs] = useState(initialJobs);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [phase, setPhase] = useState<"picking" | "moving" | "finishing">("picking");
  const [error, setError] = useState<string | null>(null);

  // Doer jobs group by role, reviewer jobs by "Reviewer"; each group can go to one person.
  const groups = useMemo(() => {
    const m = new Map<string, Holding[]>();
    for (const j of jobs) {
      const g = j.slot === "reviewer" ? "Reviewer" : j.role;
      m.set(g, [...(m.get(g) ?? []), j]);
    }
    return [...m.entries()];
  }, [jobs]);

  const open = jobs.filter((j) => rows[keyOf(j)] !== "done");
  const picked = open.filter((j) => picks[keyOf(j)]).length;
  const stuck = open.filter((j) => candidatesFor(j).length === 0);
  const working = phase !== "picking";
  const doneCount = jobs.length - open.length;
  const failed = open.filter((j) => rows[keyOf(j)] === "error").length;

  const nameOf = (email: string) =>
    jobs.flatMap(candidatesFor).find((c) => c.email === email)?.name ?? email;
  const commonTo = (list: Holding[]) =>
    list.map(candidatesFor).reduce<TeamMember[]>(
      (acc, cs, i) => (i === 0 ? cs : acc.filter((a) => cs.some((c) => c.email === a.email))), []);

  const pickAll = (list: Holding[], email: string) =>
    setPicks((p) => { const n = { ...p }; for (const j of list) n[keyOf(j)] = email; return n; });

  const title = action.kind === "remove"
    ? `Before you remove ${personName} from ${action.systemName}`
    : `Before you take ${action.roles.join(" and ")} away from ${personName}`;
  const verb = action.kind === "remove" ? `remove ${personName}` : "save the roles";
  const finishLabel = action.kind === "remove" ? `Removing ${personName}…` : "Saving the roles…";

  async function run() {
    setError(null);
    setPhase("moving");
    let firstError = "";
    for (const j of open) {
      const k = keyOf(j);
      setRows((r) => ({ ...r, [k]: "working" }));
      try {
        await updateCell(j.row_id, j.col as Column, picks[k]);
        setRows((r) => ({ ...r, [k]: "done" }));
      } catch (e) {
        firstError ||= e instanceof Error ? e.message : "";
        setRows((r) => ({ ...r, [k]: "error" }));
      }
    }
    if (firstError) {
      setPhase("picking");
      setError(`Some jobs did not move. They are marked below. ${firstError}`.trim());
      return;
    }
    setPhase("finishing");
    try {
      await retry();
      onDone({ moved: jobs.length, to: [...new Set(Object.values(picks))].map(nameOf) });
    } catch (e) {
      setPhase("picking");
      if (e instanceof HoldsLiveWorkError) {
        // New work reached them while we were handing over: add it to the list.
        const known = new Set(jobs.map(keyOf));
        const fresh = e.holdings.filter((h) => !known.has(keyOf(h)));
        setJobs((js) => [...js, ...fresh]);
        setError(`${personName} got ${plural(fresh.length, "new job")} while you were working. Pick someone for ${fresh.length === 1 ? "it" : "them"} too.`);
      } else {
        setError(e instanceof Error ? e.message : "That did not save. Try again.");
      }
    }
  }

  const buttonLabel = phase === "moving"
    ? `Handing over ${Math.min(doneCount + 1, jobs.length)} of ${jobs.length}…`
    : phase === "finishing" ? finishLabel
    : failed > 0 ? `Try the ${plural(failed, "job")} again`
    : `Hand over ${plural(open.length, "job")} and ${verb}`;

  return (
    <section data-testid="handover-panel" aria-labelledby="handover-title"
      className="mt-2 overflow-hidden rounded-[12px] border border-amber-500/40 bg-card shadow-sm">
      <div className="flex items-start gap-2.5 border-b border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden="true" />
        <div className="space-y-0.5">
          <h3 id="handover-title" className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {personName} still has {plural(jobs.length, "unfinished job")}. Pick who takes each one.
            Nothing changes until you press the button below.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {groups.map(([group, list]) => {
          const common = commonTo(list.filter((j) => rows[keyOf(j)] !== "done"));
          const nobody = list.every((j) => candidatesFor(j).length === 0);
          return (
            <div key={group} data-testid="handover-group" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-foreground">
                  {group} <span className="font-normal text-muted-foreground">· {plural(list.length, "job")}</span>
                </div>
                {nobody && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-destructive">Nobody else is a {group} in {list[0].pipelineName}.</span>
                    {onAddPerson && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={working}
                        onClick={() => onAddPerson(group)}>Add a {group}</Button>
                    )}
                  </div>
                )}
                {list.length > 1 && common.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Give all {list.length} to
                    <select data-testid="handover-group-pick" className={cn(selectCls, "min-w-40")} disabled={working}
                      value={list.every((j) => picks[keyOf(j)] === picks[keyOf(list[0])]) ? picks[keyOf(list[0])] ?? "" : ""}
                      onChange={(e) => pickAll(list, e.target.value)}>
                      <option value="">Choose someone…</option>
                      {common.map((c) => <option key={c.email} value={c.email}>{c.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-[8px] border border-border">
                {list.map((job) => {
                  const k = keyOf(job);
                  const state = rows[k];
                  const options = candidatesFor(job);
                  return (
                    <li key={k} data-testid="handover-job" data-state={state ?? "idle"}
                      className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5",
                        state === "done" && "bg-emerald-500/[0.05]", state === "error" && "bg-destructive/[0.05]")}>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 break-words text-sm font-medium text-foreground" title={job.title}>{job.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {job.stageLabel} · {job.status.toLowerCase()} · {job.pipelineName}
                          {job.slot === "reviewer" && " · as reviewer"}
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                        {state === "working" && <Loader2 className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-label="Handing over" />}
                        {state === "done" && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="size-3.5" aria-hidden="true" />{nameOf(picks[k])}</span>}
                        {state === "error" && <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><X className="size-3.5" aria-hidden="true" />Did not move</span>}
                        {state !== "done" && (options.length > 0 ? (
                          <select aria-label={`Who takes the ${job.stageLabel} job on ${job.title}`}
                            className={cn(selectCls, "min-w-0 flex-1 sm:min-w-40 sm:flex-none", !picks[k] && "text-muted-foreground")}
                            value={picks[k] ?? ""} disabled={working}
                            onChange={(e) => setPicks((p) => ({ ...p, [k]: e.target.value }))}>
                            <option value="">Choose someone…</option>
                            {options.map((c) => <option key={c.email} value={c.email}>{c.name}</option>)}
                          </select>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {nobody ? "No one to take it yet" : `Nobody else is a ${job.role} here`}
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3">
        <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
          {working ? `${doneCount} of ${jobs.length} handed over`
            : stuck.length > 0 ? `${plural(stuck.length, "job")} can't be handed over yet`
            : `${picked} of ${open.length} picked`}
        </span>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={working}>Cancel</Button>
          <Button size="sm" data-testid="handover-confirm" className="min-w-0 flex-1 whitespace-normal sm:flex-none" onClick={() => void run()}
            disabled={working || picked < open.length || stuck.length > 0 || open.length === 0}>
            {working && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {buttonLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
