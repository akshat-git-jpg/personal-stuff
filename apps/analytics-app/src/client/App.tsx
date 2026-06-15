import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchVideos,
  logout,
  UnauthorizedError,
  type LinkStat,
  type VideoStat,
} from "./api";
import { Login } from "./Login";

export function App() {
  const [videos, setVideos] = useState<VideoStat[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideos();
      setVideos(data.videos);
      setGeneratedAt(data.generated_at);
      setNeedsAuth(false);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setNeedsAuth(true);
        setVideos(null);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!videos) return [];
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter(
      (v) =>
        v.video_title.toLowerCase().includes(q) ||
        v.links.some(
          (l) =>
            l.tool.toLowerCase().includes(q) ||
            l.target_url.toLowerCase().includes(q),
        ),
    );
  }, [videos, query]);

  const totals = useMemo(() => {
    const list = videos ?? [];
    return {
      videos: list.length,
      links: list.reduce((n, v) => n + v.links.length, 0),
      clicks30: list.reduce((n, v) => n + v.total_30d, 0),
      clicksAll: list.reduce((n, v) => n + v.total_all, 0),
    };
  }, [videos]);

  function toggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (needsAuth) {
    return <Login onDone={() => void load()} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          YT Analytics
        </div>
        <div className="topbar-actions">
          <span className="refreshed">
            {generatedAt
              ? `Updated ${new Date(generatedAt * 1000).toLocaleString()}`
              : ""}
          </span>
          <button className="btn-ghost" onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button
            className="btn-ghost"
            onClick={async () => {
              await logout();
              setNeedsAuth(true);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="summary">
        <Stat label="Videos" value={totals.videos} />
        <Stat label="Links" value={totals.links} />
        <Stat label="Clicks · 30d" value={totals.clicks30} accent />
        <Stat label="Clicks · all-time" value={totals.clicksAll} accent />
      </section>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search by video or software…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="banner-error">{error}</div>}

      <main className="list">
        {loading && !videos && <div className="empty">Loading…</div>}

        {!loading && videos && filtered.length === 0 && (
          <div className="empty">
            {videos.length === 0 ? (
              <>
                <p className="empty-title">No clicks yet</p>
                <p>
                  Once links are generated in the tracker and people start
                  clicking <code>go.agrolloo.com</code> links, videos will show
                  up here.
                </p>
              </>
            ) : (
              <p>No videos match “{query}”.</p>
            )}
          </div>
        )}

        {filtered.map((v) => (
          <VideoCard
            key={v.video_code}
            video={v}
            open={expanded.has(v.video_code)}
            onToggle={() => toggle(v.video_code)}
          />
        ))}
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="stat-value">{value.toLocaleString()}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function VideoCard({
  video,
  open,
  onToggle,
}: {
  video: VideoStat;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`card ${open ? "card-open" : ""}`}>
      <button className="card-head" onClick={onToggle}>
        <span className={`chevron ${open ? "chevron-open" : ""}`}>›</span>
        <span className="card-title">{video.video_title}</span>
        <span className="card-counts">
          <span className="pill">
            {video.total_30d.toLocaleString()} <em>30d</em>
          </span>
          <span className="pill pill-strong">
            {video.total_all.toLocaleString()} <em>all</em>
          </span>
          <span className="pill pill-quiet">
            {video.links.length} {video.links.length === 1 ? "link" : "links"}
          </span>
        </span>
      </button>

      {open && (
        <div className="card-body">
          {video.links.length === 0 ? (
            <div className="no-links">No links generated for this video.</div>
          ) : (
            <table className="links-table">
              <thead>
                <tr>
                  <th>Software</th>
                  <th>Links</th>
                  <th className="num">30d</th>
                  <th className="num">All-time</th>
                </tr>
              </thead>
              <tbody>
                {video.links.map((l) => (
                  <LinkRow key={l.slug} link={l} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </article>
  );
}

function LinkRow({ link }: { link: LinkStat }) {
  return (
    <tr>
      <td className="tool">{link.tool || "—"}</td>
      <td className="urls">
        <CopyLink label="short" url={link.short_url} />
        <CopyLink label="target" url={link.target_url} />
      </td>
      <td className="num">{link.clicks_30d.toLocaleString()}</td>
      <td className="num num-strong">{link.clicks_all.toLocaleString()}</td>
    </tr>
  );
}

function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="url-line">
      <span className="url-tag">{label}</span>
      <a href={url} target="_blank" rel="noreferrer" className="url-text" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        className="copy-btn"
        title="Copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* clipboard blocked — ignore */
          }
        }}
      >
        {copied ? "✓" : "⧉"}
      </button>
    </div>
  );
}
