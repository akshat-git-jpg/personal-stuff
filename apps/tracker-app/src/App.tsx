import { useState, useEffect, useCallback } from "react";
import { Board } from "./client/Board";
import { getBoard, getTeam, logout, displayName, UnauthorizedError, type BoardData, type TeamMember } from "./client/api";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "./client/ThemeToggle";

// Dev preview personas — linked by email. Kept in sync with the local seed
// (scripts/seed-local.ts), so clicking a persona lands on a populated board.
const DEV_PERSONAS: { label: string; email: string }[] = [
  { label: "Sean (Admin)", email: "seankerman25@gmail.com" },
  { label: "Sam (Script + Recordings)", email: "kushalbakliwal25@gmail.com" },
  { label: "Anusha (Recordings)", email: "khushibakliwal125@gmail.com" },
  { label: "John (Video Editor)", email: "akshatpatidar17@gmail.com" },
  { label: "Tara (Thumbnails)", email: "tara@dev.local" },
  { label: "Uma (Uploads)", email: "uma@dev.local" },
  { label: "Riya (Reviewer)", email: "riya@dev.local" },
];

type AppState =
  | { status: "loading" }
  | { status: "unauthenticated"; devMode: boolean }
  | { status: "error"; message: string }
  | { status: "ok"; data: BoardData };

async function fetchDevMode(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth-mode", { credentials: "same-origin" });
    if (!res.ok) return false;
    return ((await res.json()) as { dev?: boolean }).dev === true;
  } catch { return false; }
}

export default function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [viewAsEmail, setViewAsEmail] = useState<string>("");

  // `silent` refreshes (after an action) keep the current view on screen and just
  // swap in fresh data, so the Board component never unmounts and the user stays
  // on their tab. Only the initial load / view-as switch shows the loading screen.
  const load = useCallback(async (asUser?: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setState({ status: "loading" });
    try {
      const data = await getBoard(asUser);
      setState({ status: "ok", data });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setState({ status: "unauthenticated", devMode: await fetchDevMode() });
      } else {
        setState({ status: "error", message: (err as Error).message ?? "Unknown error" });
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Load team once (for the view-as picker + name resolution) when an admin session is confirmed.
  useEffect(() => {
    if (state.status === "ok" && state.data.roles.includes("Admin") && team.length === 0) {
      void getTeam().then(setTeam);
    }
  }, [state, team.length]);

  async function handleLogout() {
    try { await logout(); } catch { /* ignore */ }
    setState({ status: "unauthenticated", devMode: await fetchDevMode() });
  }

  function handleViewAsChange(email: string) {
    setViewAsEmail(email);
    void load(email || undefined);
  }

  if (state.status === "unauthenticated") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="space-y-1.5 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Tutorials Tracker</h1>
          <p className="text-muted-foreground">Sign in to view your board</p>
        </div>
        <Button variant="outline" size="lg" onClick={() => { window.location.href = "/auth/login"; }}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.86-1.6 2.44v2h2.6c1.52-1.4 2.4-3.46 2.4-5.88 0-.4-.04-.8-.1-1.16z" fill="#4285F4"/>
            <path d="M8.98 17c2.16 0 3.97-.71 5.3-1.94l-2.6-2c-.71.48-1.63.76-2.7.76-2.08 0-3.84-1.4-4.47-3.29H1.84v2.07C3.16 15.28 5.9 17 8.98 17z" fill="#34A853"/>
            <path d="M4.51 10.53A5.13 5.13 0 0 1 4.25 9c0-.53.09-1.04.26-1.53V5.4H1.84A8.06 8.06 0 0 0 1 9c0 1.3.31 2.53.84 3.6l2.67-2.07z" fill="#FBBC05"/>
            <path d="M8.98 3.58c1.17 0 2.22.4 3.04 1.2l2.27-2.27C12.94 1.19 11.13.5 8.98.5 5.9.5 3.16 2.22 1.84 4.78l2.67 2.07c.63-1.89 2.39-3.27 4.47-3.27z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </Button>
        {state.devMode && (
          <div className="w-full max-w-xl space-y-2 text-center">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Preview (dev only)</div>
            <div className="flex flex-wrap justify-center gap-2">
              {DEV_PERSONAS.map(({ label, email }) => (
                <Button key={email} variant="secondary" size="sm"
                  onClick={() => { window.location.href = `/dev-login?email=${encodeURIComponent(email)}`; }}>{label}</Button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (state.status === "loading") return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading board…</div>;
  if (state.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div>
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
        </div>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const { data } = state;
  const roles = data.roles ?? [];
  const isAdmin = roles.includes("Admin");
  const viewing = data.viewingAs;
  // Always show who you are at the top — the effective viewer (you, or the person
  // you're previewing).
  const myEmail = viewing?.email ?? data.viewerEmail ?? "";
  const myName = myEmail ? displayName(myEmail, data.names ?? {}) : "";
  const roleBadge = (viewing?.roles ?? roles).join(" · ");

  let previewBanner: string | null = null;
  if (viewing) {
    const memberName = team.find((m) => m.email === viewing.email)?.name ?? viewing.email;
    previewBanner = viewing.roles.length === 0
      ? (data.notice ?? `No role mapping found for ${viewing.email}.`)
      : `👁️ Viewing ${memberName}'s board exactly as they see it (read-only). Switch back to "Me" to make changes.`;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">T</div>
        <h1 className="text-base font-semibold tracking-tight">Tutorials Tracker</h1>
        <div className="flex-1" />
        {(isAdmin || viewing) && (
          <Select value={viewAsEmail || "__me__"} onValueChange={(v) => handleViewAsChange(v === "__me__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[230px] text-xs" aria-label="View as team member"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__me__">Me (full access)</SelectItem>
              {team.map((m) => <SelectItem key={m.email} value={m.email}>{m.name} — {(m.roles ?? [m.role]).join(", ")}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {myName && <span className="text-sm text-muted-foreground">{myName}</span>}
        {roleBadge && <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground/70 sm:inline">{roleBadge}</span>}
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={() => void handleLogout()}>Sign out</Button>
      </header>

      {previewBanner && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">{previewBanner}</div>}

      <Board
        roles={viewing?.roles ?? roles}
        stages={data.stages ?? []}
        pipelines={data.pipelines ?? []}
        columns={data.columns}
        rows={data.rows}
        names={data.names ?? {}}
        memberRoles={data.memberRoles ?? {}}
        readOnly={data.readOnly ?? false}
        reload={() => void load(viewAsEmail || undefined, { silent: true })}
      />
    </div>
  );
}
