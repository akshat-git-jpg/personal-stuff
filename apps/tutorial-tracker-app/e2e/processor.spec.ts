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

// One person, two stages: the Script Recorder writes, gets it approved, then records.
const JOURNEY = "Script recorder journey demo";

async function submitWork(page: import("@playwright/test").Page, linkLabel: string, url: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(linkLabel).fill(url);
  await dialog.getByLabel(linkLabel).blur();
  await dialog.getByTestId("submit-note-input").fill("Ready.");
  await dialog.getByTestId("submit-note-send").click();
  await expect(dialog).toBeHidden();
}

async function approveWith(page: import("@playwright/test").Page, instrLabel: string) {
  await page.getByText(JOURNEY, { exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const approve = dialog.getByRole("button", { name: "Approve" });
  await expect(approve).toBeDisabled();
  await dialog.getByLabel(instrLabel).fill("Go ahead.");
  await dialog.getByLabel(instrLabel).blur();
  await approve.click();
  await expect(dialog).toBeHidden();
}

test.describe.serial("script recorder journey", () => {
  test("recording is not open while the script is unapproved", async ({ page }) => {
    await loginAs(page, PERSONAS.sam);
    await page.getByText(JOURNEY, { exact: true }).click();
    const yourPart = page.getByRole("dialog").getByTestId("card-detail-your-part");
    await expect(yourPart.getByText("Script", { exact: true })).toBeVisible();
    await expect(yourPart.getByText("Recording", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Submit for review" })).toBeVisible();
  });

  test("the script recorder submits the script", async ({ page }) => {
    await loginAs(page, PERSONAS.sam);
    await page.getByText(JOURNEY, { exact: true }).click();
    await submitWork(page, "Script link", "https://docs.example.com/journey-script");
  });

  test("the reviewer approves the script after briefing the recording", async ({ page }) => {
    await loginAs(page, PERSONAS.riya);
    await approveWith(page, "Recording instructions");
  });

  test("the same person now records it", async ({ page }) => {
    await loginAs(page, PERSONAS.sam);
    await page.getByText(JOURNEY, { exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("https://docs.example.com/journey-script")).toBeVisible();
    await dialog.getByLabel("Recording ETA").fill("2026-10-05");
    await dialog.getByLabel("Recording ETA").blur();
    const started = page.waitForResponse((r) => r.url().includes("/api/update") && (r.request().postData() ?? "").includes("tutorial_status"));
    await dialog.getByRole("button", { name: "Start" }).click();
    await started;
    await expect(dialog).toBeHidden(); // the panel closes on every move
    // Under parallel load the list can lag the write by a moment, so reopen until it catches up.
    await expect(async () => {
      await page.reload();
      await page.getByText(JOURNEY, { exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Submit for review" })).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });
    await submitWork(page, "Recording link", "https://drive.example.com/journey-recording");
  });

  test("approving the recording hands it to the processor", async ({ page }) => {
    await loginAs(page, PERSONAS.riya);
    await approveWith(page, "Processing instructions");
    await loginAs(page, PERSONAS.anusha);
    const mine = page.locator("section", { hasText: "Your turn" }).first();
    await expect(mine.getByText(JOURNEY, { exact: true })).toBeVisible();
  });
});

test("new video: script and recording pickers are named apart, and one fills the other", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "New video" }).click();
  const dialog = page.getByRole("dialog");
  const script = dialog.getByLabel("Script Recorder (Script) (doer)");
  const recording = dialog.getByLabel("Script Recorder (Recording) (doer)");
  await expect(script).toBeVisible();
  await expect(recording).toBeVisible();

  await script.selectOption("");
  await recording.selectOption("");
  await script.selectOption(PERSONAS.sam);
  await expect(recording).toHaveValue(PERSONAS.sam);
});
