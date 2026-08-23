import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Link minting belongs to ONE video, so it lives on that video's card. It sits
// folded, because the panel's job is the stage work and the generator is a
// sub-app. The Links tab keeps only the cross-video drift audit — picking a
// video from a dropdown there meant making the same choice twice.

test("card-detail: the card carries the link generator, folded", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  // Upload gate open (every earlier stage Done), so there is something to link.
  await page.getByText("test-standard-upload-to-do", { exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Folded by default — the generator must not crowd out the stage form.
  const toggle = dialog.getByTestId("card-links-toggle");
  await expect(toggle).toBeVisible();
  await expect(dialog.getByTestId("card-link-studio")).toHaveCount(0);

  await toggle.click();
  const studio = dialog.getByTestId("card-link-studio");
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("button", { name: /Add from catalog/ })).toBeVisible();
  await expect(studio.getByRole("button", { name: /Generate links/ })).toBeVisible();
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

test("card-detail: the Links tab is the drift audit only", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Links", exact: true }).click();

  // No per-video picker and no generator — those moved back to the card.
  await expect(page.locator("#video-picker")).toHaveCount(0);
  await expect(page.getByText("Select a video to generate links for")).toHaveCount(0);

  // The audit itself is still here.
  await expect(page.getByText("Affiliate Link Drift")).toBeVisible();
});
