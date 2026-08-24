/**
 * AssignmentDefaults.tsx — who a new video's roles go to, per SYSTEM.
 *
 * This used to be a list of sets keyed by (category, subcategory), with a
 * precedence rule between them. Categories are gone, so a system now has exactly
 * ONE set: pick a person for each role and that is what new videos in that
 * system start with. No sets to add, no precedence to reason about.
 *
 * Each pick saves immediately — there is no Save button to forget.
 * Lives in the Team tab, following that tab's selected system.
 */
import { useCallback, useEffect, useState } from "react";
import { PIPELINES, reviewerColOf, assigneeColOf } from "./stages";
import { holdsRoleInSystem } from "../shared/engine/memberships";
import {
  getDefaults, getDefaultCols, saveDefaults, deleteDefault, getTeam, personLabel,
  type TeamMember,
} from "./api";
import { fieldLabel } from "./labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const selectCls = "flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** The role a person must hold to fill this column. */
function colRole(col: string): string {
  for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
    if (reviewerColOf(s) === col) return "Reviewer";
    if (assigneeColOf(s) === col) return s.role;
  }
  return "";
}

const PIPELINE_LIST = Object.values(PIPELINES).map((p) => ({ id: p.id, name: p.name }));

interface Props {
  /** Controlled system (from the Team tab's active system); omit to show an own selector. */
  system?: string;
  /** Called after a save so the parent can refresh anything derived. */
  onChanged?: () => void;
}

export function AssignmentDefaults({ system, onChanged }: Props) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [cols, setCols] = useState<string[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCol, setSavingCol] = useState<string | null>(null);
  const [savedCol, setSavedCol] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownPipelineId, setOwnPipelineId] = useState<string>(PIPELINE_LIST[0]?.id ?? "standard");
  const pipelineId = system ?? ownPipelineId;
  const pipelineName = PIPELINE_LIST.find((p) => p.id === pipelineId)?.name ?? pipelineId;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rows, c, t] = await Promise.all([getDefaults(pipelineId), getDefaultCols(pipelineId), getTeam()]);
      const next: Record<string, string> = {};
      for (const r of rows) next[r.col] = r.email;
      setAssignments(next); setCols(c); setTeam(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the defaults");
    } finally { setLoading(false); }
  }, [pipelineId]);
  useEffect(() => { void load(); }, [load]);

  const names: Record<string, string> = {};
  const memberRoles: Record<string, string> = {};
  for (const m of team) {
    names[m.email.toLowerCase()] = m.name;
    memberRoles[m.email.toLowerCase()] = (m.roles ?? [m.role]).join(", ");
  }
  /** Only people who hold that role IN this system. */
  const peopleFor = (role: string) =>
    team.filter((m) => holdsRoleInSystem(m.memberships ?? {}, pipelineId, role)).map((m) => m.email);

  /** One pick saves the whole set — the server replaces it wholesale. */
  async function pick(col: string, email: string) {
    const next = { ...assignments, [col]: email };
    if (!email) delete next[col];
    setAssignments(next);
    setSavingCol(col); setError(null);
    try {
      await saveDefaults({ pipeline: pipelineId, assignments: next });
      setSavedCol(col);
      setTimeout(() => setSavedCol((c) => (c === col ? null : c)), 1500);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
      void load();   // put the UI back to what the server actually holds
    } finally { setSavingCol(null); }
  }

  async function clearAll() {
    if (!confirm(`Clear every default for ${pipelineName}? New videos will start with nobody assigned.`)) return;
    setError(null);
    try {
      await deleteDefault(pipelineId);
      setAssignments({});
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear those");
    }
  }

  const filled = cols.filter((c) => (assignments[c] ?? "").trim()).length;

  return (
    <section className="space-y-3" data-testid="assignment-defaults">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Assignment defaults</h2>
        {!system && (
          <select className={cn(selectCls, "h-8 w-auto text-xs")} value={ownPipelineId}
            onChange={(e) => setOwnPipelineId(e.target.value)}>
            {PIPELINE_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        A new video in <strong className="font-medium text-foreground">{pipelineName}</strong> starts with these
        people. Leave a role blank and it starts unassigned. Only blank fields are filled &mdash; a manual
        pick on the card is never overwritten.
      </p>

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">Loading&hellip;</div>
      ) : cols.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          {pipelineName} has no assignable roles.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-[10px] border border-border bg-card">
          {cols.map((col) => {
            const role = colRole(col);
            const options = peopleFor(role);
            return (
              <div key={col} data-testid={`default-row-${col}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{fieldLabel(col)}</div>
                  <div className="text-[11px] text-muted-foreground">{role}</div>
                </div>
                <div className="flex items-center gap-2">
                  {savingCol === col && <span className="text-[11px] text-muted-foreground">Saving&hellip;</span>}
                  {savedCol === col && <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Saved</span>}
                  <select
                    aria-label={`Default ${fieldLabel(col)}`}
                    className={selectCls}
                    value={assignments[col] ?? ""}
                    disabled={savingCol !== null}
                    onChange={(e) => void pick(col, e.target.value)}
                  >
                    <option value="">&mdash; nobody &mdash;</option>
                    {options.map((email) => (
                      <option key={email} value={email}>{personLabel(email, names, memberRoles)}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      {!loading && filled > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void clearAll()}>
            Clear all {pipelineName} defaults
          </Button>
        </div>
      )}
    </section>
  );
}
