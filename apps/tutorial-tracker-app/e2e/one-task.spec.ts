import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Sam owns several script/recording stages in the seed. Exactly one may render
// as an actionable card; the rest must hide behind the collapsed count.
test("one-task: a doer sees exactly one actionable card", async ({ page }) => {
  await loginAs(page, PERSONAS.sam);
  const section = page.locator("section", { hasText: "Needs your action" }).first();
  await expect(section.locator("article")).toHaveCount(1);
  await expect(section.getByText(/more after this/)).toBeVisible();
});

test("one-task: no sideways scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, PERSONAS.sam);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
