import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Standard's Processing stage: Script Recorder -> Processor -> Video Editor.
// Seeded by scripts/seed-local.ts; the serial block MOVES "Processor hand-off demo",
// so run `npm run seed:local` before each full run.

const CARD = "Processor hand-off demo";
const INPUTS = "https://drive.example.com/editor-inputs-handoff";
const NOTE = "Voiceover done, script trimmed at the intro, all files in the folder.";

test.describe.serial("processor hand-off", () => {
  test("the processor sees the script and recording, and cannot submit without the Drive link", async ({ page }) => {
    await loginAs(page, PERSONAS.anusha);
    await page.getByText(CARD, { exact: true }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("https://docs.example.com/script-handoff")).toBeVisible();
    await expect(dialog.getByText("https://drive.example.com/recording-handoff")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Submit for review" })).toBeDisabled();
    await expect(dialog.getByText("Add the Editor inputs (Drive) first.")).toBeVisible();
  });

  test("the processor submits the Drive folder with a note", async ({ page }) => {
    await loginAs(page, PERSONAS.anusha);
    await page.getByText(CARD, { exact: true }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Editor inputs (Drive) link").fill(INPUTS);
    await dialog.getByLabel("Editor inputs (Drive) link").blur();
    await dialog.getByTestId("submit-note-input").fill(NOTE);
    await dialog.getByTestId("submit-note-send").click();
    await expect(dialog).toBeHidden();

    const waiting = page.locator("section", { hasText: "Waiting on reviewer" }).first();
    await expect(waiting.getByText(CARD, { exact: true })).toBeVisible();
  });

  test("the editor cannot start while Processing is in review", async ({ page }) => {
    await loginAs(page, PERSONAS.john);
    const mine = page.locator("section", { hasText: "Your turn" }).first();
    await expect(mine.getByText(CARD, { exact: true })).toHaveCount(0);
  });

  test("the reviewer reads the note and must brief the editor before approving", async ({ page }) => {
    await loginAs(page, PERSONAS.riya);
    const queue = page.locator("section", { hasText: "Needs your review" }).first();
    const row = queue.locator("article", { hasText: CARD }).first();
    await expect(row.getByTestId("queue-submit-note")).toHaveText(NOTE);

    await page.getByText(CARD, { exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "Open" }).first()).toBeVisible();
    const approve = dialog.getByRole("button", { name: "Approve" });
    await expect(approve).toBeDisabled();

    await dialog.getByLabel("Editing instructions").fill("Use the voiceover from the folder, cut to it.");
    await dialog.getByLabel("Editing instructions").blur();
    await expect(approve).toBeEnabled();
    await approve.click();
    await expect(dialog).toBeHidden();
  });

  test("the editor now has the recording and the processor's Drive folder", async ({ page }) => {
    await loginAs(page, PERSONAS.john);
    await page.getByText(CARD, { exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Recording link")).toBeVisible();
    await expect(dialog.getByText("https://drive.example.com/recording-handoff")).toBeVisible();
    await expect(dialog.getByText("Editor inputs (Drive) link")).toBeVisible();
    await expect(dialog.getByText(INPUTS)).toBeVisible();
    await expect(dialog.getByText("Use the voiceover from the folder, cut to it.")).toBeVisible();
    // John is a Processor in Tut 2 only; that must not make Standard's Processing "his part".
    const yourPart = dialog.getByTestId("card-detail-your-part");
    await expect(yourPart.getByText("Editing", { exact: true })).toBeVisible();
    await expect(yourPart.getByText("Processing", { exact: true })).toHaveCount(0);
  });
});

test("approving a recording needs the processor's instructions first", async ({ page }) => {
  await loginAs(page, PERSONAS.riya);
  await page.getByText("test-standard-recording-in-review", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Approve" })).toBeDisabled();
  await expect(dialog.getByText("Add the Processing instructions first.")).toBeVisible();
});

test("the team tab lists the Standard processor", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(page.getByText("Anusha", { exact: true })).toBeVisible();
  await expect(page.getByText("Standard: Processor", { exact: true })).toBeVisible();
});

test("a new Standard video asks for a Processor", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "New video" }).click();
  const dialog = page.getByRole("dialog");
  const proc = dialog.getByLabel(/Processor \(doer\)/);
  await expect(proc).toBeVisible();
  await expect(proc).toHaveValue(PERSONAS.anusha); // from the Standard assignment defaults
});

test("the processor's board fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, PERSONAS.anusha);
  await expect(page.getByText("Your turn")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
