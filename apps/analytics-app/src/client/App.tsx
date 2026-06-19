import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchVideos,
  logout,
  UnauthorizedError,
  type LinkStat,
  type VideoStat,
} from "./api";
import { Login } from "./Login";
import { UploadsView } from "./UploadsView";
import { RankingsView } from "./RankingsView";

type Tab = "clicks" | "uploads" | "rankings";

export function App() {
  const [videos, setVideos] = useState<VideoStat[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("clicks");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideos();
      setVideos(data.videos);
      setGeneratedAt(data.generated_at);
      setYtError(data.youtube_ok ? null : (data.youtube_error ?? "YouTube unavailable."));
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
      views: list.reduce((n, v) => n + (v.views ?? 0), 0),
      clicks30: list.reduce((n, v) => n + v.total_30d, 0),
      clicksAll: list.reduce((n, v) => n + v.total_all, 0),
    };
  }, [videos]);

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

      <nav className="tabs">
        <button
          className={`tab ${tab === "clicks" ? "tab-on" : ""}`}
          onClick={() => setTab("clicks")}
        >
          Clicks
        </button>
        <button
          className={`tab ${tab === "uploads" ? "tab-on" : ""}`}
          onClick={() => setTab("uploads")}
        >
          Uploads
        </button>
        <button
          className={`tab ${tab === "rankings" ? "tab-on" : ""}`}
          onClick={() => setTab("rankings")}
        >
          Rankings
        </button>
      </nav>

      {error && <div className="banner-error">{error}</div>}
      {!error && ytError && (
        <div className="banner-error">
          Couldn&apos;t load videos from YouTube — {ytError} The video list comes from your
          channel&apos;s uploads, so nothing is shown until YouTube responds.
        </div>
      )}

      {tab === "clicks" ? (
        <>
          <section className="summary">
            <Stat label="Videos" value={totals.videos} />
            <Stat label="Views" value={totals.views} />
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

          <main className="list">
            {loading && !videos && <div className="empty">Loading…</div>}

            {!loading && videos && filtered.length === 0 && (
              <div className="empty">
                {videos.length === 0 ? (
                  <>
                    <p className="empty-title">No videos</p>
                    <p>
                      {ytError
                        ? "The video list couldn't be loaded from YouTube — see the message above."
                        : "No public long-form uploads were found on the channel."}
                    </p>
                  </>
                ) : (
                  <p>No videos match “{query}”.</p>
                )}
              </div>
            )}

            {filtered.map((v) => (
              <VideoCard key={v.yt_video_id} video={v} />
            ))}
          </main>
        </>
      ) : tab === "uploads" ? (
        <main className="list">
          {loading && !videos ? (
            <div className="empty">Loading…</div>
          ) : (
            <UploadsView videos={videos ?? []} />
          )}
        </main>
      ) : (
        <main className="list">
          {loading && !videos ? (
            <div className="empty">Loading…</div>
          ) : (
            <RankingsView videos={videos ?? []} onAuthLost={() => setNeedsAuth(true)} />
          )}
        </main>
      )}
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

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

// Dense, always-expanded card: title + live views + totals, with every link
// rendered inline as its own row — no click-to-expand.
function VideoCard({ video }: { video: VideoStat }) {
  const watchUrl = video.yt_video_id
    ? `https://www.youtube.com/watch?v=${video.yt_video_id}`
    : null;
  return (
    <article className="vcard">
      <div className="vcard-head">
        {watchUrl ? (
          <a className="vcard-title" href={watchUrl} target="_blank" rel="noreferrer">
            {video.video_title}
          </a>
        ) : (
          <span className="vcard-title">{video.video_title}</span>
        )}
        <div className="vcard-metrics">
          <span className="metric metric-views" title="YouTube views">
            {video.views == null ? "—" : compact(video.views)} <em>views</em>
          </span>
          <span className="metric">
            {video.total_30d.toLocaleString()} <em>30d</em>
          </span>
          <span className="metric metric-strong">
            {video.total_all.toLocaleString()} <em>clicks</em>
          </span>
        </div>
      </div>

      {video.links.length === 0 ? (
        <div className="vcard-nolinks">No links for this video.</div>
      ) : (
        <div className="vcard-links">
          {video.links.map((l) => (
            <LinkLine key={l.slug} link={l} />
          ))}
        </div>
      )}
    </article>
  );
}

function LinkLine({ link }: { link: LinkStat }) {
  return (
    <div className="lline">
      <span className="lline-tool">{link.tool || "—"}</span>
      <span className="lline-url">
        <a href={link.short_url} target="_blank" rel="noreferrer" title={link.target_url}>
          {link.short_url.replace(/^https?:\/\//, "")}
        </a>
        <CopyButton url={link.short_url} />
      </span>
      <span className="lline-num">
        {link.clicks_30d.toLocaleString()} <em>30d</em>
      </span>
      <span className="lline-num lline-num-strong">
        {link.clicks_all.toLocaleString()} <em>all</em>
      </span>
    </div>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      title="Copy short link"
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
  );
}

