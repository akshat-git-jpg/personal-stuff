/**
 * TeamPanel.tsx — admin-only "Team & access" tab.
 * Lists teammates from the Employes tab and lets an Admin add / edit roles / remove.
 * Writes go through /api/team(/delete); the Employes tab is the source of truth for
 * BOTH assignment (the picker) AND login access, so removing someone here revokes access.
 */

import { useEffect, useState } from "react";
import {
  getTeam,
  getRoleOptions,
  saveTeamMember,
  deleteTeamMember,
  type TeamMember,
} from "./api";
import { PROTECTED_ADMIN_EMAIL } from "../shared/policy";
import { AssignmentDefaults } from "./AssignmentDefaults";
import { Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

interface TeamPanelProps {
  /** Called after a successful add/edit/remove so the parent can refresh the board's names. */
  onChanged?: () => void;
  categoryOptions?: string[];
  subcategoryOptions?: string[];
}

interface Draft {
  name: string;
  email: string;
  roles: string[];
}

const EMPTY: Draft = { name: "", email: "", roles: [] };

export function TeamPanel({ onChanged, categoryOptions = [], subcategoryOptions = [] }: TeamPanelProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // null = nothing open; "__new__" = add form; otherwise the email being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [t, r] = await Promise.all([getTeam(), getRoleOptions()]);
      setMembers(t);
      setRoleOptions(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the team");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function startAdd() {
    setDraft(EMPTY);
    setEditing("__new__");
    setError(null);
  }
  function startEdit(m: TeamMember) {
    setDraft({ name: m.name, email: m.email, roles: m.roles ?? (m.role ? [m.role] : []) });
    setEditing(m.email);
    setError(null);
  }
  function cancel() {
    setEditing(null);
    setError(null);
  }
  function toggleRole(r: string) {
    setDraft(d => ({
      ...d,
      roles: d.roles.includes(r) ? d.roles.filter(x => x !== r) : [...d.roles, r],
    }));
  }

  async function save() {
    if (!draft.name.trim()) return setError("Name is required");
    if (!draft.email.includes("@")) return setError("A valid email is required");
    if (draft.roles.length === 0) return setError("Pick at least one role");
    setBusy(true);
    setError(null);
    try {
      await saveTeamMember({ name: draft.name.trim(), email: draft.email.trim(), roles: draft.roles });
      setEditing(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: TeamMember) {
    if (!confirm(`Remove ${m.name} (${m.email}) from the team? They'll lose access to the tracker.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTeamMember(m.email);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  function renderForm(isNew: boolean) {
    const isFounder = editing !== null && editing !== "__new__" && editing.toLowerCase() === PROTECTED_ADMIN_EMAIL;
    return (
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">Name</label>
          <input
            className={inputCls}
            value={draft.name}
            placeholder="Full name"
            disabled={isFounder}
            title={isFounder ? "The founding admin's name is fixed" : ""}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">Email</label>
          <input
            className={inputCls}
            value={draft.email}
            placeholder="name@email.com"
            disabled={!isNew}
            title={isNew ? "" : "Email is the identifier — remove and re-add to change it"}
            onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Roles</label>
          <div className="flex flex-wrap gap-1.5">
            {roleOptions.map(r => {
              // Admin is reserved for the founding admin — don't offer it to anyone else.
              if (r === "Admin" && !isFounder) return null;
              // The founding admin can't drop the Admin role (would lock everyone out);
              // every other role (incl. Reviewer) is a free, independent toggle.
              const lockedAdmin = isFounder && r === "Admin";
              const checked = draft.roles.includes(r) || lockedAdmin;
              return (
                <button key={r} type="button" disabled={lockedAdmin} onClick={() => toggleRole(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    checked ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    lockedAdmin && "cursor-not-allowed opacity-70",
                  )}>
                  {r}{lockedAdmin ? " (required)" : ""}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Team &amp; access</h2>
        <Button size="sm" onClick={startAdd} disabled={editing === "__new__"}>
          <Plus className="size-4" /> Add teammate
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Everyone listed here can sign in to the tracker; roles control what they see and can edit, and who
        shows up in the assignment dropdowns. This is the sheet&rsquo;s <code className="rounded bg-muted px-1 text-xs">Employes</code> tab.
      </p>

      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {editing === "__new__" && renderForm(true)}
          {members.map(m =>
            editing === m.email ? (
              <div key={m.email}>{renderForm(false)}</div>
            ) : (
              <div key={m.email} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-foreground">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(m.roles ?? (m.role ? [m.role] : [])).map(r => (
                    <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground/80">{r}</span>
                  ))}
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {m.email.toLowerCase() === PROTECTED_ADMIN_EMAIL ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="The founding admin's name and access are fixed — you can still adjust roles">
                        <Lock className="size-3" /> Founder
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(m)} disabled={busy}>Edit roles</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(m)} disabled={busy}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void remove(m)} disabled={busy}>Remove</Button>
                    </>
                  )}
                </div>
              </div>
            ),
          )}
          {members.length === 0 && editing !== "__new__" && (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">No teammates yet — add one to grant access.</div>
          )}
        </div>
      )}

      <div className="my-2 border-t border-border" />
      <AssignmentDefaults categoryOptions={categoryOptions} subcategoryOptions={subcategoryOptions} onChanged={onChanged} />
    </div>
  );
}
