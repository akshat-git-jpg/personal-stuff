// Rankings tab: every video shown, with inline keyword management and a manual
// per-video "Check" that runs YouTube search ranking for each keyword. Each
// keyword has a line chart of rank over time (inverted axis — up = better).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addKeyword,
  checkVideoRankings,
  deleteKeyword,
  fetchRankings,
  UnauthorizedError,
  type KeywordsByVideo,
  type KeywordStat,
  type QuotaInfo,
  type RankCheck,
  type VideoStat,
} from "./api";

const SEARCH_DEPTH = 50; // mirrors the worker; ">50" / off-chart bottom

export function RankingsView({
  videos,
  onAuthLost,
}: {
  videos: VideoStat[];
  onAuthLost: () => void;
}) {
  const [byVideo, setByVideo] = useState<KeywordsByVideo>({});
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchRankings();
      setByVideo(r.byVideo);
      setQuota(r.quota);
    } catch (e) {
      if (e instanceof UnauthorizedError) onAuthLost();
      else setError(e instanceof Error ? e.message : "Failed to load rankings");
    } finally {
      setLoading(false);
    }
  }, [onAuthLost]);

  useEffect(() => {
    void load();
  }, [load]);

  // All videos, newest upload first.
  const ordered = useMemo(() => {
    const ms = (v: VideoStat) => (v.published_at ? Date.parse(v.published_at) || 0 : 0);
    return [...videos].sort((a, b) => ms(b) - ms(a));
  }, [videos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (v) =>
        v.video_title.toLowerCase().includes(q) ||
        (byVideo[v.yt_video_id] ?? []).some((k) => k.keyword.toLowerCase().includes(q)),
    );
  }, [ordered, byVideo, query]);

  const trackedCount = Object.values(byVideo).reduce((n, ks) => n + ks.length, 0);

  return (
    <div className="rk">
      {error && <div className="banner-error">{error}</div>}

      <div className="rk-head">
        <input
          className="search"
          placeholder="Search videos or keywords…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span
          className="rk-sub"
          title="Counts rank checks run here since midnight Pacific (when YouTube resets the daily quota). Other YouTube API usage on the same key isn't included, so the real figure may be slightly lower."
        >
          {quota ? (
            <>
              <strong className="rk-quota-left">{quota.remaining.toLocaleString()}</strong> of{" "}
              {quota.daily_limit.toLocaleString()} daily quota units left —{" "}
              <strong>{quota.checks_remaining.toLocaleString()}</strong> more keyword check
              {quota.checks_remaining === 1 ? "" : "s"} today (resets midnight PT)
            </>
          ) : (
            "Loading quota…"
          )}
          {" · "}
          {trackedCount} keyword{trackedCount === 1 ? "" : "s"} tracked
        </span>
      </div>

      {loading && Object.keys(byVideo).length === 0 ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className="rk-list">
          {filtered.map((v) => (
            <RankingVideoCard
              key={v.yt_video_id}
              video={v}
              keywords={byVideo[v.yt_video_id] ?? []}
              onChanged={load}
              onAuthLost={onAuthLost}
            />
          ))}
          {filtered.length === 0 && <div className="empty">No videos match “{query}”.</div>}
        </div>
      )}
    </div>
  );
}

function RankingVideoCard({
  video,
  keywords,
  onChanged,
  onAuthLost,
}: {
  video: VideoStat;
  keywords: KeywordStat[];
  onChanged: () => Promise<void>;
  onAuthLost: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const watchUrl = `https://www.youtube.com/watch?v=${video.yt_video_id}`;

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof UnauthorizedError) onAuthLost();
      else setMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    guard(async () => {
      const kw = draft.trim();
      if (!kw) return;
      await addKeyword(video.yt_video_id, kw);
      setDraft("");
      await onChanged();
    });

  const remove = (id: number) =>
    guard(async () => {
      await deleteKeyword(id);
      await onChanged();
    });

  const check = () =>
    guard(async () => {
      const res = await checkVideoRankings(video.yt_video_id);
      await onChanged();
      if (res.error) setMsg(res.error);
      else setMsg(`Checked ${res.checked.length} keyword${res.checked.length === 1 ? "" : "s"}.`);
    });

  return (
    <article className="rk-card">
      <div className="rk-card-head">
        <a className="rk-title" href={watchUrl} target="_blank" rel="noreferrer">
          {video.video_title}
        </a>
        <div className="rk-card-actions">
          {keywords.length > 0 && (
            <button className="btn-ghost" onClick={check} disabled={busy}>
              {busy ? "Checking…" : `Check ${keywords.length} · ${keywords.length * 100} units`}
            </button>
          )}
        </div>
      </div>

      {keywords.length === 0 ? (
        <div className="rk-nokw">No keywords yet.</div>
      ) : (
        <div className="rk-kws">
          {keywords.map((k) => (
            <KeywordRow key={k.id} kw={k} onDelete={() => remove(k.id)} disabled={busy} />
          ))}
        </div>
      )}

      <div className="rk-add">
        <input
          placeholder="Add a keyword…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          disabled={busy}
        />
        <button className="btn-ghost" onClick={add} disabled={busy || !draft.trim()}>
          + Add
        </button>
      </div>

      {msg && <div className="rk-msg">{msg}</div>}
    </article>
  );
}

