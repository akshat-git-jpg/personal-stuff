import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

test("card-detail: the panel no longer carries the link generator", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByText("Color matching multi-cam footage").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Generate links/)).toHaveCount(0);
  await expect(dialog.getByText(/Links tab/)).toBeVisible();
});

test("card-detail: the Links tab carries it instead", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await page.getByRole("button", { name: "Links", exact: true }).click();
  await expect(page.getByText(/Generate links/)).toBeVisible();
});
