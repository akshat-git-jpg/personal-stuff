// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinkVideos } from "../src/client/LinkVideos";
import { MintLinks } from "../src/client/MintLinks";

const program = { slug: "emergent", name: "Emergent", kind: "affiliate", target_url: "https://emergent.sh", network: "other", approval_status: "approved", coupon_status: "unknown", coupon_code: "", coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1, last_checked_at: null, last_status: null, last_final_url: null, previous_final_url: null, created_at: 0, updated_at: 0, updated_by: "" };
const videos = [
  { video_code: "WOAo", title: "Wise vs Revolut", yt_video_id: "abcdefghijk", created_at: 2, description: "Tools: go.agrolloo.com/WOAo/wise",
    links: [
      { slug: "WOAo/wise", tool: "wise", name: "Wise", short_url: "https://go.agrolloo.com/WOAo/wise", target_url: "https://wise.com/?r=1" },
      { slug: "WOAo/revolut", tool: "revolut", name: "Revolut", short_url: "https://go.agrolloo.com/WOAo/revolut", target_url: "https://revolut.com" },
    ] },
  { video_code: "vcfX", title: "OpenArt vs Higgsfield", yt_video_id: null, created_at: 1, description: "d",
    links: [{ slug: "vcfX/openart", tool: "openart", name: "OpenArt", short_url: "https://go.agrolloo.com/vcfX/openart", target_url: "https://openart.ai/?via=x" }] },
];
const issues = [
  { code: "desc_missing_link", slug: "WOAo/revolut", detail: "Minted but not in its YouTube description.", url: "https://studio.youtube.com/video/abcdefghijk/edit" },
  { code: "no_credit_marker", slug: "emergent", detail: "Emergent: No affiliate code found (raw)." },
];
function mockLinks(body: unknown = { videos, issues, checked_at: Math.floor(Date.now() / 1000), programs: [program] }, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LinkVideos", () => {
  it("lists problems by the name a person recognises, with one action each", async () => {
    const onFix = vi.fn(); mockLinks(); render(<LinkVideos onFixProgram={onFix} />);
    expect(await screen.findByText("2 things to fix")).toBeTruthy();
    expect(screen.getByText("Wise vs Revolut · revolut")).toBeTruthy();
    expect(screen.getByText("Open YouTube").closest("a")?.getAttribute("href")).toBe("https://studio.youtube.com/video/abcdefghijk/edit");
    fireEvent.click(screen.getByText("Fix programme"));
    expect(onFix).toHaveBeenCalledWith(program);
  });

  it("says all is fine when there are no problems", async () => {
    mockLinks({ videos, issues: [], checked_at: null, programs: [] }); render(<LinkVideos onFixProgram={vi.fn()} />);
    expect(await screen.findByText("All links are fine")).toBeTruthy();
  });

  it("opens a video to show its links, their problems, and copy buttons", async () => {
    mockLinks(); render(<LinkVideos onFixProgram={vi.fn()} />);
    fireEvent.click(await screen.findByText("Wise vs Revolut"));
    expect(screen.getByText("go.agrolloo.com/WOAo/revolut")).toBeTruthy();
    expect(screen.getByText("→ https://wise.com/?r=1").getAttribute("href")).toBe("https://wise.com/?r=1");
    expect(screen.getAllByText("Minted but not in its YouTube description.").length).toBe(2);
    expect(screen.getByLabelText("Copy description")).toBeTruthy();
    expect(screen.getAllByLabelText("Copy").length).toBe(2);
  });

  it("copies the description", async () => {
    const writeText = vi.fn(); Object.assign(navigator, { clipboard: { writeText } });
    mockLinks(); render(<LinkVideos onFixProgram={vi.fn()} />);
    fireEvent.click(await screen.findByText("Wise vs Revolut"));
    fireEvent.click(screen.getByLabelText("Copy description"));
    expect(writeText).toHaveBeenCalledWith("Tools: go.agrolloo.com/WOAo/wise");
  });

  it("opens the focused video straight away", async () => {
    mockLinks(); render(<LinkVideos focusCode="vcfX" onFixProgram={vi.fn()} />);
    expect(await screen.findByText("go.agrolloo.com/vcfX/openart")).toBeTruthy();
  });

  it("searches by video or tool", async () => {
    mockLinks(); render(<LinkVideos onFixProgram={vi.fn()} />);
    await screen.findByText("OpenArt vs Higgsfield");
    fireEvent.change(screen.getByLabelText("Search videos"), { target: { value: "revolut" } });
    expect(screen.queryByText("OpenArt vs Higgsfield")).toBeNull();
    expect(screen.getAllByText("Wise vs Revolut").length).toBeGreaterThan(0);
  });

  it("changes where a link goes without touching the short link", async () => {
    mockLinks(); render(<LinkVideos onFixProgram={vi.fn()} />);
    fireEvent.click(await screen.findByText("Wise vs Revolut"));
    fireEvent.click(screen.getByText("Change where a link goes"));
    fireEvent.change(screen.getByLabelText("New destination"), { target: { value: "https://wise.com/?r=2" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => url === "/api/link-resync")).toBe(true));
  });

  it("shows the Admin-role line for 403", async () => {
    mockLinks({}, 403); render(<LinkVideos onFixProgram={vi.fn()} />);
    expect(await screen.findByText(/Admin role/)).toBeTruthy();
  });
});

