import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

const LABELS = ["Waiting on you", "Late", "Not moving", "Moving fine"];

async function tileCount(page, label: string): Promise<number> {
  const tile = page.getByRole("button", { name: new RegExp(label) });
  const text = await tile.innerText();
  return Number((text.match(/\d+/) ?? ["0"])[0]);
}

test("control-room: buckets must sum to the unfinished total", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  await expect(page.getByText("Needs your attention")).toBeVisible();
  const counts = await Promise.all(LABELS.map((l) => tileCount(page, l)));
  const sum = counts.reduce((a, b) => a + b, 0);
  const shown = Number((await page.getByTestId("row-count").innerText()).match(/\d+/)![0]);
  expect(sum, "buckets must sum to the unfinished total").toBe(shown);
});

test("control-room: published work is hidden until asked for", async ({ page }) => {
  await loginAs(page, PERSONAS.sean);
  const before = Number((await page.getByTestId("row-count").innerText()).match(/\d+/)![0]);
  await page.getByRole("button", { name: /Show published/ }).click();
  const after = Number((await page.getByTestId("row-count").innerText()).match(/\d+/)![0]);
  expect(after).toBeGreaterThan(before);
});
