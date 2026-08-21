import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

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
