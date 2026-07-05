import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Smoke checks against the seeded local data. Run `npm run seed:local` first.

test("scriptwriter board shows seeded cards", async ({ page }) => {
  await loginAs(page, PERSONAS.sam);
  await expect(page.getByText("Needs your action")).toBeVisible();
  await expect(page.getByText("How to color grade in DaVinci Resolve")).toBeVisible();
  // A Need-Changes card carries its feedback banner.
  await expect(page.getByText(/Needs changes:/)).toBeVisible();
  // Waiting-on-review items show who has it and how long (plan 019).
  await expect(page.getByText("Waiting on review")).toBeVisible();
  await expect(page.getByText(/With .+ · \d+d/)).toBeVisible();
});

test("reviewer has a populated review queue", async ({ page }) => {
  await loginAs(page, PERSONAS.riya);
  await expect(page.getByText("Needs your review")).toBeVisible();
});

test("admin sees the pipeline matrix", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await expect(page.getByRole("button", { name: "Board", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Team", exact: true })).toBeVisible();
});

test("admin attention panel and search filter", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await expect(page.getByText("Needs your attention")).toBeVisible();
  
  await expect(page.getByText("Color matching multi-cam footage")).toBeVisible();
  
  await page.getByPlaceholder("Search title…").fill("test-");
  await expect(page.getByText("Color matching multi-cam footage")).toBeHidden();
});

test("activity thread records sendback", async ({ page }) => {
  // Sean reviews a card
  await loginAs(page, PERSONAS.sean);
  await page.getByText("Color matching multi-cam footage").click();
  
  await page.getByPlaceholder("What needs to change?").fill("Please add more color grading tips.");
  await page.getByRole("button", { name: "Request changes" }).click();

  // Wait for modal to close
  await expect(page.getByRole("dialog")).toBeHidden();
  
  // Re-open it
  await page.getByText("Color matching multi-cam footage").click();
  
  // Expand Activity
  await page.getByRole("button", { name: /Activity/i }).click();
  
  // Verify content, scoped to the activity feed (the "changes requested"
  // banner elsewhere on the card repeats the same feedback text).
  const activityFeed = page.getByTestId("activity-feed");
  await expect(activityFeed.getByText("requested changes")).toBeVisible();
  await expect(activityFeed.getByText("Please add more color grading tips.")).toBeVisible();
});
