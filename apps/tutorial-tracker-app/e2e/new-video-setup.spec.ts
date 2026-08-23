import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// A small Windows laptop with a bookmarks bar leaves roughly this much room.
// The setup dialog grows with the pipeline's stage count (a doer select, a
// reviewer select and a hint line each), so it outgrows a short screen fast.
const SHORT_LAPTOP = { width: 1280, height: 620 };

test("New video: the setup dialog fits a short screen and scrolls", async ({ page }) => {
  await page.setViewportSize(SHORT_LAPTOP);
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "New video" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // It used to be centred with no height cap, so a tall dialog hung off BOTH
  // ends of the screen and neither end could be reached — no scrollbar anywhere.
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(SHORT_LAPTOP.height);

  // The title and the action sit outside the scrolling middle, so they stay put.
  await expect(dialog.getByText("New video")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create video" })).toBeVisible();

  // The middle genuinely scrolls, and the last person select is reachable.
  const body = dialog.getByTestId("new-video-body");
  const scrollable = await body.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(scrollable).toBe(true);

  const lastSelect = dialog.locator("select").last();
  await lastSelect.scrollIntoViewIfNeeded();
  await expect(lastSelect).toBeInViewport();
});

test("New video setup guard", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  
  await page.getByRole("button", { name: "New video" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  
  // Fill brief to trigger defaults
  await page.getByLabel(/Title/).fill("E2E setup video");
  await page.getByLabel(/Notes/).fill("Do this");
  
  // Category is a combobox, we can fill its input
  await page.getByLabel(/Category/).selectOption("Editing");
  await page.getByLabel(/Subcategory/).selectOption("Color");
  
  // Wait for the defaults to fetch and prefill to appear
  await expect(page.locator("text=pre-filled from your Editing defaults")).toBeVisible();
  
  // 2. Assert people selects are pre-filled (at least one non-empty)
  // There are selects for each doer role and reviewer.
  const scriptwriterSelect = page.getByLabel(/Scriptwriter \(doer\)/);
  const val = await scriptwriterSelect.inputValue();
  expect(val).not.toBe(""); // should be pre-filled from defaults

  // 3. Clear one required person -> assert create button disabled and footer names role
  await scriptwriterSelect.selectOption("");
  
  const createBtn = page.getByRole("button", { name: "Create video" });
  await expect(createBtn).toBeDisabled();
  
  // The footer should name the missing role
  await expect(page.locator("text=left:")).toBeVisible();
  await expect(page.locator(".text-destructive")).toContainText("Scriptwriter");

  // 4. Fill everything -> assert button enables, click it, dialog closes.
  // Re-fill the doer we cleared
  await scriptwriterSelect.selectOption(PERSONAS.sam);
  


  await expect(createBtn).toBeEnabled();
  await createBtn.evaluate(b => (b as HTMLButtonElement).click());
  
  await expect(page.getByRole("dialog")).toBeHidden();
});
