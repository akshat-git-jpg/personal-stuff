import { test, expect } from "@playwright/test";
import { loginAs, PERSONAS } from "./helpers";

// The doer's side of the review conversation. Seeded by scripts/seed-local.ts:
//   test-standard-editing-need-changes → John edits, Riya reviews, already sent
//   back once ("test feedback: tighten the intro") with its deliverable filled.
// A throwaway fixture on purpose: this file MOVES the card, so it must not be
// one the other specs assert a status on. Run `npm run seed:local` first.

const CARD = "test-standard-editing-need-changes";
const NOTE = "Re-cut the intro and dropped the dead air at 0:12.";

// Serial: the reviewer can only read the note after the doer has sent it.
test.describe.serial("submit note", () => {
  test("a resubmit cannot leave without a note", async ({ page }) => {
    await loginAs(page, PERSONAS.john);
    await page.getByText(CARD, { exact: true }).click();

    const dialog = page.getByRole("dialog");
    const box = dialog.getByTestId("submit-note-box");
    // The ask is pointed on a resubmit — the reviewer already said what was wrong.
    await expect(box).toBeVisible();
    await expect(box.getByText(/What did you change\?/)).toBeVisible();

    // Empty note, no way through. This is the whole point: work cannot re-enter
    // the queue without a word on what changed.
    const send = dialog.getByTestId("submit-note-send");
    await expect(send).toBeDisabled();

    await dialog.getByTestId("submit-note-input").fill(NOTE);
    await expect(send).toBeEnabled();
    await send.click();

    // The panel closes on a successful move, and the card leaves his turn.
    await expect(dialog).toBeHidden();
    const mine = page.locator("section", { hasText: "Your turn" }).first();
    await expect(mine.getByText(CARD, { exact: true })).toHaveCount(0);
  });

  test("the reviewer reads the note on the queue row, without opening anything", async ({ page }) => {
    await loginAs(page, PERSONAS.riya);
    const queue = page.locator("section", { hasText: "Needs your review" }).first();
    const row = queue.locator("article", { hasText: CARD }).first();
    await expect(row).toBeVisible();
    // Approve is one click on this row, so the note has to be legible from here.
    await expect(row.getByTestId("queue-submit-note")).toHaveText(NOTE);
  });

  test("the activity feed calls a submit a submit, and carries the note", async ({ page }) => {
    await loginAs(page, PERSONAS.riya);
    await page.getByText(CARD, { exact: true }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Activity/ }).click();
    const feed = dialog.getByTestId("activity-feed");

    // The event type used to be mis-derived: a lowercased stored status never
    // matched the lifecycle's cased names, so every doer move logged as
    // "complete" and the feed said "completed" for a submit.
    await expect(feed.getByText(/submitted for review/).first()).toBeVisible();
    await expect(feed.getByTestId("activity-submit-note").last()).toHaveText(NOTE);
  });
});

// The UI disables the button, but a disabled button is not a rule. These drive
// the API directly, as a hand-rolled request would, to pin the server gate.
test.describe("the server is the gate, not the button", () => {
  // Sam's script fixture — a different card, so it never races the block above.
  const SCRIPT_CARD = "test-standard-script-need-changes";

  async function rowIdOf(page: import("@playwright/test").Page, title: string) {
    const board = await (await page.request.get("/api/board")).json();
    const row = board.rows.find((r: Record<string, string>) => r.video_title === title);
    expect(row, `fixture ${title} is missing — reseed with npm run seed:local`).toBeTruthy();
    return row.row_id as string;
  }

  test("a submit with no note is refused", async ({ page }) => {
    await loginAs(page, PERSONAS.sam);
    const row_id = await rowIdOf(page, SCRIPT_CARD);

    for (const note of [undefined, "", "   "]) {
      const res = await page.request.post("/api/submit", { data: { row_id, stage: "script", note } });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("note_required");
    }
  });

  test("the plain status endpoint cannot be used to slip past the note", async ({ page }) => {
    await loginAs(page, PERSONAS.sam);
    const row_id = await rowIdOf(page, SCRIPT_CARD);

    const res = await page.request.post("/api/update", {
      data: { row_id, col: "script_status", value: "In Review", prev: "Need Changes" },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("note_required");
  });

  test("someone else's card is refused even with a note", async ({ page }) => {
    await loginAs(page, PERSONAS.tara);   // Thumbnail Maker, not the scriptwriter
    const sam = await page.request.post("/api/submit", {
      data: { row_id: "r1", stage: "script", note: "let me in" },
    });
    expect([403, 404, 409]).toContain(sam.status());
  });
});

test("a reviewer's own send-back box is unchanged by the doer's note box", async ({ page }) => {
  // Read-only, and on a fixture no other spec mutates — the demo cards are
  // contended (board.spec sends "Color matching multi-cam footage" back).
  await loginAs(page, PERSONAS.riya);
  await page.getByText("test-standard-recording-in-review", { exact: true }).click();
  const dialog = page.getByRole("dialog");
  // Riya reviews this one, so she gets the send-back textarea. The note box is
  // the DOER's: it must not leak onto the reviewer's side of the same card.
  await expect(dialog.getByText(/say what to change/)).toBeVisible();
  await expect(dialog.getByTestId("submit-note-box")).toHaveCount(0);
});
