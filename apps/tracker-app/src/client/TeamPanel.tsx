/**
 * TeamPanel.tsx — admin-only "Team & access" tab, SYSTEM-SCOPED.
 *
 * Each video system (pipeline) has its own roster: the freelancers + reviewers who
 * work that channel. A person is added to a system with that system's roles; doer
 * roles belong to one system, the Reviewer role can be granted in several (add the
 * person as Reviewer in each system tab they review). A small cross-system summary
 * shows the founder/admin and anyone who spans more than one system.
 *
 * Writes go through /api/team — sending a person's FULL membership map — so adding
 * a role in one system never disturbs their roles in another. The team is the
 * source of truth for BOTH assignment (who shows in the dropdowns) AND login
 * access, scoped per system.
 */

import { useEffect, useState, useMemo } from "react";
import {
  getTeam, getRoleOptions, saveTeamMember, deleteTeamMember, type TeamMember, type PipelineSummary,
} from "./api";
import { PROTECTED_ADMIN_EMAIL } from "../shared/engine/registry";
import { AssignmentDefaults } from "./AssignmentDefaults";
import { Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface TeamPanelProps {
  pipelines: PipelineSummary[];
  /** Called after a successful add/edit/remove so the parent can refresh the board's names. */
  onChanged?: () => void;
  categoryOptions?: string[];
  subcategoryOptions?: string[];
}

interface Draft { name: string; email: string; roles: string[]; }
const EMPTY: Draft = { name: "", email: "", roles: [] };

const rolesIn = (m: TeamMember, sys: string): string[] => m.memberships?.[sys] ?? [];
const systemCount = (m: TeamMember): number => Object.keys(m.memberships ?? {}).filter((k) => k !== "*").length;
const isAdminMember = (m: TeamMember): boolean => (m.memberships?.["*"] ?? []).includes("Admin");

export function TeamPanel({ pipelines, onChanged, categoryOptions = [], subcategoryOptions = [] }: TeamPanelProps) {
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
    setBusy(true); setError(null);
    try {
      const email = draft.email.trim().toLowerCase();
      // Merge: keep this person's roles in OTHER systems, set their roles here.
      const existing = members.find((m) => m.email === email);
      const next: Record<string, string[]> = { ...(existing?.memberships ?? {}) };
      next[activeSystem] = draft.roles;
      await saveTeamMember({ name: draft.name.trim(), email: draft.email.trim(), memberships: next });
      setEditing(null); await load(); onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  }

  async function removeFromSystem(m: TeamMember) {
    const others = systemCount(m) - 1; // systems they'd still be in (excludes "*")
    const stillElsewhere = others > 0 || isAdminMember(m);
    const msg = stillElsewhere
      ? `Remove ${m.name} from ${systemName(activeSystem)}? They keep their access to their other system(s).`
      : `Remove ${m.name} (${m.email}) from the team entirely? They'll lose all access.`;
    if (!confirm(msg)) return;
    setBusy(true); setError(null);
    try {
      const next: Record<string, string[]> = { ...(m.memberships ?? {}) };
      delete next[activeSystem];
      const realSystems = Object.keys(next).filter((k) => k !== "*");
      if (realSystems.length === 0 && !next["*"]) {
        await deleteTeamMember(m.email);                              // nothing left → full removal
      } else {
        await saveTeamMember({ name: m.name, email: m.email, memberships: next });
      }
      await load(); onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally { setBusy(false); }
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
            Doer roles belong to one system. To let a reviewer cover several systems, add them as <strong className="font-medium text-foreground">Reviewer</strong> in each system&rsquo;s tab.
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
          {roster.map((m) =>
            editing === m.email ? (
              <div key={m.email}>{renderForm(false)}</div>
            ) : (
              <div key={m.email} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rolesIn(m, activeSystem).map((r) => (
                    <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/80">{r}</span>
                  ))}
                  {systemCount(m) > 1 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary" title="Also in other systems">multi-system</span>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {m.email.toLowerCase() === PROTECTED_ADMIN_EMAIL && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="The founding admin's access is fixed">
                      <Lock className="size-3" /> Founder
                    </span>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(m)} disabled={busy}>Edit</Button>
                  {m.email.toLowerCase() !== PROTECTED_ADMIN_EMAIL && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeFromSystem(m)} disabled={busy}>Remove</Button>
                  )}
                </div>
              </div>
            ),
          )}
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
      <AssignmentDefaults system={activeSystem} categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions} onChanged={onChanged} />
    </div>
  );
}
