import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Removing someone who still holds unfinished work used to succeed silently and
// leave their dead email on every stage they owned: gone from all "My work"
// lists, movable only by an admin, with nothing saying so. Now it is refused and
// the work is offered for handover. These assert the refusal WITHOUT completing a
// handover, so they never move a card another spec depends on.
test.describe("removing someone who still holds work", () => {
  test("asks first on the page, then lists the work by role", async ({ page }) => {
    await loginAs(page, PERSONAS.sean);
    await page.getByRole("button", { name: "Team", exact: true }).click();
    // Tara is Thumbnail Maker in Standard and still holds live thumbnail stages.
    const taraRow = page.getByTestId(`team-row-${PERSONAS.tara}`);
    await taraRow.getByRole("button", { name: "Remove" }).click();

    // No browser popup: the confirm sits on the row, with a way back.
    const confirm = taraRow.getByTestId("remove-confirm");
    await expect(confirm).toContainText("Remove Tara from Standard?");
    await confirm.getByRole("button", { name: "Remove" }).click();

    const panel = page.getByTestId("handover-panel");
    await expect(panel.getByRole("heading", { name: "Before you remove Tara from Standard" })).toBeVisible();
    await expect(panel.getByTestId("handover-group").first()).toContainText("Thumbnail Maker");
    await expect(panel.getByText(/Thumbnail · to do · Standard/).first()).toBeVisible();
    // Nothing is picked yet, so nothing can be sent.
    await expect(panel.getByTestId("handover-confirm")).toBeDisabled();

    // Refused means refused: she is still on the team.
    await expect(page.getByTestId(`team-row-${PERSONAS.tara}`)).toBeVisible();
  });

  test("offers only people who hold the role, and one pick for the whole group", async ({ page }) => {
    await loginAs(page, PERSONAS.sean);
    await page.getByRole("button", { name: "Team", exact: true }).click();
    const taraRow = page.getByTestId(`team-row-${PERSONAS.tara}`);
    await taraRow.getByRole("button", { name: "Remove" }).click();
    await taraRow.getByTestId("remove-confirm").getByRole("button", { name: "Remove" }).click();

    const panel = page.getByTestId("handover-panel");
    const job = panel.getByTestId("handover-job").first();
    await expect(job.locator("select option", { hasText: "John" })).toHaveCount(1);
    // The admin is not offered: the server would refuse someone without the role.
    await expect(job.locator("select option", { hasText: "Sean" })).toHaveCount(0);

    // One pick fills every row in the group, and nothing is saved yet.
    await panel.getByTestId("handover-group-pick").selectOption({ label: "John" });
    for (const sel of await panel.getByTestId("handover-job").locator("select").all()) {
      await expect(sel).toHaveValue(PERSONAS.john);
    }
    await expect(panel.getByTestId("handover-confirm")).toBeEnabled();

    // Cancel is a real way out: the panel closes and Tara keeps her work.
    await panel.getByRole("button", { name: "Cancel" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId(`team-row-${PERSONAS.tara}`)).toBeVisible();
  });

  test("taking one role away names the role, not a removal", async ({ page }) => {
    await loginAs(page, PERSONAS.sean);
    await page.getByRole("button", { name: "Team", exact: true }).click();
    await page.getByTestId(`team-row-${PERSONAS.tara}`).getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Thumbnail Maker", exact: true }).click();
    await page.getByRole("button", { name: "Uploader", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const panel = page.getByTestId("handover-panel");
    await expect(panel.getByRole("heading", { name: "Before you take Thumbnail Maker away from Tara" })).toBeVisible();
    await expect(panel.getByTestId("handover-confirm")).toContainText("save the roles");
    // Only one Save on screen: the form's own Save waits for the handover.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
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

// Hana is a throwaway fixture: this test really moves her job and removes her.
test("a full handover moves the work, then removes the person, and says so", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  const hanaRow = page.getByTestId(`team-row-${PERSONAS.hana}`);
  await hanaRow.getByRole("button", { name: "Remove" }).click();
  await hanaRow.getByTestId("remove-confirm").getByRole("button", { name: "Remove" }).click();

  const panel = page.getByTestId("handover-panel");
  await panel.getByTestId("handover-job").locator("select").selectOption({ label: "Tara" });
  await expect(panel.getByText("1 of 1 picked")).toBeVisible();
  await panel.getByTestId("handover-confirm").click();

  await expect(page.getByTestId("team-notice")).toHaveText("Handed 1 job to Tara. Hana is removed from Standard.");
  await expect(page.getByTestId(`team-row-${PERSONAS.hana}`)).toHaveCount(0);

  const board = await (await page.request.get("/api/board")).json();
  const card = board.rows.find((r: Record<string, string>) => r.video_title === "Handover demo");
  expect(card.thumbnail_maker_email).toBe(PERSONAS.tara);
});

test("team panel lists the roster", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Team", exact: true }).click();

  await expect(page.getByText("Sam", { exact: true })).toBeVisible();
  await expect(page.getByText("Standard: Script Recorder", { exact: true })).toBeVisible();
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

test("a person's systems are listed in tab order, not the order they were added", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  // Tara joined Tut 2 before Standard in the seed.
  await expect(page.getByTestId(`team-row-${PERSONAS.tara}`))
    .toContainText("Standard: Thumbnail Maker · Tut 2: Thumbnail Maker");
});
