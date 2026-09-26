import assert from "node:assert/strict";
import test from "node:test";
import { expenseBody, missing, pickMembers, splitEqual } from "./lib.mjs";

test("equal split adds up to the paisa", () => {
  assert.deepEqual(splitEqual(10000, 3), [3334, 3333, 3333]);
  assert.equal(splitEqual(99999, 7).reduce((a, b) => a + b), 99999);
});

test("expense body: payer pays all, shares owed equally", () => {
  const b = expenseBody({ cost: "100", desc: "Milk", date: "2026-09-10", groupId: 5, currency: "INR", payer: 1, members: [1, 2, 3] });
  assert.equal(b.cost, "100.00");
  assert.equal(b.date, "2026-09-10T12:00:00Z");
  assert.deepEqual([b.users__0__paid_share, b.users__1__paid_share, b.users__2__paid_share], ["100.00", "0.00", "0.00"]);
  assert.deepEqual([b.users__0__owed_share, b.users__1__owed_share, b.users__2__owed_share], ["33.34", "33.33", "33.33"]);
});

test("payer is added to the split when --with leaves them out", () => {
  const b = expenseBody({ cost: 50, desc: "x", groupId: 5, currency: "INR", payer: 1, members: [2] });
  assert.equal(b.users__0__user_id, 1);
  assert.equal(b.users__1__owed_share, "25.00");
});

test("members by first name, full name or email; ambiguity refused", () => {
  const ms = [{ id: 1, first_name: "Anusha", last_name: "T" }, { id: 2, first_name: "Rahul", email: "r@x.in" }, { id: 3, first_name: "Rahul", last_name: "K" }];
  assert.deepEqual(pickMembers(ms, ["anusha", "Rahul K", "r@x.in"]), [1, 3, 2]);
  assert.throws(() => pickMembers(ms, ["rahul"]), /matches 2/);
});

test("missing: same cost within 3 days counts as on Splitwise, once", () => {
  const pays = [{ date: "2026-09-10", amount: -500 }, { date: "2026-09-11", amount: -500 }, { date: "2026-09-20", amount: -120.5 }];
  const exps = [{ date: "2026-09-12T10:00:00Z", cost: "500.0" }, { date: "2026-09-01T00:00:00Z", cost: "120.50" },
    { date: "2026-09-20T00:00:00Z", cost: "999", deleted_at: "x" }];
  assert.deepEqual(missing(pays, exps).map((p) => p.date), ["2026-09-11", "2026-09-20"]);
});
