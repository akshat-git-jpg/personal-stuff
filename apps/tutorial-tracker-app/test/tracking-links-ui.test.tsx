// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackingLinks } from "../src/client/TrackingLinks";
import { MintLinks } from "../src/client/MintLinks";

const links = [
  { slug: "new-video/openart", video_code: "new-video", video_title: "New video", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate", created_at: 2, clicks: 19, last_status: "no_credit", last_final_url: null, last_checked_at: 1 },
  { slug: "new-video/cursor", video_code: "new-video", video_title: "New video", tool: "cursor", target_url: "https://cursor.com", kind: "external", created_at: 2, clicks: 2, last_status: null, last_final_url: null, last_checked_at: null },
  { slug: "old/missing", video_code: "old", video_title: "Old video", tool: "missing", target_url: "https://old.example", kind: "affiliate", created_at: 1, clicks: 0, last_status: null, last_final_url: null, last_checked_at: null },
];
function mockLinks(body: unknown = { links }, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("TrackingLinks", () => {
  it("renders a grouped list, video code/title, two rows and unmodified clicks", async () => {
    mockLinks(); render(<TrackingLinks />);
    expect(await screen.findByText("New video")).toBeTruthy(); expect(screen.getByText("new-video")).toBeTruthy();
    expect(screen.getByText("19").className).toContain("text-right"); expect(screen.getByText("/new-video/cursor")).toBeTruthy();
  });
  it("tints no_credit and labels an external row", async () => {
    mockLinks(); render(<TrackingLinks />); const lost = await screen.findByText("lost code");
    expect(lost.closest("tr")?.className).toContain("bg-destructive/5"); expect(screen.getByText("external")).toBeTruthy();
  });
  it("renders a missing program without crashing", async () => { mockLinks(); render(<TrackingLinks />); expect((await screen.findAllByText("program missing")).length).toBeGreaterThan(0); });
  it("names the Add path for an empty state", async () => { mockLinks({ links: [] }); render(<TrackingLinks />); expect(await screen.findByText(/Use Add/)).toBeTruthy(); });
  it("shows the Admin-role line and no edit button for 403", async () => { mockLinks({}, 403); render(<TrackingLinks />); expect(await screen.findByText(/Admin role/)).toBeTruthy(); expect(screen.queryByText("Edit")).toBeNull(); });
  it("requires confirmation naming the old and new destination", async () => { mockLinks(); render(<TrackingLinks />); fireEvent.click(await screen.findAllByText("Edit").then((x) => x[0])); fireEvent.change(screen.getByLabelText("New destination"), { target: { value: "https://new.example" } }); fireEvent.click(screen.getByText("Review change")); expect(screen.getAllByText(/https:\/\/openart.ai/).length).toBeGreaterThan(1); expect(screen.getByText(/https:\/\/new.example/)).toBeTruthy(); });
  it("shows the shown-count and clears filters like the All videos toolbar", async () => {
    mockLinks(); render(<TrackingLinks />);
    await screen.findByText("New video");
    expect(screen.getByTestId("link-count").textContent).toBe("3 shown");
    fireEvent.change(screen.getByLabelText("Search tracking links"), { target: { value: "cursor" } });
    expect(screen.getByTestId("link-count").textContent).toBe("1 shown");
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.getByTestId("link-count").textContent).toBe("3 shown");
  });

  it("filters by type behind More filters", async () => {
    mockLinks(); render(<TrackingLinks />);
    await screen.findByText("New video");
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "external" } });
    expect(screen.getByText("/new-video/cursor")).toBeTruthy();
    expect(screen.queryByText("/new-video/openart")).toBeNull();
  });

  it("filters by state behind More filters", async () => {
    mockLinks(); render(<TrackingLinks />);
    await screen.findByText("New video");
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "lost" } });
    expect(screen.getByText("/new-video/openart")).toBeTruthy();
    expect(screen.queryByText("/new-video/cursor")).toBeNull();
  });

  it("offers a way out when filters match nothing", async () => {
    mockLinks(); render(<TrackingLinks />);
    await screen.findByText("New video");
    fireEvent.change(screen.getByLabelText("Search tracking links"), { target: { value: "zzznope" } });
    expect(screen.getByText(/No links match those filters/)).toBeTruthy();
    fireEvent.click(screen.getByText("Clear filters"));
    expect(screen.getByText("New video")).toBeTruthy();
  });

  it("sorts within a group by clicking a column heading", async () => {
    mockLinks(); render(<TrackingLinks />);
    await screen.findByText("New video");
    const slugs = () => screen.getAllByText(/^\/new-video\//).map((n) => n.textContent);
    const before = slugs();
    fireEvent.click(screen.getAllByTitle("Sort by Clicks")[0]);
    // Clicks starts DESCENDING: openart (19) before cursor (2).
    expect(slugs()[0]).toBe("/new-video/openart");
    fireEvent.click(screen.getAllByTitle("Sort by Clicks")[0]);
    expect(slugs()[0]).toBe("/new-video/cursor");
    expect(before.length).toBe(2);
  });

  it("every sortable heading is a real button", async () => {
    mockLinks(); render(<TrackingLinks />);
    await screen.findByText("New video");
    for (const label of ["Short link", "Tool", "Type", "Lands on", "Clicks", "Checked"]) {
      expect(screen.getAllByTitle(`Sort by ${label}`)[0].tagName).toBe("BUTTON");
    }
  });

  it("renders active guard controls", async () => { mockLinks(); render(<TrackingLinks />); const check = await screen.findByText("Re-check all now"); expect((check as HTMLButtonElement).disabled).toBe(false); });
});
describe("MintLinks", () => {
  const rows = [{ row_id: "r1", video_title: "Video one", video_code: "abc" }] as never[];
  it("renders blocked items, their reason, and excludes them from the publish count", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ slug: "a", displayName: "A", isApproved: true, hasCoupon: false }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ video_code: "abc", items: [{ slug: "a", displayName: "A", short_url: "/abc/a", target_url: "x", status: "affiliate", coupon: "", warnings: ["tracking looks good"] }, { slug: "b", displayName: "B", short_url: "/abc/b", target_url: "", status: "blocked", coupon: "", reason: "not approved" }], description: "desc", warnings: [], blocked: [], plan_hash: "hash" }) }));
    render(<MintLinks rows={rows} onSaved={() => {}} />); fireEvent.change(screen.getByLabelText("Which video"), { target: { value: "r1" } }); await waitFor(() => screen.getByLabelText("Add tool")); fireEvent.change(screen.getByLabelText("Add tool"), { target: { value: "a" } }); fireEvent.click(screen.getByText("Preview links")); expect(await screen.findByText("not approved")).toBeTruthy(); expect(screen.getByText("tracking looks good")).toBeTruthy(); expect(screen.getByText("Publish 1 links")).toBeTruthy();
  });
});
