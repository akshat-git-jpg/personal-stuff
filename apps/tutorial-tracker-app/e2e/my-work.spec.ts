import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// The two fixtures these lean on are seeded in scripts/seed-local.ts:
//   "Two of my stages — editing now, thumbnail after"  → John owns Editing + Thumbnail
//   "Waiting on someone else's edit"                   → Tara owns only the gated Thumbnail
// Run `npm run seed:local` first.
//
// Every job that is a person's turn is on screen — the first as a full card, the
// rest as quiet rows — so no fixture needs a fold opened to be reachable.

const DUAL = "Two of my stages — editing now, thumbnail after";

test("a video you own twice is listed once, with its later stage noted", async ({ page }) => {
  await loginAs(page, PERSONAS.john);
  // Not once per stage — the gated Thumbnail folds into the live Editing card.
  await expect(page.getByText(DUAL, { exact: true })).toHaveCount(1);
  // The "Then yours: …" foot-note rides the lead card only, so for a quiet row
  // the later stage is named in its detail instead.
  await page.getByText(DUAL, { exact: true }).click();
  const dialog = page.getByRole("dialog");
  const yourPart = dialog.getByTestId("card-detail-your-part");
  await expect(yourPart.getByText("Editing", { exact: true })).toBeVisible();
  await expect(yourPart.getByText("Thumbnail", { exact: true })).toBeVisible();
});

test("a doer sees the upstream deliverable it works from", async ({ page }) => {
  await loginAs(page, PERSONAS.john);
  await page.getByText(DUAL, { exact: true }).click();
  const dialog = page.getByRole("dialog");
  // The recording the editor must actually open — this used to be withheld.
  await expect(dialog.getByText("Recording link")).toBeVisible();
  await expect(dialog.getByText("https://drive.example.com/screen-recording-raw")).toBeVisible();
  // …alongside the brief, the routing note, the ETA and its own deliverable.
  await expect(dialog.getByText("Notes / brief")).toBeVisible();
  await expect(dialog.getByText("Editing instructions")).toBeVisible();
  await expect(dialog.getByText("Editing ETA")).toBeVisible();
  await expect(dialog.getByText("Final video link")).toBeVisible();
});

test("a not-yet-started stage still shows every field, read-only", async ({ page }) => {
  await loginAs(page, PERSONAS.tara);
  // test-standard-thumbnail-to-do: To Do used to hide the deliverable slot.
  await page.getByText("test-standard-thumbnail-to-do", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Final video link")).toBeVisible();  // upstream: what it makes a thumb for
  await expect(dialog.getByText("Thumbnail instructions")).toBeVisible();
  await expect(dialog.getByText("Thumbnail link")).toBeVisible();
});
