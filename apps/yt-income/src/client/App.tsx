import { useCallback, useEffect, useState } from "react";
import { fetchRevenue, logout, UnauthorizedError } from "./api";
import { Login } from "./Login";
import { RevenueView } from "./RevenueView";

/** Cost and Profit are planned, not built. They render disabled so the shape of
 *  the app is visible from day one rather than arriving as a surprise. */
type Tab = "revenue" | "cost" | "profit";

export function App() {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab] = useState<Tab>("revenue");

  const check = useCallback(async () => {
    setChecking(true);
    try {
      await fetchRevenue();
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

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          YT Income
        </div>
        <div className="topbar-spacer" />
        <button
          className="btn-ghost"
          onClick={async () => { await logout(); setNeedsAuth(true); }}
        >
          Sign out
        </button>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === "revenue" ? "tab-on" : ""}`}>Revenue</button>
        <button className="tab tab-soon" disabled title="Not built yet">Cost</button>
        <button className="tab tab-soon" disabled title="Not built yet">Profit</button>
      </nav>

      <main>
        <RevenueView />
      </main>
    </div>
  );
}
