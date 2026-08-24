import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Removing someone who still holds unfinished work used to succeed silently and
// leave their dead email on every stage they owned: gone from all "My work"
// lists, movable only by an admin, with nothing saying so. Now it is refused and
// the work is offered for handover. These assert the refusal WITHOUT completing a
// handover, so they never move a card another spec depends on.
test.describe("removing someone who still holds work", () => {
  test("is refused, and the work is listed inline", async ({ page }) => {
    await loginAs(page, PERSONAS.sean);
    page.on("dialog", (d) => void d.accept());   // the "Remove …?" confirm

    await page.getByRole("button", { name: "Team", exact: true }).click();
    // Tara is Thumbnail Maker in Standard and still holds live thumbnail stages.
    const taraRow = page.getByTestId(`team-row-${PERSONAS.tara}`);
    await expect(taraRow).toBeVisible();
    await taraRow.getByRole("button", { name: "Remove" }).click();

    const panel = page.getByTestId("handover-panel");
    await expect(panel).toBeVisible();
    // No apostrophe in the match — the heading renders a curly one (&rsquo;).
    await expect(panel.getByText(/remove Tara yet/)).toBeVisible();
    await expect(panel.getByTestId("handover-job").first()).toBeVisible();
    // Each row names the video, the stage, its status and the system.
    await expect(panel.getByText(/Thumbnail · to do · Standard/).first()).toBeVisible();

    // Refused means refused: she is still on the team.
    await expect(page.getByTestId(`team-row-${PERSONAS.tara}`)).toBeVisible();
  });

  test("offers a real person for each stranded job", async ({ page }) => {
    await loginAs(page, PERSONAS.sean);
    page.on("dialog", (d) => void d.accept());

    await page.getByRole("button", { name: "Team", exact: true }).click();
    const taraRow = page.getByTestId(`team-row-${PERSONAS.tara}`);
    await expect(taraRow).toBeVisible();
    await taraRow.getByRole("button", { name: "Remove" }).click();

    const panel = page.getByTestId("handover-panel");
    await expect(panel).toBeVisible();
    const job = panel.getByTestId("handover-job").first();
    await expect(job).toBeVisible();

    // toHaveCount retries; a bare count() does not, and races the render.
    // "Hand to…" plus every person who holds Thumbnail Maker in Standard.
    await expect(job.locator("select option")).not.toHaveCount(0);
    await expect(job.locator("select option", { hasText: "John" })).toHaveCount(1);

    // And the one-click path for handing the whole lot to a single person.
    await expect(panel.getByTestId("handover-all")).toBeVisible();
  });

  test("the server refuses it too, not just the button", async ({ page }) => {
    await loginAs(page, PERSONAS.sean);
    const res = await page.request.post("/api/team/delete", { data: { email: PERSONAS.tara } });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("holds_live_work");
    expect(Array.isArray(body.holdings)).toBe(true);
    expect(body.holdings.length).toBeGreaterThan(0);
    // Enough detail to render a handover row and know what to write.
    expect(body.holdings[0]).toHaveProperty("col");
    expect(body.holdings[0]).toHaveProperty("stageLabel");
    expect(body.holdings[0]).toHaveProperty("role");
  });
});

test("team panel lists the roster", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Team", exact: true }).click();

  await expect(page.getByText("Sam", { exact: true })).toBeVisible();
  await expect(page.getByText(/Standard: (Scriptwriter, Recorder|Recorder, Scriptwriter)/)).toBeVisible();
});

// Assignment defaults used to be a list of sets keyed by (category, subcategory).
// Categories are gone: a system now has exactly ONE set, and each pick saves
// itself. No "Add default set", no category field, no precedence rule.
test("assignment defaults are one set per system, saved on pick", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Team", exact: true }).click();

  const panel = page.getByTestId("assignment-defaults");
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/A new video in/)).toContainText("Standard");

  // The old set-based controls are gone.
  await expect(page.getByRole("button", { name: "Add default set" })).toHaveCount(0);
  await expect(page.locator("#def-cat")).toHaveCount(0);

  // One row per assignable role, seeded from the local default set.
  const row = panel.getByTestId("default-row-script_writer_email");
  await expect(row).toBeVisible();
  const select = row.locator("select");
  await expect(select).toHaveValue(PERSONAS.sam);

  // Picking saves immediately — no Save button to forget.
  await select.selectOption("");
  await expect(panel.getByText("Saved")).toBeVisible();

  // And it stuck: reload the tab and the change is still there.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.getByTestId("assignment-defaults")
    .getByTestId("default-row-script_writer_email").locator("select")).toHaveValue("");
});
