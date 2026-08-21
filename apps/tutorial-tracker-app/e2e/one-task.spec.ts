import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// A doer's list is all work that is already their turn — nothing in it waits on
// anyone else. So none of it is hidden. One job carries the action; the rest are
// visible but quiet. The count in the header must equal what is on screen: the
// old "5 in the header, 1 on screen, 4 behind a chevron" read as a bug.
test("one-task: one job carries the action, the rest stay quiet", async ({ page }) => {
  await loginAs(page, PERSONAS.sam);
  const section = page.locator("section", { hasText: "Your turn" }).first();

  // Exactly one full card. <article> is what Card renders; quiet rows are divs.
  await expect(section.locator("article")).toHaveCount(1);

  // Nothing is folded away any more.
  await expect(page.getByRole("button", { name: /more after this/ })).toHaveCount(0);
});

test("one-task: the header count equals the jobs on screen", async ({ page }) => {
  await loginAs(page, PERSONAS.sam);
  const section = page.locator("section", { hasText: "Your turn" }).first();

  const claimed = Number((await section.locator("span").first().innerText()).trim());
  const shown =
    (await section.locator("article").count()) +
    (await section.getByTestId("quiet-job").count());

  expect(claimed).toBeGreaterThan(0);
  expect(shown).toBe(claimed);
});

test("one-task: a stage locked behind someone else is not on the doer's screen", async ({ page }) => {
  // Tara owns only the gated Thumbnail of this video — the Editing before it is
  // unfinished, so there is nothing she can do. It used to sit under "Up next",
  // which read as "coming soon" for work that had been stalled 42 days.
  await loginAs(page, PERSONAS.tara);
  await expect(page.getByText("Up next")).toHaveCount(0);
  await expect(page.getByText("Waiting on someone else's edit")).toHaveCount(0);
});

test("one-task: no sideways scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, PERSONAS.sam);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