function KeywordRow({
  kw,
  onDelete,
  disabled,
}: {
  kw: KeywordStat;
  onDelete: () => void;
  disabled: boolean;
}) {
  const last = kw.history[kw.history.length - 1] ?? null;
  const prev = kw.history[kw.history.length - 2] ?? null;

  return (
    <div className="rk-kw">
      <div className="rk-kw-main">
        <span className="rk-kw-name">{kw.keyword}</span>
        <span className="rk-now">{fmtRank(last)}</span>
        <Delta last={last} prev={prev} />
        <button className="rk-del" onClick={onDelete} disabled={disabled} title="Delete keyword">
          ×
        </button>
      </div>
      <div className="rk-chart-wrap">
        {kw.history.length === 0 ? (
          <span className="rk-faint">Not checked yet — run a check to start the graph.</span>
        ) : kw.history.length === 1 ? (
          <div className="rk-chart-one">
            <RankChart history={kw.history} />
            <span className="rk-faint">
              One data point so far ({fmtRank(last)}). The line fills in as you check on more days.
            </span>
          </div>
        ) : (
          <RankChart history={kw.history} />
        )}
      </div>
    </div>
  );
}

function fmtRank(c: RankCheck | null): string {
  if (!c) return "—";
  return c.not_in_top ? `>${SEARCH_DEPTH}` : `#${c.rank}`;
}

/** Lower rank number is better, so an effective rank past the depth = worst. */
function eff(c: RankCheck | null): number | null {
  if (!c) return null;
  return c.not_in_top ? SEARCH_DEPTH + 1 : (c.rank ?? SEARCH_DEPTH + 1);
}

function Delta({ last, prev }: { last: RankCheck | null; prev: RankCheck | null }) {
  const a = eff(last);
  const b = eff(prev);
  if (a == null || b == null) return null;
  const improved = b - a; // positive = rank went down (better)
  if (improved === 0) return <span className="rk-delta rk-delta-flat">±0</span>;
  const up = improved > 0;
  return (
    <span className={`rk-delta ${up ? "rk-delta-up" : "rk-delta-down"}`}>
      {up ? "↑" : "↓"}
      {Math.abs(improved)}
    </span>
  );
}

/** Inverted line chart: #1 at top, ">depth" at the bottom. Fixed 1..depth scale. */
function RankChart({ history }: { history: RankCheck[] }) {
  const W = 100;
  const H = 40;
  const pts = history.map((c, i) => {
    const r = c.not_in_top ? SEARCH_DEPTH : (c.rank ?? SEARCH_DEPTH);
    const x = history.length === 1 ? W / 2 : (i / (history.length - 1)) * W;
    const y = ((r - 1) / (SEARCH_DEPTH - 1)) * H;
    return { x, y };
  });
  const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const first = history[0];
  const lastEntry = history[history.length - 1];

  return (
    <div className="rk-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="rk-svg">
        <line x1="0" y1="0.5" x2={W} y2="0.5" className="rk-grid" />
        <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} className="rk-grid" />
        {pts.length > 1 && <polyline points={poly} className="rk-line" />}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.6}
            className={history[i].not_in_top ? "rk-dot rk-dot-out" : "rk-dot"}
          />
        ))}
      </svg>
      <div className="rk-chart-axis">
        <span>#1</span>
        <span>&gt;{SEARCH_DEPTH}</span>
      </div>
      <div className="rk-chart-dates">
        <span>{fmtDay(first.checked_at)}</span>
        {history.length > 1 && <span>{fmtDay(lastEntry.checked_at)}</span>}
      </div>
    </div>
  );
}

function fmtDay(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
