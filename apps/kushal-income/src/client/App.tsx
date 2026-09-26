import { useCallback, useEffect, useState } from "react";
import { fetchLedger, logout, UnauthorizedError, type Ledger } from "./api";
import { Cards } from "./Cards";
import { mainSub, parseHash } from "./lib";
import { Login } from "./Login";
import { Overview } from "./Overview";
import { Review } from "./Review";
import { Transactions } from "./Transactions";

const TABS = [
  ["overview", "Overview"],
  ["transactions", "Transactions"],
  ["cards", "Credit cards"],
  ["review", "Needs you"],
] as const;

export function App() {
  const [needsAuth, setNeedsAuth] = useState(false);
  const [data, setData] = useState<Ledger | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hash, setHash] = useState(location.hash);

  const load = useCallback(async () => {
    try {
      const d = await fetchLedger();
      setData({ ...d, rows: d.rows.map((r) => ({ ...r, tags: mainSub(r.tags) })) });
      setNeedsAuth(false);
      setErr(null);
    } catch (e) {
      if (e instanceof UnauthorizedError) setNeedsAuth(true);
      else setErr(String(e));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const on = () => setHash(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, [load]);

  if (needsAuth) return <Login onDone={() => void load()} />;
  if (err) return <div className="app"><div className="empty">{err}</div></div>;
  if (!data) return <div className="app"><div className="empty">Loading…</div></div>;

  const { page, params } = parseHash(hash);
  const needs = data.rows.filter((r) => r.status === "needs" && r.kind !== "payment").length;
  // The data is a snapshot from the last sync. Saying when is not decoration.
  const when = data.generated_at
    ? new Date(data.generated_at).toLocaleString("en-IN",
        { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "never";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />Kushal Money</div>
        <nav className="tabs" aria-label="Pages">
          {TABS.map(([key, label]) => (
            <a key={key} href={`#/${key}`} className="tab" aria-current={page === key ? "page" : undefined}>
              {label}
              {key === "review" && needs > 0 && <span className="badge">{needs}</span>}
            </a>
          ))}
        </nav>
        <div className="stamp">Last sync {when}</div>
        <button className="btn-ghost" onClick={async () => { await logout(); setNeedsAuth(true); }}>
          Sign out
        </button>
      </header>
      {!data.rows.length ? (
        <div className="empty">
          Nothing synced yet. Run <code>python3 -m ledger.run</code> in <code>pipelines/personal-finance</code>.
        </div>
      ) : page === "transactions" ? <Transactions data={data} params={params} reload={load} />
        : page === "cards" ? <Cards data={data} />
        : page === "review" ? <Review data={data} reload={load} />
        : <Overview data={data} />}
    </div>
  );
}
