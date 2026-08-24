/**
 * TeamPanel.tsx — admin-only "Team & access" tab, SYSTEM-SCOPED.
 *
 * Each video system (pipeline) has its own roster: the freelancers + reviewers who
 * work that channel. A person is added to a system with that system's roles; any
 * role can be granted in several systems (add the person from each system's tab
 * with the roles they hold there). A small cross-system summary shows the
 * founder/admin and anyone who spans more than one system.
 *
 * Writes go through /api/team — sending a person's FULL membership map — so adding
 * a role in one system never disturbs their roles in another. The team is the
 * source of truth for BOTH assignment (who shows in the dropdowns) AND login
 * access, scoped per system.
 */

import { useEffect, useState, useMemo } from "react";
import {
  getTeam, getRoleOptions, saveTeamMember, deleteTeamMember, updateCell,
  HoldsLiveWorkError, type Holding, type TeamMember, type PipelineSummary,
} from "./api";
import type { Column } from "../shared/columns";
import { AssignmentDefaults } from "./AssignmentDefaults";
import { AlertTriangle, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface TeamPanelProps {
  pipelines: PipelineSummary[];
  /** Called after a successful add/edit/remove so the parent can refresh the board's names. */
  onChanged?: () => void;
}

interface Draft { name: string; email: string; roles: string[]; }
const EMPTY: Draft = { name: "", email: "", roles: [] };

const rolesIn = (m: TeamMember, sys: string): string[] => m.memberships?.[sys] ?? [];
const systemCount = (m: TeamMember): number => Object.keys(m.memberships ?? {}).filter((k) => k !== "*").length;
const isAdminMember = (m: TeamMember): boolean => (m.memberships?.["*"] ?? []).includes("Admin");

export function TeamPanel({ pipelines, onChanged }: TeamPanelProps) {
  const systems = pipelines.length ? pipelines : [{ id: "standard", name: "Standard", stages: [] }];
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeSystem, setActiveSystem] = useState<string>(systems[0]?.id ?? "standard");
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // null = nothing open; "__new__" = add form; otherwise the email being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  // A removal the server refused because the person still stands on live work.
  // `retry` re-runs the exact change once every job has been handed over, so the
  // admin never has to remember what they were doing.
  const [handover, setHandover] = useState<
    { email: string; name: string; message: string; jobs: Holding[]; retry: () => Promise<void> } | null
  >(null);
  const [handingOver, setHandingOver] = useState<string | null>(null);

  /** Run a team change; if the server refuses it, open the handover panel. */
  async function attempt(m: { email: string; name: string }, change: () => Promise<void>) {
    setBusy(true); setError(null);
    try {
      await change();
      setHandover(null);
      await load(); onChanged?.();
    } catch (e) {
      if (e instanceof HoldsLiveWorkError) {
        setHandover({ email: m.email, name: m.name, message: e.message, jobs: e.holdings, retry: change });
      } else {
        setError(e instanceof Error ? e.message : "That didn't work");
      }
    } finally { setBusy(false); }
  }

  /** Who can take this job: holds the needed role in that job's own system. */
  function candidatesFor(job: Holding, exclude: string): TeamMember[] {
    const wanted = exclude.trim().toLowerCase();
    return members
      .filter((m) => m.email.trim().toLowerCase() !== wanted)
      .filter((m) => isAdminMember(m) || rolesIn(m, job.pipelineId).includes(job.role))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Hand one job over. When the last one goes, the refused change is retried. */
  async function handOver(job: Holding, toEmail: string) {
    if (!handover || !toEmail) return;
    const key = `${job.row_id}:${job.col}`;
    setHandingOver(key); setError(null);
    try {
      await updateCell(job.row_id, job.col as Column, toEmail);
      const left = handover.jobs.filter((j) => `${j.row_id}:${j.col}` !== key);
      if (left.length === 0) {
        await attempt({ email: handover.email, name: handover.name }, handover.retry);
      } else {
        setHandover({ ...handover, jobs: left });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't hand that over");
    } finally { setHandingOver(null); }
  }

  /** Hand every listed job to one person, then retry the refused change. */
  async function handOverAll(toEmail: string) {
    if (!handover || !toEmail) return;
    setHandingOver("__all__"); setError(null);
    try {
      for (const job of handover.jobs) {
        if (!candidatesFor(job, handover.email).some((c) => c.email === toEmail)) {
          setError(`That person can't take the ${job.stageLabel} job on "${job.title}" — hand that one over on its own.`);
          return;
        }
      }
      for (const job of handover.jobs) await updateCell(job.row_id, job.col as Column, toEmail);
      await attempt({ email: handover.email, name: handover.name }, handover.retry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't hand those over");
    } finally { setHandingOver(null); }
  }

  /** People who could take EVERY listed job — the one-click path. Not memoised:
   *  it depends on candidatesFor, which is rebuilt each render, so a memo would
   *  recompute anyway while pretending not to. It is a handful of array passes. */
  const takesEverything: TeamMember[] = !handover || handover.jobs.length === 0
    ? []
    : handover.jobs
        .map((j) => candidatesFor(j, handover.email))
        .reduce((acc, list) => acc.filter((m) => list.some((x) => x.email === m.email)));

  const systemName = (id: string) => systems.find((s) => s.id === id)?.name ?? id;

  async function load() {
    setLoading(true); setError(null);
    try {
      setMembers(await getTeam());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the team");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  // Valid roles for the active system (its doer roles + Reviewer).
  useEffect(() => { void getRoleOptions(activeSystem).then(setRoleOptions); }, [activeSystem]);

  function selectSystem(id: string) { setActiveSystem(id); setEditing(null); }

  // Everyone with at least one role in the active system.
  const roster = useMemo(
    () => members.filter((m) => rolesIn(m, activeSystem).length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members, activeSystem],
  );
  // People who span >1 system or are the founder/admin — the cross-system picture.
  const crossSystem = useMemo(
    () => members.filter((m) => isAdminMember(m) || systemCount(m) > 1)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [members],
  );

  function startAdd() { setDraft(EMPTY); setEditing("__new__"); setError(null); }
  function startEdit(m: TeamMember) {
    setDraft({ name: m.name, email: m.email, roles: rolesIn(m, activeSystem) });
    setEditing(m.email); setError(null);
  }
  function cancel() { setEditing(null); setError(null); }
  function toggleRole(r: string) {
    setDraft((d) => ({ ...d, roles: d.roles.includes(r) ? d.roles.filter((x) => x !== r) : [...d.roles, r] }));
  }

  async function save() {
    if (!draft.name.trim()) return setError("Name is required");
    if (!draft.email.includes("@")) return setError("A valid email is required");
    if (draft.roles.length === 0) return setError(`Pick at least one role in ${systemName(activeSystem)}`);
    const email = draft.email.trim().toLowerCase();
    // Merge: keep this person's roles in OTHER systems, set their roles here.
    const existing = members.find((m) => m.email === email);
    const next: Record<string, string[]> = { ...(existing?.memberships ?? {}) };
    next[activeSystem] = draft.roles;
    // Taking a role away here can strand work, so it goes through the same
    // refuse-and-hand-over path a removal does.
    await attempt({ email, name: draft.name.trim() }, async () => {
      await saveTeamMember({ name: draft.name.trim(), email: draft.email.trim(), memberships: next });
      setEditing(null);
    });
  }

  async function removeFromSystem(m: TeamMember) {
    const others = systemCount(m) - 1; // systems they'd still be in (excludes "*")
    const stillElsewhere = others > 0 || isAdminMember(m);
    const msg = stillElsewhere
      ? `Remove ${m.name} from ${systemName(activeSystem)}? They keep their access to their other system(s).`
      : `Remove ${m.name} (${m.email}) from the team entirely? They'll lose all access.`;
    if (!confirm(msg)) return;
    await attempt(m, async () => {
      const next: Record<string, string[]> = { ...(m.memberships ?? {}) };
      delete next[activeSystem];
      const realSystems = Object.keys(next).filter((k) => k !== "*");
      if (realSystems.length === 0 && !next["*"]) {
        await deleteTeamMember(m.email);                              // nothing left → full removal
      } else {
        await saveTeamMember({ name: m.name, email: m.email, memberships: next });
      }
    });
  }

  /** The refusal, made actionable: every stranded job with a way to hand it on.
   *  Rendered inline under the person, so the list and the person stay together. */
  function renderHandover() {
    if (!handover) return null;
    const many = handover.jobs.length !== 1;
    return (
      <div data-testid="handover-panel" className="mt-2 space-y-3 rounded-[10px] border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden="true" />
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-foreground">
              Can&rsquo;t remove {handover.name} yet &mdash; {handover.jobs.length} unfinished job{many ? "s" : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              Hand {many ? "each one" : "it"} to someone else first. Removing {handover.name} now would leave
              {many ? " these videos" : " this video"} with nobody able to move {many ? "them" : "it"}.
            </div>
          </div>
        </div>

        {takesEverything.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
            <span className="text-xs font-medium text-foreground/80">Hand all {handover.jobs.length} to</span>
            <select
              data-testid="handover-all"
              className={cn(inputCls, "h-8 w-auto min-w-52 text-xs")}
              defaultValue=""
              disabled={handingOver !== null || busy}
              onChange={(e) => { const v = e.target.value; e.target.value = ""; void handOverAll(v); }}
            >
              <option value="">Choose someone&hellip;</option>
              {takesEverything.map((c) => (
                <option key={c.email} value={c.email}>{c.name}</option>
              ))}
            </select>
            <span className="text-[11px] text-muted-foreground">or one at a time below</span>
          </div>
        )}

        <ul className="space-y-2">
          {handover.jobs.map((job) => {
            const key = `${job.row_id}:${job.col}`;
            const options = candidatesFor(job, handover.email);
            return (
              <li key={key} data-testid="handover-job"
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{job.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {job.stageLabel} &middot; {job.status.toLowerCase()} &middot; {job.pipelineName}
                    {job.slot === "reviewer" && " · as reviewer"}
                  </div>
                </div>
                {options.length > 0 ? (
                  <select
                    aria-label={`Hand the ${job.stageLabel} job on ${job.title} to someone else`}
                    className={cn(inputCls, "h-8 w-auto min-w-44 text-xs")}
                    defaultValue=""
                    disabled={handingOver !== null || busy}
                    onChange={(e) => { const v = e.target.value; e.target.value = ""; void handOver(job, v); }}
                  >
                    <option value="">{handingOver === key ? "Handing over…" : "Hand to…"}</option>
                    {options.map((c) => (
                      <option key={c.email} value={c.email}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] font-medium text-destructive">
                    Nobody else is a {job.role} in {job.pipelineName} &mdash; add one first.
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex justify-end">
          <Button size="sm" variant="ghost" disabled={handingOver !== null} onClick={() => setHandover(null)}>
            Leave them on the team
          </Button>
        </div>
      </div>
    );
  }

  function renderForm(isNew: boolean) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">Name</label>
          <input className={inputCls} value={draft.name} placeholder="Full name"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">Email</label>
          <input className={inputCls} value={draft.email} placeholder="name@email.com" disabled={!isNew}
            title={isNew ? "" : "Email is the identifier — remove and re-add to change it"}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Roles in {systemName(activeSystem)}</label>
          <div className="flex flex-wrap gap-1.5">
            {roleOptions.map((r) => {
              const checked = draft.roles.includes(r);
              return (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    checked ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}>{r}</button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Any role can be held in several systems — add the person from each system&rsquo;s tab.
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : isNew ? "Add" : "Save"}</Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Team &amp; access</h2>
        <Button size="sm" onClick={startAdd} disabled={editing === "__new__"}>
          <Plus className="size-4" /> Add to {systemName(activeSystem)}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Each system has its own people. Everyone here can sign in; their roles control what they see, can edit,
        and who they can be assigned as — scoped to the system they&rsquo;re in.
      </p>

      {/* System tabs */}
      {systems.length > 1 && (
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {systems.map((s) => (
            <button key={s.id} type="button" onClick={() => selectSystem(s.id)} aria-pressed={activeSystem === s.id}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                activeSystem === s.id ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}>{s.name}</button>
          ))}
        </div>
      )}

      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {editing === "__new__" && renderForm(true)}
          {roster.map((m) => {
            const isAdmin = isAdminMember(m);
            return editing === m.email ? (
              // The edit form stays open behind a refused save, so the handover
              // panel has to ride along with it too — not only the collapsed row.
              <div key={m.email}>{renderForm(false)}{handover?.email === m.email && renderHandover()}</div>
            ) : (
              <div key={m.email} data-testid={`team-row-${m.email}`} className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[16px] font-semibold leading-snug tracking-tight text-foreground">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.email}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" /> System Admin
                      </span>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(m)} disabled={busy}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeFromSystem(m)} disabled={busy}>Remove</Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {isAdmin ? (
                    "Has full access across all systems. This membership cannot be edited here."
                  ) : (
                    Object.entries(m.memberships ?? {})
                      .filter(([sys]) => sys !== "*")
                      .map(([sys, roles]) => `${systemName(sys)}: ${roles.join(", ")}`)
                      .join(" · ")
                  )}
                </div>
                {handover?.email === m.email && renderHandover()}
              </div>
            );
          })}
          {roster.length === 0 && editing !== "__new__" && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">No one in {systemName(activeSystem)} yet — add someone to grant access.</div>
          )}
        </div>
      )}

      {/* Cross-system: founder/admins + anyone spanning >1 system (managed per tab). */}
      {!loading && crossSystem.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviewers &amp; admins · all systems</h3>
          {crossSystem.map((m) => (
            <div key={m.email} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{m.name}</span>
              {isAdminMember(m) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Admin · all systems</span>}
              {Object.keys(m.memberships ?? {}).filter((k) => k !== "*").map((sys) => (
                <span key={sys} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/80">
                  {systemName(sys)}: {(m.memberships?.[sys] ?? []).join(", ")}
                </span>
              ))}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Manage these per system in the tabs above — e.g. add a reviewer to another system from that system&rsquo;s tab.</p>
        </div>
      )}

      <div className="my-2 border-t border-border" />
      <AssignmentDefaults system={activeSystem} onChanged={onChanged} />
    </div>
  );
}
