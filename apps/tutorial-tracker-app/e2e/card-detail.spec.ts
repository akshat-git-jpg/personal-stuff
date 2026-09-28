import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Link minting belongs to ONE video, so it lives on that video's card. It sits
// folded, because the panel's job is the stage work and the generator is a
// sub-app. The Links tab ALSO carries it, with no stage gate, so a video still in
// production can have its links prepared ahead of time.

test("card-detail: the card points to the Links tab, folded", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  // Upload gate open (every earlier stage Done), so there is something to link.
  await page.getByText("test-standard-upload-to-do", { exact: true }).click();

  const dialog = page.getByRole("dialog");
  const toggle = dialog.getByTestId("card-links-toggle");
  await expect(toggle).toBeVisible();
  // Folded by default: the stage form comes first.
  await expect(dialog.getByText(/managed in the/)).toHaveCount(0);

  await toggle.click();
  await expect(dialog.getByText(/Affiliate links are managed in the/)).toBeVisible();
});

test("card-detail: a video with nothing to link shows no generator", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  // Editing is still In Review here, so the Upload gate is shut.
  await page.getByText("Color matching multi-cam footage", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("card-links-toggle")).toHaveCount(0);
  // And the old signpost is gone with it.
  await expect(dialog.getByText(/Affiliate links and the YouTube description/)).toHaveCount(0);
});
test("links-tab: Mint links lists every video, including ones still in production", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Links", exact: true }).click();
  await expect(page.getByTestId("links-tab")).toBeVisible();

  await page.getByRole("tab", { name: "Mint links" }).click();
  const mint = page.getByTestId("mint-links");
  await expect(mint).toBeVisible();

  // Links are prepared while a video is still being made, so an unfinished one is pickable.
  const picker = mint.getByLabel("Which video");
  await picker.selectOption({ label: "Color matching multi-cam footage" });

  // Nothing to preview until a tool is picked.
  await expect(mint.getByRole("button", { name: "Preview links" })).toBeDisabled();
  await expect(mint.getByLabel("Add tool")).toBeVisible();
});
