import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchVideos,
  type UnmatchedVideo,
  logout,
  UnauthorizedError,
  type LinkStat,
  type VideoStat,
} from "./api";
import { Login } from "./Login";
import { UploadsView } from "./UploadsView";
import { RankingsView } from "./RankingsView";

type Tab = "clicks" | "uploads" | "rankings";
type SortKey = "clicks" | "recent" | "views";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "clicks", label: "Most clicks" },
  { key: "recent", label: "Newest first" },
  { key: "views", label: "Most views" },
];

function dateMs(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function App() {
  const [videos, setVideos] = useState<VideoStat[] | null>(null);
  // Videos whose links exist but have no YouTube mapping. Their clicks are real
  // and were invisible until 2026-08-28; they are listed separately, never dropped.
  const [unmatched, setUnmatched] = useState<UnmatchedVideo[]>([]);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("clicks");
  const [sort, setSort] = useState<SortKey>("clicks");

  // Unmapped videos split two ways: ones already losing clicks get a card, the
  // rest (drafts, test cards) get a single count line so the section stays
  // readable. 19 of the 27 unmapped rows on 2026-08-28 were test videos.
  const unmatchedWithClicks = unmatched.filter((u) => u.total_all > 0);
  const unmatchedNoClicks = unmatched.length - unmatchedWithClicks.length;
  const unmatchedClicks = unmatched.reduce((n, u) => n + u.total_all, 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVideos();
      setVideos(data.videos);
      setUnmatched(data.unmatched ?? []);
      setGeneratedAt(data.generated_at);
      setYtError(data.youtube_ok ? null : (data.youtube_error ?? "YouTube unavailable."));
      setNeedsAuth(false);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setNeedsAuth(true);
        setVideos(null);
        setUnmatched([]);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Search filters; this re-orders. "clicks" mirrors the server order.
  const shown = useMemo(() => {
    const list = [...filtered];
    if (sort === "recent") {
      list.sort((a, b) => dateMs(b.published_at) - dateMs(a.published_at));
    } else if (sort === "views") {
      list.sort(
        (a, b) => (b.views ?? 0) - (a.views ?? 0) || dateMs(b.published_at) - dateMs(a.published_at),
      );
    } else {
      list.sort(
        (a, b) => b.total_all - a.total_all || dateMs(b.published_at) - dateMs(a.published_at),
      );
    }
    return list;
  }, [filtered, sort]);

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
            <div className="sort-row">
              <span className="sort-label">Sort by</span>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  className={`chip ${sort === s.key ? "chip-on" : ""}`}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <main className="list">
            {loading && !videos && <div className="empty">Loading…</div>}

            {!loading && videos && shown.length === 0 && (
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

            {shown.map((v) => (
              <VideoCard key={v.yt_video_id} video={v} />
            ))}

            {unmatched.length > 0 && (
              <section className="unmatched">
                <div className="unmatched-head">
                  <h2 className="unmatched-title">
                    Not counted above &mdash; {unmatchedClicks.toLocaleString()} clicks
                  </h2>
                  <p className="unmatched-why">
                    {unmatchedWithClicks.length > 0 ? (
                      <>
                        {unmatchedWithClicks.length === 1 ? "This video has" : "These videos have"}{" "}
                        real links and real clicks, but no YouTube video is recorded against{" "}
                        {unmatchedWithClicks.length === 1 ? "it" : "them"} in the tracker, so
                        everything above excludes{" "}
                        {unmatchedWithClicks.length === 1 ? "it" : "them"}. Set the YouTube link on
                        the video in Tutorials Tracker to fold{" "}
                        {unmatchedWithClicks.length === 1 ? "it" : "them"} in.
                      </>
                    ) : (
                      <>
                        Nothing is being lost right now. These videos have links but no YouTube
                        video recorded against them, so any future clicks would not be counted
                        above.
                      </>
                    )}
                  </p>
                  {unmatchedNoClicks > 0 && (
                    <p className="unmatched-why">
                      Plus {unmatchedNoClicks} unmapped{" "}
                      {unmatchedNoClicks === 1 ? "video" : "videos"} with no clicks yet &mdash;
                      mostly drafts and test cards, not shown.
                    </p>
                  )}
                </div>
                {unmatchedWithClicks.map((u) => (
                  <article className="vcard vcard-unmatched" key={u.video_code}>
                    <div className="vcard-head">
                      <span className="vcard-title">
                        {u.video_title} <code className="vcard-code">{u.video_code}</code>
                      </span>
                      <div className="vcard-metrics">
                        <span className="metric">{u.total_30d.toLocaleString()} <em>30d</em></span>
                        <span className="metric metric-strong">
                          {u.total_all.toLocaleString()} <em>clicks</em>
                        </span>
                      </div>
                    </div>
                    <div className="vcard-links">
                      {u.links.map((l) => (
                        <LinkLine key={l.slug} link={l} />
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}
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
        // Two very different situations used to share one message, which is how
        // 54 hidden clicks read as a healthy zero for months. Say which it is.
        <div className="vcard-nolinks">
          {video.video_code
            ? "No links for this video."
            : "No tracker video is mapped to this upload, so any links it has are not counted here."}
        </div>
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

