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
  getTeam, getRoleOptions, saveTeamMember, deleteTeamMember,
  HoldsLiveWorkError, type Holding, type TeamMember, type PipelineSummary,
} from "./api";
import { AssignmentDefaults } from "./AssignmentDefaults";
import { HandoverPanel, type HandoverAction } from "./HandoverPanel";
import { CheckCircle2, Loader2, Lock, Plus } from "lucide-react";
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

  // A change the server refused because the person still stands on live work.
  // `retry` re-runs the exact change once every job has been handed over.
  const [handover, setHandover] = useState<
    { email: string; name: string; action: HandoverAction; jobs: Holding[]; retry: () => Promise<void> } | null
  >(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function announce(msg: string) { setNotice(msg); setTimeout(() => setNotice((n) => (n === msg ? null : n)), 5000); }

  /** Run a team change; if the server refuses it, open the handover panel. */
  async function attempt(m: { email: string; name: string }, action: HandoverAction, change: () => Promise<void>, success: string) {
    setBusy(true); setError(null);
    try {
      await change();
      // Adding a helper mid-handover must not close that person's handover panel.
      setHandover((h) => (h && h.email !== m.email ? h : null));
      await load(); onChanged?.();
      announce(success);
    } catch (e) {
      if (e instanceof HoldsLiveWorkError) {
        setHandover({ email: m.email, name: m.name, action, jobs: e.holdings, retry: change });
      } else {
        setError(e instanceof Error ? e.message : "That didn't work");
      }
    } finally { setBusy(false); }
  }

  /** Who can take this job: holds the needed role in that job's own system (the server's rule; Admin alone is not enough). */
  function candidatesFor(job: Holding, exclude: string): TeamMember[] {
    const wanted = exclude.trim().toLowerCase();
    return members
      .filter((m) => m.email.trim().toLowerCase() !== wanted)
      .filter((m) => rolesIn(m, job.pipelineId).includes(job.role))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const systemName = (id: string) => systems.find((s) => s.id === id)?.name ?? id;
  // A person's systems, in tab order (storage returns them in the order they were added).
  const systemsOf = (m: TeamMember): string[] => Object.keys(m.memberships ?? {}).filter((k) => k !== "*")
    .sort((a, b) => {
      const ia = systems.findIndex((s) => s.id === a), ib = systems.findIndex((s) => s.id === b);
      return (ia < 0 ? Infinity : ia) - (ib < 0 ? Infinity : ib);
    });

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

  function startAdd(role?: string) {
    setDraft({ ...EMPTY, roles: role ? [role] : [] }); setEditing("__new__"); setError(null);
    requestAnimationFrame(() => document.getElementById("team-add-form")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  function startEdit(m: TeamMember) {
    setDraft({ name: m.name, email: m.email, roles: rolesIn(m, activeSystem) });
    setEditing(m.email); setError(null);
  }
  function cancel() { setEditing(null); setError(null); setHandover(null); }
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
    const dropped = (existing?.memberships?.[activeSystem] ?? []).filter((r) => !draft.roles.includes(r));
    const name = draft.name.trim();
    const sys = systemName(activeSystem);
    // Taking a role away here can strand work, so it goes through the same
    // refuse-and-hand-over path a removal does.
    await attempt({ email, name }, { kind: "roles", systemName: sys, roles: dropped }, async () => {
      await saveTeamMember({ name, email: draft.email.trim(), memberships: next });
      setEditing(null);
    }, existing ? `Saved ${name}'s roles in ${sys}.` : `Added ${name} to ${sys}.`);
  }

  /** What removing this person from the active system means, in one line. */
  function removeWarning(m: TeamMember) {
    const stillElsewhere = systemCount(m) - 1 > 0 || isAdminMember(m);
    return stillElsewhere
      ? `Remove ${m.name} from ${systemName(activeSystem)}? They keep their other systems.`
      : `Remove ${m.name} from the team? They lose all access.`;
  }

  async function removeFromSystem(m: TeamMember) {
    const sys = systemName(activeSystem);
    await attempt(m, { kind: "remove", systemName: sys }, async () => {
      const next: Record<string, string[]> = { ...(m.memberships ?? {}) };
      delete next[activeSystem];
      const realSystems = Object.keys(next).filter((k) => k !== "*");
      if (realSystems.length === 0 && !next["*"]) {
        await deleteTeamMember(m.email);                              // nothing left → full removal
      } else {
        await saveTeamMember({ name: m.name, email: m.email, memberships: next });
      }
    }, `Removed ${m.name} from ${sys}.`);
    setConfirmRemove(null);
  }

  /** The refusal, made actionable. Rendered inline under the person. */
  function renderHandover() {
    if (!handover) return null;
    const h = handover;
    return (
      <HandoverPanel
        key={h.email + h.action.kind}
        personName={h.name}
        action={h.action}
        jobs={h.jobs}
        candidatesFor={(job) => candidatesFor(job, h.email)}
        retry={h.retry}
        onCancel={() => setHandover(null)}
        onAddPerson={(role) => startAdd(role)}
        onDone={({ moved, to }) => {
          setHandover(null); setEditing(null);
          void load(); onChanged?.();
          const done = h.action.kind === "remove" ? `${h.name} is removed from ${h.action.systemName}` : `${h.name}'s roles are saved`;
          announce(`Handed ${moved} ${moved === 1 ? "job" : "jobs"} to ${to.join(" and ")}. ${done}.`);
        }}
      />
    );
  }

  function renderForm(isNew: boolean) {
    return (
      <div id={isNew ? "team-add-form" : undefined} className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
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
          <Button size="sm" onClick={() => void save()} disabled={busy || (!!handover && !isNew)}>
            {busy && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {busy ? "Saving…" : isNew ? "Add" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Team &amp; access</h2>
        <Button size="sm" onClick={() => startAdd()} disabled={editing === "__new__"}>
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
                        <Button size="sm" variant="secondary" onClick={() => startEdit(m)} disabled={busy || !!handover}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmRemove(m.email)} disabled={busy || !!handover || confirmRemove === m.email}>Remove</Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {isAdmin ? (
                    "Has full access across all systems. This membership cannot be edited here."
                  ) : (
                    systemsOf(m)
                      .map((sys) => `${systemName(sys)}: ${rolesIn(m, sys).join(", ")}`)
                      .join(" · ")
                  )}
                </div>
                {confirmRemove === m.email && !handover && (
                  <div data-testid="remove-confirm" className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-destructive/30 bg-destructive/[0.04] px-3 py-2">
                    <span className="text-sm text-foreground">{removeWarning(m)}</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setConfirmRemove(null)} disabled={busy}>Cancel</Button>
                      <Button size="sm" variant="destructive" onClick={() => void removeFromSystem(m)} disabled={busy}>
                        {busy && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                        {busy ? "Checking…" : "Remove"}
                      </Button>
                    </div>
                  </div>
                )}
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
              {systemsOf(m).map((sys) => (
                <span key={sys} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/80">
                  {systemName(sys)}: {(m.memberships?.[sys] ?? []).join(", ")}
                </span>
              ))}
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">Manage these per system in the tabs above — e.g. add a reviewer to another system from that system&rsquo;s tab.</p>
        </div>
      )}

      {notice && (
        <div role="status" data-testid="team-notice"
          className="fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg duration-200 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
          {notice}
        </div>
      )}

      <div className="my-2 border-t border-border" />
      <AssignmentDefaults system={activeSystem} onChanged={onChanged} />
    </div>
  );
}
