import { describe, expect, it, vi } from "vitest";
import { assertNotOwnShortLink, judge, probeAll, probeOne } from "../src/worker/linkprobe";

const affiliate = { slug: "bookbolt", targetUrl: "https://bookbolt.io/6671.html", kind: "affiliate" } as const;
const external = { slug: "cursor", targetUrl: "https://cursor.com", kind: "external" } as const;
const response = (status: number, url: string) => ({ status, url }) as Response;
describe("link probe", () => {
  it("refuses our own short link", () => expect(() => assertNotOwnShortLink("https://go.agrolloo.com/vcfX/openart")).toThrow("refuses"));
  it("allows a normal destination", () => expect(() => assertNotOwnShortLink("https://openart.ai/?via=seema")).not.toThrow());
  it("judges affiliate credit, external links, dead links, and bot blocks", () => { expect(judge(affiliate, 200, "https://x.example/?via=me").status).toBe("ok"); expect(judge(affiliate, 200, "https://bookbolt.io/").status).toBe("no_credit"); expect(judge(external, 200, "https://cursor.com/").status).toBe("ok"); expect(judge(affiliate, 404, "https://bookbolt.io/").status).toBe("dead"); expect(judge(affiliate, 403, "https://bookbolt.io/").status).toBe("unverifiable"); expect(judge(affiliate, 429, "https://bookbolt.io/").status).toBe("unverifiable"); });
  it("uses the injected fetch and treats failure as unverifiable", async () => { const fetcher = vi.fn(async () => response(200, "https://x.example/?via=me")); expect((await probeOne(affiliate, fetcher)).status).toBe("ok"); expect(fetcher).toHaveBeenCalledWith(affiliate.targetUrl, expect.objectContaining({ redirect: "follow" })); expect((await probeOne(affiliate, async () => { throw new Error("offline"); })).status).toBe("unverifiable"); });
  it("returns a slug-sorted batch and refuses a short link in the batch", async () => { const results = await probeAll([{ ...affiliate, slug: "z" }, { ...external, slug: "a" }], async (url) => response(200, url)); expect(results.map((result) => result.slug)).toEqual(["a", "z"]); await expect(probeAll([{ ...affiliate, targetUrl: "https://go.agrolloo.com/x" }], async (url) => response(200, url))).rejects.toThrow("refuses"); });
});
