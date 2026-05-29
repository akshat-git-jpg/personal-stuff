import { useState, useEffect, useCallback } from "react";
import { Board } from "./client/Board";
import { getBoard, logout, UnauthorizedError, type BoardData } from "./client/api";

type AppState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ok"; data: BoardData };

export default function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await getBoard();
      setState({ status: "ok", data });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setState({ status: "unauthenticated" });
      } else {
        setState({ status: "error", message: (err as Error).message ?? "Unknown error" });
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
    setState({ status: "unauthenticated" });
  }

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
        <button className="btn btn-primary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  const { data } = state;

  return (
    <>
      <header className="app-header">
        <div className="app-header__title">YT Tracker</div>
        <span className="app-header__role">{data.role}</span>
        <button className="btn btn-secondary" onClick={() => void handleLogout()}>
          Sign out
        </button>
      </header>
      <Board
        role={data.role}
        columns={data.columns}
        rows={data.rows}
        reload={() => void load()}
      />
    </>
  );
}
