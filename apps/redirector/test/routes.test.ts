import { describe, expect, it } from "vitest";
// @ts-ignore
import fs from "node:fs";
// @ts-ignore
import path from "node:path";
import { listChannels, validate } from "../../../config/channels.mjs";

// @ts-ignore
const WRANGLER = path.resolve(import.meta.dirname, "..", "wrangler.toml");

/** Every `pattern = "..."` value in the file, in order. */
function routePatterns(): string[] {
  const toml = fs.readFileSync(WRANGLER, "utf8");
  return [...toml.matchAll(/^\s*pattern\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);
}

describe("redirector routes track the channel registry", () => {
  it("the registry itself is valid", () => {
    expect(validate()).toEqual([]);
  });

  it("every non-archived channel has a route", () => {
    const patterns = routePatterns();
    const missing = listChannels()
      .filter((c) => !patterns.includes(`${c.link_domain}/*`))
      .map((c) => `${c.id} (${c.link_domain})`);
    expect(missing, `REDIRECTOR_ROUTE_MISSING: ${missing.join(", ")}`).toEqual([]);
  });

  it("go.agrolloo.com is never removed", () => {
    // Its slugs are published inside YouTube descriptions. Permanent.
    expect(routePatterns()).toContain("go.agrolloo.com/*");
  });

  it("no route points at a domain no channel claims", () => {
    const claimed = new Set(listChannels().map((c) => `${c.link_domain}/*`));
    const orphans = routePatterns().filter((p) => !claimed.has(p));
    expect(orphans, `REDIRECTOR_ROUTE_ORPHAN: ${orphans.join(", ")}`).toEqual([]);
  });
});
