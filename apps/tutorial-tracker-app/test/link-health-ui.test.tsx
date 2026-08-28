// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LinkHealth } from "../src/client/LinkHealth";

const program = { slug: "openart", name: "OpenArt", kind: "affiliate", target_url: "https://openart.ai/?via=me", network: "other", approval_status: "approved", coupon_status: "unknown", coupon_code: "", coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1, last_checked_at: null, last_status: null, last_final_url: null, previous_final_url: null, created_at: 0, updated_at: 0, updated_by: "" };
const stub = (body: unknown, status = 200) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response);
const renderHealth = () => render(<LinkHealth onFix={vi.fn()} />);
const latestWith = (issues: unknown[], checked = 10, unverifiable = 0) =>
  ({ ran_at: 1, checked, unverifiable, issues_json: JSON.stringify(issues) });

describe("LinkHealth", () => {
  it("names the 06:00 IST first run", async () => {
    global.fetch = stub({ latest: null, programs: [] });
    renderHealth();
    expect(await screen.findByText(/first runs at 06:00 IST/)).toBeTruthy();
  });

  it("shows all-fine count and last run", async () => {
    global.fetch = stub({ latest: latestWith([], 4), programs: [] });
    renderHealth();
    expect(await screen.findByText(/All 4 links are fine/)).toBeTruthy();
    expect(screen.getByText(/Last run/)).toBeTruthy();
  });

  it("groups money and changed issues with their details", async () => {
    global.fetch = stub({
      latest: latestWith([
        { code: "no_credit_marker", slug: "openart", detail: "lost code" },
        { code: "changed_destination", slug: "openart", detail: "Was old; now new." },
      ], 2, 2),
      programs: [program],
    });
    renderHealth();
    expect(await screen.findByText(/Costing you money now/)).toBeTruthy();
    expect(screen.getByText(/Changed since last week/)).toBeTruthy();
    expect(screen.getByText("lost code")).toBeTruthy();
    expect(screen.getByText(/Was old; now new/)).toBeTruthy();
    expect(screen.getByText(/2 links block robots/)).toBeTruthy();
  });

  it("shows Admin forbidden state", async () => {
    global.fetch = stub({}, 403);
    renderHealth();
    expect(await screen.findByText("You need the Admin role to see link health.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Re-check now" })).toBeNull();
  });

  // The Retry button used to ship `disabled title="Health could not load"`, so
  // the one control on the error screen could never be pressed and the only way
  // out was a page reload. A retry that cannot retry is worse than no button.
  it("offers a Retry that actually retries", async () => {
    const fetchStub = stub({}, 500);
    global.fetch = fetchStub;
    renderHealth();
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(retry.hasAttribute("disabled")).toBe(false);
    const before = fetchStub.mock.calls.length;
    fireEvent.click(retry);
    expect(fetchStub.mock.calls.length).toBeGreaterThan(before);
  });

  it("opens the program form action for its slug", async () => {
    const fix = vi.fn();
    global.fetch = stub({ latest: latestWith([{ code: "no_credit_marker", slug: "openart", detail: "lost" }], 1), programs: [program] });
    render(<LinkHealth onFix={fix} />);
    fireEvent.click(await screen.findByRole("button", { name: "Fix programme" }));
    expect(fix).toHaveBeenCalledWith(expect.objectContaining({ slug: "openart" }));
  });

  // --- the count the owner asked for -------------------------------------

  it("headlines the total needing attention", async () => {
    global.fetch = stub({
      latest: latestWith([
        { code: "no_credit_marker", slug: "a", detail: "d" },
        { code: "bad_url", slug: "b", detail: "d" },
        { code: "approved_no_link", slug: "c", detail: "d" },
      ], 20),
      programs: [],
    });
    renderHealth();
    expect((await screen.findByTestId("attention-count")).textContent).toBe("3 need your attention");
  });

  it("says needs, not need, for a single issue", async () => {
    global.fetch = stub({ latest: latestWith([{ code: "bad_url", slug: "a", detail: "d" }], 20), programs: [] });
    renderHealth();
    expect((await screen.findByTestId("attention-count")).textContent).toBe("1 needs your attention");
  });

  it("breaks the total down per group and reconciles against the fine count", async () => {
    global.fetch = stub({
      latest: latestWith([
        { code: "no_credit_marker", slug: "a", detail: "d" },
        { code: "bad_url", slug: "b", detail: "d" },
        { code: "approved_no_link", slug: "c", detail: "d" },
        { code: "own_redirect_layer", slug: "d", detail: "d" },
      ], 10),
      programs: [],
    });
    renderHealth();
    await screen.findByTestId("attention-count");
    const summary = screen.getByText(/costing money/).textContent ?? "";
    expect(summary).toContain("2 costing money");
    expect(summary).toContain("1 changed");
    expect(summary).toContain("1 other");
    expect(summary).toContain("6 fine of 10");
  });

  // The regression this rewrite exists to prevent. own_redirect_layer,
  // unmapped_video, wrapped_redirect and scheme_added were counted by the guard
  // and rendered by nothing, so the headline count disagreed with the cards on
  // screen and four whole classes of problem were invisible. The catch-all group
  // must hold anything the two named sets do not claim.
  it("renders every issue code, including ones no named group claims", async () => {
    const orphanCodes = ["own_redirect_layer", "unmapped_video", "wrapped_redirect", "scheme_added", "a_code_invented_tomorrow"];
    global.fetch = stub({
      latest: latestWith(orphanCodes.map((code, i) => ({ code, slug: `slug-${i}`, detail: `detail for ${code}` })), 30),
      programs: [],
    });
    renderHealth();
    expect((await screen.findByTestId("attention-count")).textContent).toBe("5 need your attention");
    expect(screen.getByText(/Also worth fixing/)).toBeTruthy();
    for (const code of orphanCodes) {
      expect(screen.getByText(`detail for ${code}`)).toBeTruthy();
    }
  });

  it("shows no group heading when a group is empty", async () => {
    global.fetch = stub({ latest: latestWith([{ code: "bad_url", slug: "a", detail: "d" }], 5), programs: [] });
    renderHealth();
    await screen.findByTestId("attention-count");
    expect(screen.queryByText(/Changed since last week/)).toBeNull();
    expect(screen.queryByText(/Also worth fixing/)).toBeNull();
  });
});
