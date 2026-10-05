import { describe, it, expect, vi } from "vitest";
import { descriptionIssues, fetchDescriptions, shortSlugsIn } from "../src/worker/descguard";

const links = [
  { slug: "vcfX/openart", video_code: "vcfX", tool: "openart" },
  { slug: "vcfX/higgsfield", video_code: "vcfX", tool: "higgsfield" },
  { slug: "RkIr/flowise", video_code: "RkIr", tool: "flowise" },
];
const programs = [
  { slug: "higgsfield", kind: "affiliate", target_url: "https://higgsfield.ai/?fpr=k" },
  { slug: "zapier", kind: "external", target_url: "https://zapier.com" },
];
const video = (description: string) => ({ video_code: "vcfX", yt_video_id: "abcdefghijk", title: "OpenArt vs Higgsfield", description });
const run = (description: string) => descriptionIssues({ videos: [video(description)], links, programs, linkDomains: ["go.agrolloo.com"] });

describe("shortSlugsIn", () => {
  it("finds links with or without a scheme and drops trailing punctuation", () => {
    expect(shortSlugsIn("▶ A — https://go.agrolloo.com/vcfX/openart\nB: go.agrolloo.com/vcfX/higgsfield.", ["go.agrolloo.com"]).sort())
      .toEqual(["vcfX/higgsfield", "vcfX/openart"]);
  });
});

describe("descriptionIssues", () => {
  it("is silent when the description holds exactly the minted links", () => {
    expect(run("https://go.agrolloo.com/vcfX/openart https://go.agrolloo.com/vcfX/higgsfield")).toEqual([]);
  });
  it("flags a minted link missing from the description", () => {
    expect(run("https://go.agrolloo.com/vcfX/openart").map((i) => [i.code, i.slug])).toEqual([["desc_missing_link", "vcfX/higgsfield"]]);
  });
  it("flags a link that belongs to another video", () => {
    const codes = run("go.agrolloo.com/vcfX/openart go.agrolloo.com/vcfX/higgsfield go.agrolloo.com/RkIr/flowise").map((i) => i.code);
    expect(codes).toEqual(["desc_wrong_video"]);
  });
  it("flags a short link that was never minted", () => {
    const issues = run("go.agrolloo.com/vcfX/openart go.agrolloo.com/vcfX/higgsfield go.agrolloo.com/vcfX/higsfield");
    expect(issues.map((i) => [i.code, i.slug])).toEqual([["desc_unknown_link", "vcfX/higsfield"]]);
    expect(issues[0].url).toBe("https://studio.youtube.com/video/abcdefghijk/edit");
  });
  it("flags a raw affiliate-tool URL but never an external tool's homepage", () => {
    const issues = run("go.agrolloo.com/vcfX/openart go.agrolloo.com/vcfX/higgsfield https://www.higgsfield.ai/x https://zapier.com");
    expect(issues.map((i) => [i.code, i.slug])).toEqual([["desc_raw_link", "vcfX/higgsfield"]]);
  });
});

describe("fetchDescriptions", () => {
  it("batches 50 ids per call and throws on an API error", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id${i}`);
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: "id0", snippet: { title: "T", description: "D" } }] }) });
    const out = await fetchDescriptions(ids, "key", ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(2);
    expect(out.get("id0")).toEqual({ title: "T", description: "D" });
    const bad = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(fetchDescriptions(["a"], "key", bad as unknown as typeof fetch)).rejects.toThrow("403");
  });
});
