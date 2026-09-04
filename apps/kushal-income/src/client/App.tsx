import { useCallback, useEffect, useState } from "react";
import { fetchMoney, logout, UnauthorizedError, type MoneyResponse } from "./api";
import { Login } from "./Login";
import { MoneyView } from "./MoneyView";

export function App() {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [meta, setMeta] = useState<MoneyResponse | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setMeta(await fetchMoney());
      setNeedsAuth(false);
    } catch (e) {
      if (e instanceof UnauthorizedError) setNeedsAuth(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  if (checking) return <div className="app"><div className="empty">Loading…</div></div>;
  if (needsAuth) return <Login onDone={() => void check()} />;

  // A snapshot, never live. Saying when it was taken is not decoration: a stale
  // figure and a current one look identical without it.
  const when = meta?.generated_at
    ? new Date(meta.generated_at).toLocaleString("en-IN",
        { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "never";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />Kushal Income</div>
        <div className="topbar-spacer" />
        <div className="stamp">
          {meta?.account ?? "—"}<br />updated {when}
        </div>
        <button className="btn-ghost"
          onClick={async () => { await logout(); setNeedsAuth(true); }}>
          Sign out
        </button>
      </header>
      <main><MoneyView /></main>
    </div>
  );
}
