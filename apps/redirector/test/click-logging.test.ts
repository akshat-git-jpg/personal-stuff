import { describe, expect, it } from "vitest";
import worker, { isRobot } from "../src/index";
import type { Env } from "../src/index";

/**
 * Only a GET may be counted as a click.
 *
 * A HEAD is never a person. Link-preview fetchers (WhatsApp, Slack, Twitter,
 * Google) and security scanners all HEAD the URLs in a YouTube description, and
 * counting them inflates the owner's real analytics — the one dataset here that
 * cannot be regenerated. Discovered 2026-08-28 when six HEAD requests used to
 * verify a deploy each wrote a click row.
 */

interface Recorded {
  sql: string[];
}

function fakeEnv(kv: Record<string, string>): { env: Env; recorded: Recorded } {
  const recorded: Recorded = { sql: [] };
  const stmt = {
    bind: () => stmt,
    run: async () => ({ success: true }),
    all: async () => ({ results: [] }),
    first: async () => null,
  };
  const env = {
    CLICKS_KV: {
      get: async (key: string) => (key in kv ? kv[key] : null),
    },
    DB: {
      prepare: (sql: string) => {
        recorded.sql.push(sql);
        return stmt;
      },
    },
  } as unknown as Env;
  return { env, recorded };
}

/** Collects ctx.waitUntil promises so the test can await the background work. */
function fakeCtx() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => { pending.push(p); },
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  return { ctx, settle: () => Promise.all(pending) };
}

const KV = { "vcfX/openart": "https://openart.ai/home/?via=seema" };

async function call(method: string, path: string, headers: Record<string, string> = {}) {
  const { env, recorded } = fakeEnv(KV);
  const { ctx, settle } = fakeCtx();
  const res = await worker.fetch(new Request(`https://go.agrolloo.com/${path}`, { method, headers }), env, ctx);
  await settle();
  const writes = recorded.sql.filter((s) => /insert\s+into\s+clicks/i.test(s));
  return { res, writes };
}

describe("click logging counts people, not bots", () => {
  it("a GET redirects AND records one click", async () => {
    const { res, writes } = await call("GET", "vcfX/openart");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://openart.ai/home/?via=seema");
    expect(writes).toHaveLength(1);
  });

  it("a HEAD redirects but records NO click", async () => {
    const { res, writes } = await call("HEAD", "vcfX/openart");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://openart.ai/home/?via=seema");
    expect(writes).toHaveLength(0);
  });

  it("an unknown slug records no click", async () => {
    const { res, writes } = await call("GET", "zzQA/nope");
    expect(res.status).toBe(404);
    expect(writes).toHaveLength(0);
  });

  it("an unusable stored value 404s without crashing and records no click", async () => {
    const { env, recorded } = fakeEnv({ "zzQA/prose": 'have multile campaign to choose named as "x"' });
    const { ctx, settle } = fakeCtx();
    const res = await worker.fetch(new Request("https://go.agrolloo.com/zzQA/prose"), env, ctx);
    await settle();
    expect(res.status).toBe(404);
    expect(recorded.sql.filter((s) => /insert\s+into\s+clicks/i.test(s))).toHaveLength(0);
  });
});

/**
 * Robot GETs must not be counted either.
 *
 * 2026-08-28: rewriting 65 YouTube descriptions to point here made crawlers
 * harvest every new URL — 269 GETs in 622 seconds from 143 IPs but only 9
 * User-Agents, in exactly the order the descriptions were saved, most carrying a
 * spoofed `referer: https://www.google.com/` and none from youtube.com. That
 * turned 57 real clicks into 326. The HEAD rule missed them because they were
 * GETs; the (slug, ip, ua, hour) dedup missed them because every IP differed.
 */
describe("robot GETs redirect but are not counted", () => {
  const ROBOTS = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Twitterbot/1.0",
    "curl/8.4.0",
    "Wget/1.21.3",
    "python-requests/2.31.0",
    "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
    "GPTBot/1.0",
    "CCBot/2.0 (https://commoncrawl.org/faq/)",
    "Mozilla/5.0 (compatible; Bytespider)",
    "Google-InspectionTool/1.0",
    "Mozilla/5.0 (compatible; YandexBot/3.0)",
  ];

  for (const ua of ROBOTS) {
    it(`skips ${ua.slice(0, 34)}`, async () => {
      const { res, writes } = await call("GET", "vcfX/openart", { "user-agent": ua });
      // The redirect must STILL work: a robot is a visitor we do not count, not
      // a visitor we block.
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("https://openart.ai/home/?via=seema");
      expect(writes).toHaveLength(0);
    });
  }

  /**
   * The mirror, and the one that matters most: a false positive silently loses a
   * real click, which is worse than an inflated count that can be deleted. These
   * are real browser User-Agents and every one must still be counted.
   */
  const PEOPLE = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
  ];

  for (const ua of PEOPLE) {
    it(`counts ${ua.slice(0, 40)}`, async () => {
      const { res, writes } = await call("GET", "vcfX/openart", { "user-agent": ua });
      expect(res.status).toBe(302);
      expect(writes).toHaveLength(1);
    });
  }

  // An absent User-Agent is normal for privacy browsers and some in-app
  // webviews, so it is counted rather than assumed to be a robot.
  it("counts a request with no User-Agent at all", async () => {
    const { res, writes } = await call("GET", "vcfX/openart");
    expect(res.status).toBe(302);
    expect(writes).toHaveLength(1);
  });

  // A spoofed google.com referer is what 195 of the 269 carried, but it is NOT
  // the signal used: a real viewer can arrive from a Google search too. Only the
  // User-Agent decides, and this pins that so nobody "improves" it into a
  // referer rule that drops real traffic.
  it("counts a real browser even with a google.com referer", async () => {
    const { writes } = await call("GET", "vcfX/openart", {
      "user-agent": PEOPLE[0],
      referer: "https://www.google.com/",
    });
    expect(writes).toHaveLength(1);
  });

  it("isRobot is case-insensitive", () => {
    expect(isRobot("GOOGLEBOT/2.1")).toBe(true);
    expect(isRobot("CURL/8.4.0")).toBe(true);
    expect(isRobot("")).toBe(false);
  });
});
