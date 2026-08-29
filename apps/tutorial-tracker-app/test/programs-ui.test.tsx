// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LinksTab } from "../src/client/LinksTab";
import { ProgramForm } from "../src/client/ProgramForm";

const PROGRAM = { slug: "openart", name: "OpenArt", kind: "affiliate", target_url: "https://openart.ai/home/?via=seema", network: "website", approval_status: "approved", coupon_status: "received", coupon_code: "AGROLLO", coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1, last_checked_at: null, last_status: null, last_final_url: null, previous_final_url: null, created_at: 0, updated_at: 0, updated_by: "" } as const;
const VOCAB = { kinds: ["affiliate", "external"], networks: ["website", "other"], approvalStatuses: ["approved", "unknown"], couponStatuses: ["received", "unknown"] };
function stubFetch(routes: Record<string, unknown>) { return vi.fn(async (url: string) => { const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => String(url).startsWith(k)); if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response; const payload = routes[key] as { status?: number; body?: unknown }; const status = payload?.status ?? 200; return { ok: status < 400, status, json: async () => payload?.body ?? routes[key] } as Response; }); }
function tab() { return <LinksTab rows={[]} onSaved={vi.fn()} />; }
function form(kind: "affiliate" | "external" = "affiliate", initial = null) { return <ProgramForm initial={initial} kind={kind} onClose={vi.fn()} onSaved={vi.fn()} />; }
beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

/**
 * Turn the default-on "Approved affiliate" quick filter OFF so a test can see
 * every row. The chip ships selected at the owner's request, which hides
 * external and not-yet-approved programmes - correct for the screen, but a test
 * about anything else needs the whole fixture present before it asserts.
 */
async function showEverything() {
  const chip = await screen.findByTestId("quick-approved");
  if (chip.getAttribute("aria-pressed") === "true") fireEvent.click(chip);
}

