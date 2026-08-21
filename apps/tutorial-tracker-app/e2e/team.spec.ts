import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

test("team panel and assignment defaults", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  
  await page.getByRole("button", { name: "Team", exact: true }).click();
  
  await expect(page.getByText("Sam", { exact: true })).toBeVisible();
  await expect(page.getByText(/Standard: (Scriptwriter, Recorder|Recorder, Scriptwriter)/)).toBeVisible();
  
  await expect(page.getByText("Assignment defaults")).toBeVisible();
  
  await page.getByRole("button", { name: "Add default set" }).click();
  
  await page.locator("#def-cat").selectOption("__add_new__");
  await page.locator("#def-cat").fill("Test Category");
  
  // Scriptwriter label is the field label for script_writer_email
  await expect(page.getByText(/A new video here starts with:.*no default \(scriptwriter\)/)).toBeVisible();
  
  await page.getByText("Scriptwriter", { exact: true }).locator("..").locator("select").selectOption("kushalbakliwal25@gmail.com");
  
  await expect(page.getByText(/A new video here starts with:.*Sam \(scriptwriter\)/)).toBeVisible();
  
  await page.getByRole("button", { name: "Save set" }).click();
  
  await expect(page.getByText("Test Category")).toBeVisible();
  await expect(page.getByText(/A new video here starts with:.*Sam \(scriptwriter\)/)).toBeVisible();
});
