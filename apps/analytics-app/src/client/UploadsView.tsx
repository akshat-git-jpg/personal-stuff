// Uploads tab: upload-frequency overview driven by each video's real YouTube
// publish date (VideoStat.published_at). Pure client-side — it computes buckets
// and the in-range video list from the already-loaded /api/videos payload.

import { useMemo, useState } from "react";
import type { VideoStat } from "./api";

type Bucket = "week" | "month";

interface DatedVideo {
  video_code: string;
  title: string;
  yt_video_id: string | null;
  date: Date; // parsed published_at
}

const DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toInput(d: Date): string {
  // local YYYY-MM-DD for <input type="date">
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromInput(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Monday-based start of the ISO-ish week containing d.
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // 0 = Monday
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - dow);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface BucketCount {
  start: Date;
  label: string;
  count: number;
}

// Build contiguous week/month buckets spanning [start, end], filling gaps with 0.
function buildBuckets(videos: DatedVideo[], start: Date, end: Date, bucket: Bucket): BucketCount[] {
  const buckets: BucketCount[] = [];
  const keyFor = (d: Date) =>
    bucket === "week" ? toInput(startOfWeek(d)) : `${d.getFullYear()}-${d.getMonth()}`;

  const counts = new Map<string, number>();
  for (const v of videos) counts.set(keyFor(v.date), (counts.get(keyFor(v.date)) ?? 0) + 1);

  if (bucket === "week") {
    let cur = startOfWeek(start);
    const last = startOfWeek(end);
    while (cur <= last) {
      const k = toInput(cur);
      buckets.push({ start: new Date(cur), label: fmtShort(cur), count: counts.get(k) ?? 0 });
      cur = new Date(cur.getTime() + 7 * DAY);
    }
  } else {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      const k = `${cur.getFullYear()}-${cur.getMonth()}`;
      buckets.push({
        start: new Date(cur),
        label: cur.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        count: counts.get(k) ?? 0,
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  return buckets;
}

type PresetKey = "30d" | "90d" | "year" | "all";

export function UploadsView({ videos }: { videos: VideoStat[] }) {
  // Videos that have a real YouTube publish date.
  const dated = useMemo<DatedVideo[]>(() => {
    const out: DatedVideo[] = [];
    for (const v of videos) {
      if (!v.published_at) continue;
      const date = new Date(v.published_at);
      if (Number.isNaN(date.getTime())) continue;
      out.push({
        video_code: v.video_code,
        title: v.video_title,
        yt_video_id: v.yt_video_id,
        date,
      });
    }
    out.sort((a, b) => b.date.getTime() - a.date.getTime());
    return out;
  }, [videos]);

  const untracked = videos.length - dated.length;

  // Overall data span (used by the "All time" preset and as default range).
  const span = useMemo(() => {
    if (dated.length === 0) return null;
    const min = startOfDay(dated[dated.length - 1].date);
    const max = startOfDay(dated[0].date);
    return { min, max };
  }, [dated]);

  const [bucket, setBucket] = useState<Bucket>("month");
  const [preset, setPreset] = useState<PresetKey>("all");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  // Resolve the active [start, end] range from preset or custom inputs.
  const range = useMemo(() => {
    const today = startOfDay(new Date());
    if (customStart || customEnd) {
      const start = customStart ?? span?.min ?? today;
      const end = customEnd ?? today;
      return { start, end };
    }
    switch (preset) {
      case "30d":
        return { start: new Date(today.getTime() - 29 * DAY), end: today };
      case "90d":
        return { start: new Date(today.getTime() - 89 * DAY), end: today };
      case "year":
        return { start: new Date(today.getFullYear(), 0, 1), end: today };
      case "all":
      default:
        return { start: span?.min ?? today, end: span?.max ?? today };
    }
  }, [preset, customStart, customEnd, span]);

  const inRange = useMemo(() => {
    const lo = range.start.getTime();
    const hi = range.end.getTime() + DAY - 1; // inclusive of end day
    return dated.filter((v) => {
      const t = v.date.getTime();
      return t >= lo && t <= hi;
    });
  }, [dated, range]);

  const buckets = useMemo(
    () => buildBuckets(inRange, range.start, range.end, bucket),
    [inRange, range, bucket],
  );

  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0);

  const days = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / DAY) + 1);
  const perWeek = (inRange.length / days) * 7;

  function pickPreset(p: PresetKey) {
    setPreset(p);
    setCustomStart(null);
    setCustomEnd(null);
  }

  if (span === null) {
    return (
      <div className="empty">
        <p className="empty-title">No upload dates yet</p>
        <p>
          This view uses each video&apos;s real YouTube publish date. None of your videos have a
          linked YouTube id with a reachable publish date yet — once <code>YT_API_KEY</code> is set
          and videos have a YouTube id, uploads will show up here.
        </p>
      </div>
    );
  }

  const presets: { key: PresetKey; label: string }[] = [
    { key: "30d", label: "Last 30 days" },
    { key: "90d", label: "Last 90 days" },
    { key: "year", label: "This year" },
    { key: "all", label: "All time" },
  ];
  const customActive = !!(customStart || customEnd);

  return (
    <div className="uploads">
      <div className="up-controls">
        <div className="up-presets">
          {presets.map((p) => (
            <button
              key={p.key}
              className={`chip ${!customActive && preset === p.key ? "chip-on" : ""}`}
              onClick={() => pickPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="up-custom">
          <label>
            From
            <input
              type="date"
              value={customStart ? toInput(customStart) : toInput(range.start)}
              onChange={(e) => setCustomStart(fromInput(e.target.value))}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={customEnd ? toInput(customEnd) : toInput(range.end)}
              onChange={(e) => setCustomEnd(fromInput(e.target.value))}
            />
          </label>
        </div>
        <div className="up-bucket">
          <button
            className={`chip ${bucket === "week" ? "chip-on" : ""}`}
            onClick={() => setBucket("week")}
          >
            Week
          </button>
          <button
            className={`chip ${bucket === "month" ? "chip-on" : ""}`}
            onClick={() => setBucket("month")}
          >
            Month
          </button>
        </div>
      </div>

      <div className="up-headline">
        <span className="up-count">{inRange.length.toLocaleString()}</span> uploads ·{" "}
        {fmtDate(range.start)} – {fmtDate(range.end)} · ~{perWeek.toFixed(1)}/week
      </div>

      {untracked > 0 && (
        <div className="up-note">
          {untracked} video{untracked === 1 ? "" : "s"} without a YouTube publish date{" "}
          {untracked === 1 ? "isn't" : "aren't"} shown here.
        </div>
      )}

      <div className="up-chart" role="img" aria-label="uploads per period">
        {buckets.map((b) => (
          <div className="up-bar-col" key={b.start.getTime()} title={`${b.label}: ${b.count}`}>
            <div className="up-bar-val">{b.count || ""}</div>
            <div
              className="up-bar"
              style={{ height: maxCount ? `${Math.round((b.count / maxCount) * 100)}%` : "0%" }}
            />
            <div className="up-bar-label">{b.label}</div>
          </div>
        ))}
      </div>

      <div className="up-list">
        {inRange.length === 0 ? (
          <div className="empty">
            <p>No uploads in this range.</p>
          </div>
        ) : (
          inRange.map((v) => {
            const url = v.yt_video_id
              ? `https://www.youtube.com/watch?v=${v.yt_video_id}`
              : null;
            return (
              <div className="up-row" key={v.video_code}>
                {url ? (
                  <a className="up-row-title" href={url} target="_blank" rel="noreferrer">
                    {v.title}
                  </a>
                ) : (
                  <span className="up-row-title">{v.title}</span>
                )}
                <span className="up-row-date">{fmtDate(v.date)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