describe("MintLinks", () => {
  const rows = [{ row_id: "r1", video_title: "Video one", video_code: "abc" }] as never[];
  const previewBody = { video_code: "abc", items: [{ slug: "a", displayName: "A", short_url: "/abc/a", target_url: "x", status: "affiliate", coupon: "", warnings: ["tracking looks good"] }, { slug: "b", displayName: "B", short_url: "/abc/b", target_url: "", status: "blocked", coupon: "", reason: "not approved" }], description: "desc", warnings: [], blocked: [], plan_hash: "hash" };
  const stub = () => vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [{ slug: "a", displayName: "A", isApproved: true, hasCoupon: false }] })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => previewBody })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, video_code: "abc", items: [], description: "final description" }) });
  async function preview() {
    fireEvent.change(screen.getByLabelText("Which video"), { target: { value: "r1" } });
    await waitFor(() => screen.getByLabelText("Add tool"));
    fireEvent.change(screen.getByLabelText("Add tool"), { target: { value: "a" } });
    fireEvent.click(screen.getByText("Preview links"));
  }

  it("renders blocked items, their reason, and excludes them from the publish count", async () => {
    vi.stubGlobal("fetch", stub());
    render(<MintLinks rows={rows} onSaved={() => {}} onOpenVideo={() => {}} />); await preview();
    expect(await screen.findByText("not approved")).toBeTruthy(); expect(screen.getByText("tracking looks good")).toBeTruthy(); expect(screen.getByText("Publish 1 links")).toBeTruthy();
  });

  it("keeps the description on screen after publishing and links to the video", async () => {
    vi.stubGlobal("fetch", stub()); const onOpenVideo = vi.fn();
    render(<MintLinks rows={rows} onSaved={() => {}} onOpenVideo={onOpenVideo} />); await preview();
    fireEvent.click(await screen.findByText("Publish 1 links"));
    expect(await screen.findByText("Links are live")).toBeTruthy();
    expect(screen.getByText("final description")).toBeTruthy();
    fireEvent.click(screen.getByText("See this video in Videos"));
    expect(onOpenVideo).toHaveBeenCalledWith("abc");
  });
});

describe("plainDetail", () => {
  it("rewrites a technical guard message in plain words and keeps unknown ones", async () => {
    const { plainDetail } = await import("../src/client/LinkVideos");
    expect(plainDetail({ code: "no_credit_marker", slug: "x", detail: "x: No ?via= marker" })).toMatch(/earn nothing/);
    expect(plainDetail({ code: "desc_missing_link", slug: "x", detail: "kept" })).toBe("kept");
  });
});
