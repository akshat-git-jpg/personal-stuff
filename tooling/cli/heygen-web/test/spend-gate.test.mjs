import { test } from "node:test";
import assert from "node:assert";
import { spendGate } from "../src/operations/account.mjs";

test("spendGate: Avatar IV is refused without --allow-spend", () => {
  assert.match(spendGate(true, ["--engine", "heygen4"]), /METERED/);
});

test("spendGate: Avatar IV passes with --allow-spend; Avatar III never needs it", () => {
  assert.strictEqual(spendGate(true, ["--allow-spend"]), null);
  assert.strictEqual(spendGate(false, []), null);
});
