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

test("team panel and assignment defaults", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);

  await page.getByRole("button", { name: "Team", exact: true }).click();

  await expect(page.getByText("Sam", { exact: true })).toBeVisible();
  await expect(page.getByText(/Standard: (Scriptwriter, Recorder|Recorder, Scriptwriter)/)).toBeVisible();

  await expect(page.getByText("Assignment defaults")).toBeVisible();

  await page.getByRole("button", { name: "Add default set" }).click();

  // Every SAVED set renders its own "A new video here starts with: …" summary,
  // and seed-local.ts now seeds one (Editing › Color, added by plan 215). Scope
  // to the draft editor's live preview or the assertion matches both.
  const draftPreview = page.getByTestId("defaults-draft-preview");

  await page.locator("#def-cat").selectOption("__add_new__");
  await page.locator("#def-cat").fill("Test Category");

  // Scriptwriter label is the field label for script_writer_email
  await expect(draftPreview).toContainText("no default (scriptwriter)");

  await page.getByText("Scriptwriter", { exact: true }).locator("..").locator("select").selectOption("kushalbakliwal25@gmail.com");

  await expect(draftPreview).toContainText("Sam (scriptwriter)");

  await page.getByRole("button", { name: "Save set" }).click();

  await expect(page.getByText("Test Category")).toBeVisible();
  // The newly saved set now carries the summary; the draft editor is gone.
  await expect(
    page.getByTestId("defaults-set-preview").filter({ hasText: "Sam (scriptwriter)" }).first(),
  ).toBeVisible();
});
