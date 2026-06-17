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

interface TeamPanelProps {
  /** Called after a successful add/edit/remove so the parent can refresh the board's names. */
  onChanged?: () => void;
}

interface Draft {
  name: string;
  email: string;
  roles: string[];
}

const EMPTY: Draft = { name: "", email: "", roles: [] };

export function TeamPanel({ onChanged }: TeamPanelProps) {
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
      <div className="team-form">
        <div className="team-form__row">
          <label>Name</label>
          <input
            value={draft.name}
            placeholder="Full name"
            disabled={isFounder}
            title={isFounder ? "The founding admin's name is fixed" : ""}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div className="team-form__row">
          <label>Email</label>
          <input
            value={draft.email}
            placeholder="name@email.com"
            disabled={!isNew}
            title={isNew ? "" : "Email is the identifier — remove and re-add to change it"}
            onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
          />
        </div>
        <div className="team-form__row">
          <label>Roles</label>
          <div className="team-form__roles">
            {roleOptions.map(r => {
              // Admin is reserved for the founding admin — don't offer it to anyone else.
              if (r === "Admin" && !isFounder) return null;
              // The founding admin can't drop the Admin role (would lock everyone out);
              // every other role (incl. Reviewer) is a free, independent toggle.
              const lockedAdmin = isFounder && r === "Admin";
              const checked = draft.roles.includes(r) || lockedAdmin;
              return (
                <label key={r} className={`role-chip${checked ? " role-chip--on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={lockedAdmin}
                    onChange={() => toggleRole(r)}
                  />
                  {r}
                  {lockedAdmin ? " (required)" : ""}
                </label>
              );
            })}
          </div>
        </div>
        <div className="team-form__actions">
          <button className="btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add" : "Save"}
          </button>
          <button className="btn-ghost" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-panel">
      <div className="team-panel__head">
        <h2 className="team-panel__title">Team &amp; access</h2>
        <button className="btn-primary" onClick={startAdd} disabled={editing === "__new__"}>
          + Add teammate
        </button>
      </div>
      <p className="team-panel__hint">
        Everyone listed here can sign in to the tracker; roles control what they see and can edit, and who
        shows up in the assignment dropdowns. This is the sheet&rsquo;s <code>Employes</code> tab.
      </p>

      {error && <div className="field-error">{error}</div>}

      {loading ? (
        <div className="team-panel__empty">Loading…</div>
      ) : (
        <div className="team-list">
          {editing === "__new__" && renderForm(true)}
          {members.map(m =>
            editing === m.email ? (
              <div key={m.email}>{renderForm(false)}</div>
            ) : (
              <div key={m.email} className="team-row">
                <div className="team-row__main">
                  <span className="team-row__name">{m.name}</span>
                  <span className="team-row__email">{m.email}</span>
                </div>
                <div className="team-row__roles">
                  {(m.roles ?? (m.role ? [m.role] : [])).map(r => (
                    <span key={r} className="role-tag">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="team-row__actions">
                  {m.email.toLowerCase() === PROTECTED_ADMIN_EMAIL ? (
                    <>
                      <span className="team-row__locked" title="The founding admin's name and access are fixed — you can still adjust roles">
                        🔒 Founder
                      </span>
                      <button className="btn-ghost" onClick={() => startEdit(m)} disabled={busy}>
                        Edit roles
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-ghost" onClick={() => startEdit(m)} disabled={busy}>
                        Edit
                      </button>
                      <button className="btn-ghost btn-danger" onClick={() => void remove(m)} disabled={busy}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ),
          )}
          {members.length === 0 && editing !== "__new__" && (
            <div className="team-panel__empty">No teammates yet — add one to grant access.</div>
          )}
        </div>
      )}
    </div>
  );
}
