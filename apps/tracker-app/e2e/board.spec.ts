import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// Smoke checks against the seeded local data. Run `npm run seed:local` first.

test("scriptwriter board shows seeded cards", async ({ page }) => {
  await loginAs(page, PERSONAS.sam);
  await expect(page.getByText("Needs your action")).toBeVisible();
  await expect(page.getByText("How to color grade in DaVinci Resolve")).toBeVisible();
  // A Need-Changes card carries its feedback banner.
  await expect(page.getByText(/Needs changes:/)).toBeVisible();
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
