/** Keeps clicks-db video mappings in step with tracker card YouTube links. */

/** Pull an 11-character YouTube video id from a URL or a bare id. */
export function extractYouTubeId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const idPattern = /^[A-Za-z0-9_-]{11}$/;
  if (idPattern.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) return null;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return idPattern.test(id) ? id : null;
  }

  const watchId = url.searchParams.get("v");
  if (watchId && idPattern.test(watchId)) return watchId;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0].toLowerCase())) {
    return idPattern.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

export type SyncOutcome = "written" | "unchanged" | "already-set" | "no-video-row" | "skipped";

/**
 * Write only a missing mapping. Existing mappings are intentionally immutable
 * here: changing one could silently attribute clicks to the wrong upload.
 */
export async function syncYouTubeId(
  db: D1Database, videoCode: string, ytLink: string | null | undefined,
): Promise<SyncOutcome> {
  const code = (videoCode ?? "").trim();
  const id = extractYouTubeId(ytLink);
  if (!code || !id) return "skipped";

  const row = await db
    .prepare("SELECT yt_video_id FROM videos WHERE video_code = ?")
    .bind(code)
    .first<{ yt_video_id: string | null }>();
  if (!row) return "no-video-row";
  if (row.yt_video_id === id) return "unchanged";
  if (row.yt_video_id) return "already-set";

  await db
    .prepare("UPDATE videos SET yt_video_id = ? WHERE video_code = ? AND yt_video_id IS NULL")
    .bind(id, code)
    .run();
  return "written";
}
