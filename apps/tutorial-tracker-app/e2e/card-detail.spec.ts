import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Link minting belongs to ONE video, so it lives on that video's card. It sits
// folded, because the panel's job is the stage work and the generator is a
// sub-app. The Links tab ALSO carries it, with no stage gate, so a video still in
// production can have its links prepared ahead of time.

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
test("links-tab: the generator is back, and every video is pickable", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Links", exact: true }).click();

  await expect(page.getByTestId("links-tab")).toBeVisible();
  const picker = page.getByTestId("link-video-picker");
  await expect(picker).toBeVisible();

  // Nothing picked yet — a prompt, not a generator.
  await expect(page.getByTestId("link-studio-panel")).toHaveCount(0);

  // The bug this fixes: a video that has NOT cleared the Upload gate had
  // nowhere left to mint links. The card hides the generator before Upload,
  // and the old Links picker filtered the same videos out, so the tool was
  // unreachable. Both groups are pickable now.
  await expect(picker.locator('optgroup[label="Still in production"]')).not.toHaveCount(0);
  await picker.selectOption({ label: "Color matching multi-cam footage" });

  const studio = page.getByTestId("link-studio-panel");
  await expect(studio).toBeVisible();
  await expect(studio.getByRole("button", { name: /Add from catalog/ })).toBeVisible();
  await expect(studio.getByRole("button", { name: /Generate links & description/ })).toBeVisible();

  // The cross-video audit still sits below it.
  await expect(page.getByText("Affiliate Link Drift")).toBeVisible();
});
