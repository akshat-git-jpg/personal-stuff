import { describe, expect, it } from "vitest";
import { extractYouTubeId, syncYouTubeId } from "../src/worker/ytsync";

describe("extractYouTubeId", () => {
  it("reads supported YouTube URL shapes", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=TaBrgRQSqeU")).toBe("TaBrgRQSqeU");
    expect(extractYouTubeId("https://youtube.com/watch?v=TaBrgRQSqeU&t=42s&list=PLx")).toBe("TaBrgRQSqeU");
    expect(extractYouTubeId("https://youtu.be/K-Uj9NnetLQ")).toBe("K-Uj9NnetLQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/n7KLdCjod2U")).toBe("n7KLdCjod2U");
    expect(extractYouTubeId("https://www.youtube.com/embed/n7KLdCjod2U")).toBe("n7KLdCjod2U");
    expect(extractYouTubeId("https://www.youtube.com/live/n7KLdCjod2U")).toBe("n7KLdCjod2U");
  });

  it("accepts scheme-less URLs and bare ids", () => {
    expect(extractYouTubeId("youtube.com/watch?v=TaBrgRQSqeU")).toBe("TaBrgRQSqeU");
    expect(extractYouTubeId("TaBrgRQSqeU")).toBe("TaBrgRQSqeU");
  });

  it("rejects non-video links and malformed ids", () => {
    expect(extractYouTubeId("https://www.youtube.com/@AgrolloReviews")).toBeNull();
    expect(extractYouTubeId("https://vimeo.com/123456789")).toBeNull();
    expect(extractYouTubeId("will add the link later")).toBeNull();
    expect(extractYouTubeId("https://youtu.be/tooshort")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId(null)).toBeNull();
  });
});

function recordingDb(existing: string | null | undefined) {
  const statements: string[] = [];
  const statement = {
    bind: () => statement,
    first: async () => (existing === undefined ? null : { yt_video_id: existing }),
    run: async () => ({ success: true }),
  };
  const db = { prepare(sql: string) { statements.push(sql); return statement; } };
  return { db: db as unknown as D1Database, statements };
}

describe("syncYouTubeId", () => {
  it("writes a missing mapping with the intended guarded update", async () => {
    const { db, statements } = recordingDb(null);
    expect(await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU")).toBe("written");
    expect(statements).toEqual([
      "SELECT yt_video_id FROM videos WHERE video_code = ?",
      "UPDATE videos SET yt_video_id = ? WHERE video_code = ? AND yt_video_id IS NULL",
    ]);
  });

  it("never overwrites or updates an already mapped video", async () => {
    for (const existing of ["OTHERvideo1", "TaBrgRQSqeU"]) {
      const { db, statements } = recordingDb(existing);
      const outcome = await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU");
      expect(outcome).toBe(existing === "TaBrgRQSqeU" ? "unchanged" : "already-set");
      expect(statements).toHaveLength(1);
    }
  });

  it("reports an unknown video code", async () => {
    const { db } = recordingDb(undefined);
    expect(await syncYouTubeId(db, "zzzz", "https://youtu.be/TaBrgRQSqeU")).toBe("no-video-row");
  });

  it("skips missing codes and invalid links without querying", async () => {
    for (const [code, link] of [["vcfX", "not a link"], ["vcfX", ""], ["", "https://youtu.be/TaBrgRQSqeU"]] as const) {
      const { db, statements } = recordingDb(null);
      expect(await syncYouTubeId(db, code, link)).toBe("skipped");
      expect(statements).toHaveLength(0);
    }
  });

  it("never touches the clicks table", async () => {
    const { db, statements } = recordingDb(null);
    await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU");
    for (const statement of statements) expect(statement).not.toMatch(/\bclicks\b/i);
  });
});
