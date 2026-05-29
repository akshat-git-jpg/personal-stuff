import { useState, useEffect, useCallback } from "react";
import { Board } from "./client/Board";
import { getBoard, getTeam, logout, UnauthorizedError, type BoardData, type TeamMember } from "./client/api";

// Dev preview emails per role
const DEV_EMAILS: Record<string, string> = {
  "Admin":          "seankerman25@gmail.com",
  "Editor":         "akshatpatidar17@gmail.com",
  "Tutorial Maker": "kushalbakliwal25@gmail.com",
  "Reviewer":       "seankerman25@gmail.com",
};

export const FRIENDLY_ROLE: Record<string, string> = {
  "Editor":         "Video Editor",
  "Tutorial Maker": "Tutorial Maker",
  "Reviewer":       "Reviewer",
  "Admin":          "Admin",
};

type AppState =
  | { status: "loading" }
  | { status: "unauthenticated"; devMode: boolean }
  | { status: "error"; message: string }
  | { status: "ok"; data: BoardData };

async function fetchDevMode(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth-mode", { credentials: "same-origin" });
    if (!res.ok) return false;
    const json = await res.json() as { dev?: boolean };
    return json.dev === true;
  } catch {
    return false;
  }
}

export default function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [viewAsEmail, setViewAsEmail] = useState<string>("");

  const load = useCallback(async (asUser?: string) => {
    setState({ status: "loading" });
    try {
      const data = await getBoard(asUser);
      setState({ status: "ok", data });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        const devMode = await fetchDevMode();
        setState({ status: "unauthenticated", devMode });
      } else {
        setState({ status: "error", message: (err as Error).message ?? "Unknown error" });
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Load team list once admin board is confirmed
  useEffect(() => {
    if (state.status === "ok" && state.data.role === "Admin" && team.length === 0) {
      void getTeam().then(setTeam);
    }
  }, [state, team.length]);

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
    const devMode = await fetchDevMode();
    setState({ status: "unauthenticated", devMode });
  }

  async function handleViewAsChange(email: string) {
    setViewAsEmail(email);
    void load(email || undefined);
  }

  // ── Sign-in screen ──────────────────────────────────────────────────────
  if (state.status === "unauthenticated") {
    return (
      <div className="signin-screen">
        <div className="signin-screen__title">YT Tracker</div>
        <div className="signin-screen__sub">Sign in to view your kanban board</div>

        <button
          className="btn-google"
          onClick={() => { window.location.href = "/auth/login"; }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.86-1.6 2.44v2h2.6c1.52-1.4 2.4-3.46 2.4-5.88 0-.4-.04-.8-.1-1.16z" fill="#4285F4"/>
            <path d="M8.98 17c2.16 0 3.97-.71 5.3-1.94l-2.6-2c-.71.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.84v2.07C3.16 15.28 5.9 17 8.98 17z" fill="#34A853"/>
            <path d="M4.51 10.53A5.13 5.13 0 0 1 4.25 9c0-.53.09-1.04.26-1.53V5.4H1.84A8.06 8.06 0 0 0 1 9c0 1.3.31 2.53.84 3.6l2.67-2.07z" fill="#FBBC05"/>
            <path d="M8.98 3.58c1.17 0 2.22.4 3.04 1.2l2.27-2.27C12.94 1.19 11.13.5 8.98.5 5.9.5 3.16 2.22 1.84 4.78l2.67 2.07c.63-1.89 2.39-3.27 4.47-3.27z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        {state.devMode && (
          <div className="dev-preview">
            <div className="dev-preview__label">Preview (dev only)</div>
            <div className="dev-preview__buttons">
              {Object.entries(DEV_EMAILS).map(([role, email]) => (
                <button
                  key={role}
                  className="btn-dev"
                  onClick={() => {
                    window.location.href = `/dev-login?role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`;
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (state.status === "loading") {
    return <div className="app-loading">Loading board…</div>;
  }

  if (state.status === "error") {
    return (
      <div className="app-error">
        <strong>Something went wrong</strong><br />
        {state.message}
        <br /><br />
        <button
          style={{ marginTop: "8px", padding: "8px 18px", background: "var(--accent)", border: "none", borderRadius: "8px", color: "#1a0e03", fontWeight: 700, cursor: "pointer" }}
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    );
  }

  const { data } = state;

  // Build friendly preview banner
  let previewBanner: string | null = null;
  if (data.viewingAs) {
    if (data.viewingAs.role === null) {
      previewBanner = data.notice ?? `No role mapping found for ${data.viewingAs.email}.`;
    } else {
      const memberName = team.find(m => m.email === data.viewingAs!.email)?.name ?? data.viewingAs.email;
      const friendlyRole = FRIENDLY_ROLE[data.viewingAs.role] ?? data.viewingAs.role;
      previewBanner = `\u{1F441}️ Previewing ${memberName}'s board (${friendlyRole}) — read-only. Switch to “Full admin (me)” to edit.`;
    }
  }

  // Show View-as dropdown if the SESSION role is Admin (role === "Admin" when viewingAs is null,
  // or when viewingAs is set the returned role is the target's role — so check viewingAs existence
  // or session-level: if team was loaded, this is definitely an admin session).
  const showViewAs = data.role === "Admin" || data.viewingAs !== null;

  return (
    <>
      {/* Topbar */}
      <header className="topbar">
        <div className="logo">Y</div>
        <h1>YT Tracker</h1>
        <div className="spacer" />
        {/* "View as" dropdown — Admin session only */}
        {showViewAs && (
          <select
            className="view-as-select"
            value={viewAsEmail}
            onChange={e => void handleViewAsChange(e.target.value)}
            aria-label="View as team member"
          >
            <option value="">Full admin (me)</option>
            {team.map(m => (
              <option key={m.email} value={m.email}>
                {m.name} — {FRIENDLY_ROLE[m.role] ?? m.role}
              </option>
            ))}
          </select>
        )}
        <span className="who">{data.role}</span>
        <span className="role-badge">{data.role}</span>
        <button className="btn-ghost" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </header>

      {/* Preview banner */}
      {previewBanner && (
        <div className="preview-banner">{previewBanner}</div>
      )}

      <Board
        role={data.role}
        columns={data.columns}
        rows={data.rows}
        viewingAs={data.viewingAs ?? null}
        readOnly={data.readOnly ?? false}
        reload={() => void load(viewAsEmail || undefined)}
      />
    </>
  );
}
