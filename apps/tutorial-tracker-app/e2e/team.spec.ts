import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

test("team panel and assignment defaults", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);

  await page.getByRole("button", { name: "Team", exact: true }).click();

  await expect(page.getByText("Sam", { exact: true })).toBeVisible();
  await expect(page.getByText(/Standard: (Scriptwriter, Recorder|Recorder, Scriptwriter)/)).toBeVisible();

  await expect(page.getByText("Assignment defaults")).toBeVisible();

  await page.getByRole("button", { name: "Add default set" }).click();

  // Every SAVED set renders its own "A new video here starts with: …" summary,
  // and seed-local.ts now seeds one (Editing › Color, added by plan 215). Scope
  // to the draft editor's live preview or the assertion matches both.
  const draftPreview = page.getByTestId("defaults-draft-preview");

  await page.locator("#def-cat").selectOption("__add_new__");
  await page.locator("#def-cat").fill("Test Category");

  // Scriptwriter label is the field label for script_writer_email
  await expect(draftPreview).toContainText("no default (scriptwriter)");

  await page.getByText("Scriptwriter", { exact: true }).locator("..").locator("select").selectOption("kushalbakliwal25@gmail.com");

  await expect(draftPreview).toContainText("Sam (scriptwriter)");

  await page.getByRole("button", { name: "Save set" }).click();

  await expect(page.getByText("Test Category")).toBeVisible();
  // The newly saved set now carries the summary; the draft editor is gone.
  await expect(
    page.getByTestId("defaults-set-preview").filter({ hasText: "Sam (scriptwriter)" }).first(),
  ).toBeVisible();
});