describe("LinksTab — Programs", () => {
  it("1 renders a program row from the API", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [PROGRAM], vocab: VOCAB } }); render(tab()); expect(await screen.findByText("OpenArt")).toBeTruthy(); expect(screen.getByText("via=seema")).toBeTruthy(); });
  it("2 shows the three sub-tabs and opens Programs by default", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [], vocab: VOCAB } }); render(tab()); expect(await screen.findByText("No programs yet.")).toBeTruthy(); expect(screen.getByRole("tab", { name: /Tracking links/ })).toBeTruthy(); expect(screen.getByRole("tab", { name: "Health" })).toBeTruthy(); });
  it("3 shows the empty state with an Import button when there are no programs", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [], vocab: VOCAB } }); render(tab()); expect(await screen.findByRole("button", { name: "Import from the old sheet" })).toBeTruthy(); });
  it("4 shows a Retry button when the API 5xx's", async () => { global.fetch = stubFetch({ "/api/programs": { status: 500, body: {} } }); render(tab()); expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy(); });
  it("5 shows the Admin-role message on 403 and hides Add", async () => { global.fetch = stubFetch({ "/api/programs": { status: 403, body: {} } }); render(tab()); expect(await screen.findByText("You need the Admin role to manage links.")).toBeTruthy(); expect(screen.getByRole("button", { name: "Add affiliate" }).hasAttribute("disabled")).toBe(true); });
  it("6 tints a no_credit row and labels the code as lost", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [{ ...PROGRAM, target_url: "https://openart.ai", last_status: "no_credit" }], vocab: VOCAB } }); render(tab()); expect(await screen.findByText("no code found")).toBeTruthy(); expect(screen.getByText("OpenArt").closest("tr")?.className).toContain("bg-destructive/5"); });
  it("7 labels an external row's code column not expected", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [{ ...PROGRAM, kind: "external" }], vocab: VOCAB } }); render(tab()); await showEverything(); expect(await screen.findByText("not expected")).toBeTruthy(); });
  it("8 switching to Tracking links renders the grouped links view", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [PROGRAM], vocab: VOCAB }, "/api/links": { links: [] } }); render(tab()); await screen.findByText("OpenArt"); fireEvent.click(screen.getByRole("tab", { name: "Tracking links" })); expect(await screen.findByText("No tracking links yet. Use Add -> Tracking links for a video.")).toBeTruthy(); expect(screen.queryByText("OpenArt")).toBeNull(); });
  it("shows the health view", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [], vocab: VOCAB }, "/api/link-health": { latest: null, programs: [] } }); render(tab()); fireEvent.click(screen.getByRole("tab", { name: "Health" })); expect(await screen.findByText(/first runs at 06:00 IST/)).toBeTruthy(); });
  it("renders the imported count after importing", async () => { global.fetch = stubFetch({ "/api/programs": { programs: [], vocab: VOCAB }, "/api/programs/import-from-sheet": { imported: { affiliate: 2, external: 1 } } }); render(tab()); fireEvent.click(await screen.findByRole("button", { name: "Import from the old sheet" })); expect(await screen.findByText("Imported 2 affiliate + 1 external.")).toBeTruthy(); });
});
describe("ProgramForm", () => {
  async function validate(body: unknown) { global.fetch = stubFetch({ "/api/programs/validate": body }); render(form()); const input = screen.getByLabelText("Destination URL"); fireEvent.change(input, { target: { value: "openart.ai" } }); fireEvent.blur(input); await vi.advanceTimersByTimeAsync(500); }
  it("9 disables Save and shows the reason when the URL is refused", async () => { await validate({ ok: false, value: "", error: "Not a usable web address", warnings: [] }); expect(await screen.findByText("Not a usable web address")).toBeTruthy(); expect(screen.getByRole("button", { name: "Save program" }).hasAttribute("disabled")).toBe(true); });
  it("10 shows the auto-added https:// as Saving as and keeps Save enabled", async () => { await validate({ ok: true, value: "https://openart.ai/home/?via=seema", error: null, warnings: [] }); expect(await screen.findByText("Saving as: https://openart.ai/home/?via=seema")).toBeTruthy(); expect(screen.getByRole("button", { name: "Save program" }).hasAttribute("disabled")).toBe(false); });
  it("11 keeps Save enabled for a warning, and renders the warning text", async () => { await validate({ ok: true, value: "https://bookbolt.io/", error: null, warnings: [{ code: "no_credit_marker", message: "No affiliate code found" }] }); expect(await screen.findByText("No affiliate code found")).toBeTruthy(); expect(screen.getByRole("button", { name: "Save program" }).hasAttribute("disabled")).toBe(false); });
  it("12 hides the coupon block for kind external", () => { global.fetch = stubFetch({}); render(form("external")); expect(screen.queryByLabelText("Coupon code")).toBeNull(); expect(screen.getByText(/No affiliate programme/)).toBeTruthy(); });
  it("13 makes slug read-only when editing", () => { global.fetch = stubFetch({}); render(form("affiliate", PROGRAM)); expect((screen.getByLabelText("Slug") as HTMLInputElement).readOnly).toBe(true); });
  it("derives a slug from the name while adding", () => { global.fetch = stubFetch({}); render(form()); fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Open Art Pro" } }); expect((screen.getByLabelText("Slug") as HTMLInputElement).value).toBe("open-art-pro"); });
  it("explains the empty-link state", () => { global.fetch = stubFetch({}); render(form()); expect(screen.getByText("No link yet — this programme cannot be published.")).toBeTruthy(); });
  it("renders dashboard credentials as a plain textarea", () => { global.fetch = stubFetch({}); render(form()); expect((screen.getByLabelText("Dashboard credentials") as HTMLTextAreaElement).type).toBe("textarea"); });
});

/**
 * Search, filtering and sorting on the Programs table (ProgramsView).
 * Added 2026-08-28: the owner could not navigate 93 programmes without them.
 */
describe("ProgramsView — search, filters, sorting", () => {
  const THREE = [
    { ...PROGRAM, slug: "openart", name: "OpenArt", target_url: "https://openart.ai/?via=seema" },
    { ...PROGRAM, slug: "cursor", name: "Cursor", kind: "external", target_url: "https://cursor.com" },
    { ...PROGRAM, slug: "bookbolt", name: "Book Bolt", target_url: "https://bookbolt.io/" },
  ];
  function withThree() {
    global.fetch = stubFetch({ "/api/programs": { programs: THREE, vocab: VOCAB } }) as unknown as typeof fetch;
    render(tab());
  }

  it("14 search narrows to a matching program", async () => {
    withThree();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Search programs"), { target: { value: "bookbolt" } });
    expect(screen.getByText("Book Bolt")).toBeTruthy();
    expect(screen.queryByText("OpenArt")).toBeNull();
  });

  it("15 the Type filter hides affiliate programs", async () => {
    withThree();
    await showEverything();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    // Precise filters live behind "More filters", exactly as on the All videos tab.
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "external" } });
    expect(screen.getByText("Cursor")).toBeTruthy();
    expect(screen.queryByText("OpenArt")).toBeNull();
  });

  it("16 the No code state finds the link that earns nothing", async () => {
    withThree();
    await showEverything();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "no-code" } });
    expect(screen.getByText("Book Bolt")).toBeTruthy();
    expect(screen.queryByText("OpenArt")).toBeNull();
    expect(screen.queryByText("Cursor")).toBeNull();
  });

  it("16b the shown count and Clear match the All videos toolbar", async () => {
    withThree();
    await showEverything();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    expect(screen.getByTestId("program-count").textContent).toBe("3 shown");
    fireEvent.change(screen.getByLabelText("Search programs"), { target: { value: "bookbolt" } });
    expect(screen.getByTestId("program-count").textContent).toBe("1 shown");
    // Clear returns the screen to its DEFAULTS, and the quick filter being on
    // IS the default - so 2 of the 3 fixtures, not 3. Asserting 3 here would
    // require Clear to silently drop a default the owner asked for. Switching
    // the chip off is how you see everything, and 16d covers that.
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.getByTestId("program-count").textContent).toBe("2 shown");
    expect(screen.getByTestId("quick-approved").getAttribute("aria-pressed")).toBe("true");
  });

  it("17 an external row is never counted as No code", async () => {
    withThree();
    await showEverything();
    await waitFor(() => expect(screen.getByText("Cursor")).toBeTruthy());
    // Cursor is external: a bare homepage is correct for it, so it must not be
    // offered as a problem. This is the false-positive class the owner corrected.
    expect(screen.getByText("not expected")).toBeTruthy();
  });

  it("18 filters can be cleared from the empty state", async () => {
    withThree();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Search programs"), { target: { value: "zzzznomatch" } });
    expect(screen.getByText(/No programs match those filters/)).toBeTruthy();
    fireEvent.click(screen.getByText("Clear filters"));
    expect(screen.getByText("OpenArt")).toBeTruthy();
  });

  it("19 clicking a column heading sorts, and clicking again reverses", async () => {
    withThree();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    const names = () =>
      screen.getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent?.trim());
    const heading = screen.getByTitle("Sort by Program");
    const ascending = names();
    fireEvent.click(heading);   // already ascending -> flips to descending
    expect(names()).toEqual([...ascending].reverse());
    fireEvent.click(heading);   // back to ascending
    expect(names()).toEqual(ascending);
  });

  it("19b every sortable heading is a real button with a Sort by title", async () => {
    withThree();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    for (const label of ["Program", "Type", "Destination", "Affiliate code", "Coupon", "Approval", "Last checked"]) {
      expect(screen.getByTitle(`Sort by ${label}`).tagName).toBe("BUTTON");
    }
  });

  it("20 the legend explains what the affiliate code column means", async () => {
    withThree();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    expect(screen.getByText(/will this link actually pay me/i)).toBeTruthy();
  });

  /**
   * Approval + Coupon filters and the quick filter (added 2026-08-28 at the
   * owner's request). FIVE fixtures, deliberately spanning both kinds and four
   * approval states, because a filter suite whose fixtures all share a value
   * cannot tell "the filter works" from "the filter is ignored".
   */
  const FIVE = [
    { ...PROGRAM, slug: "openart", name: "OpenArt", approval_status: "approved", coupon_status: "received" },
    { ...PROGRAM, slug: "airalo", name: "Airalo", approval_status: "applied", coupon_status: "needed" },
    { ...PROGRAM, slug: "wix", name: "Wix", approval_status: "rejected", coupon_status: "none" },
    { ...PROGRAM, slug: "cursor", name: "Cursor", kind: "external", approval_status: "approved", coupon_status: "unknown", target_url: "https://cursor.com" },
    { ...PROGRAM, slug: "semrush", name: "Semrush", approval_status: "to_apply", coupon_status: "unknown" },
  ];
  function withFive() {
    global.fetch = stubFetch({ "/api/programs": { programs: FIVE, vocab: VOCAB } }) as unknown as typeof fetch;
    render(tab());
  }
  const countText = () => screen.getByTestId("program-count").textContent;
  const only = (name: string) => {
    expect(screen.getByText(name)).toBeTruthy();
    expect(countText()).toBe("1 shown");
  };

  it("21 the quick filter is selected by default and shows only approved affiliates", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    expect(screen.getByTestId("quick-approved").getAttribute("aria-pressed")).toBe("true");
    // Cursor is approved but EXTERNAL, so it is not an affiliate programme and
    // must not appear. The quick filter narrows on both axes at once.
    expect(countText()).toBe("1 shown");
    expect(screen.queryByText("Cursor")).toBeNull();
    expect(screen.queryByText("Airalo")).toBeNull();
  });

  it("22 clicking the quick filter off reveals every programme", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    fireEvent.click(screen.getByTestId("quick-approved"));
    expect(screen.getByTestId("quick-approved").getAttribute("aria-pressed")).toBe("false");
    expect(countText()).toBe("5 shown");
    expect(screen.getByText("Cursor")).toBeTruthy();
  });

  it("23 the quick filter toggles back on", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    const chip = screen.getByTestId("quick-approved");
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(countText()).toBe("1 shown");
  });

  it("24 the Approval filter narrows to one status", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    await showEverything();
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "rejected" } });
    only("Wix");
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "applied" } });
    only("Airalo");
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "to_apply" } });
    only("Semrush");
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "approved" } });
    expect(countText()).toBe("2 shown");
  });

  it("25 the Coupon filter narrows to one status", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    await showEverything();
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Coupon"), { target: { value: "needed" } });
    only("Airalo");
    fireEvent.change(screen.getByLabelText("Coupon"), { target: { value: "received" } });
    only("OpenArt");
    fireEvent.change(screen.getByLabelText("Coupon"), { target: { value: "unknown" } });
    expect(countText()).toBe("2 shown");
  });

  it("26 Approval and Coupon combine rather than replace each other", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    await showEverything();
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "approved" } });
    fireEvent.change(screen.getByLabelText("Coupon"), { target: { value: "received" } });
    only("OpenArt");
    // approved + needed matches nothing: OpenArt is approved but already has a
    // code, and Airalo needs one but is only applied.
    fireEvent.change(screen.getByLabelText("Coupon"), { target: { value: "needed" } });
    expect(countText()).toBe("0 shown");
    expect(screen.getByText(/No programs match those filters/)).toBeTruthy();
  });

  it("27 Clear resets Approval and Coupon along with everything else", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    await showEverything();
    fireEvent.click(screen.getByText("More filters"));
    fireEvent.change(screen.getByLabelText("Approval"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Coupon"), { target: { value: "none" } });
    fireEvent.click(screen.getByText("Clear"));
    expect((screen.getByLabelText("Approval") as HTMLSelectElement).value).toBe("all");
    expect((screen.getByLabelText("Coupon") as HTMLSelectElement).value).toBe("all");
    expect(screen.getByTestId("quick-approved").getAttribute("aria-pressed")).toBe("true");
  });

  it("28 option counts are over the whole catalogue, not the current selection", async () => {
    withFive();
    await waitFor(() => expect(screen.getByText("OpenArt")).toBeTruthy());
    fireEvent.click(screen.getByText("More filters"));
    // The quick filter is still on, so one row is showing. The Rejected option
    // must still say 1, otherwise every option you are not on reads zero and
    // the dropdown stops being a map of what is in the catalogue.
    const approvalOptions = Array.from((screen.getByLabelText("Approval") as HTMLSelectElement).options)
      .map((o) => (o.textContent ?? "").trim());
    expect(approvalOptions).toContain("Rejected 1");
    expect(approvalOptions).toContain("Approved 2");
    const couponOptions = Array.from((screen.getByLabelText("Coupon") as HTMLSelectElement).options)
      .map((o) => (o.textContent ?? "").trim());
    expect(couponOptions).toContain("Code received 1");
    expect(couponOptions).toContain("Not set 2");
  });
});
