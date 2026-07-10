import { describe, it, expect } from "vitest";
import { linkDriftDiff } from "../src/worker/clickstore";
import type { AffiliateRecord } from "../src/worker/affiliate";

const aff = (over: Partial<AffiliateRecord> & { tool: string }): AffiliateRecord => ({
  displayName: over.tool,
  targetUrl: "",
  approvalStatus: "",
  couponStatus: "",
  couponCode: "",
  isApproved: false,
  ...over,
});

describe("linkDriftDiff", () => {
  const affiliates: Record<string, AffiliateRecord> = {
    railway: aff({ tool: "railway", isApproved: true, targetUrl: "https://aff/railway1" }),
    render: aff({ tool: "render", isApproved: false, targetUrl: "https://aff/render" }),
  };

  it("emits url_changed when targets differ", () => {
    const links = [{ slug: "r", tool: "railway", target_url: "https://aff/old" }];
    const res = linkDriftDiff(links, affiliates);
    expect(res).toEqual([{
      slug: "r", tool: "railway", minted_url: "https://aff/old", current_url: "https://aff/railway1", kind: "url_changed"
    }]);
  });

  it("emits deactivated when approval flipped", () => {
    const links = [{ slug: "r", tool: "render", target_url: "https://aff/render" }];
    const res = linkDriftDiff(links, affiliates);
    expect(res).toEqual([{
      slug: "r", tool: "render", minted_url: "https://aff/render", current_url: "", kind: "deactivated"
    }]);
  });

  it("emits missing when the tool is gone", () => {
    const links = [{ slug: "r", tool: "fliki", target_url: "https://aff/fliki" }];
    const res = linkDriftDiff(links, affiliates);
    expect(res).toEqual([{
      slug: "r", tool: "fliki", minted_url: "https://aff/fliki", current_url: "", kind: "missing"
    }]);
  });

  it("emits nothing when in sync", () => {
    const links = [{ slug: "r", tool: "railway", target_url: "https://aff/railway1" }];
    const res = linkDriftDiff(links, affiliates);
    expect(res).toEqual([]);
  });
});
