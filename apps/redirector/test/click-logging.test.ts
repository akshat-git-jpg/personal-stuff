import { describe, expect, it } from "vitest";
import worker from "../src/index";
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

async function call(method: string, path: string) {
  const { env, recorded } = fakeEnv(KV);
  const { ctx, settle } = fakeCtx();
  const res = await worker.fetch(new Request(`https://go.agrolloo.com/${path}`, { method }), env, ctx);
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
