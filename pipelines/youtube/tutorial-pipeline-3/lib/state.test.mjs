import test from "node:test";
import assert from "node:assert";
import { applyTextEdit, lockSection, checkStageMove } from "./state.mjs";

test("applyTextEdit - edit on a locked+recorded demo section", () => {
  const input = {
    id: "s01",
    version: 1,
    demo: true,
    display_text: "old",
    spoken_text: "old",
    tts: { locked: true, regens_used: 2, take: "t1" },
    recording: { status: "qc-passed" }
  };
  const originalInput = JSON.parse(JSON.stringify(input));

  const result = applyTextEdit(input, { display_text: "new" });

  assert.deepEqual(input, originalInput, "input must not be mutated");
  assert.equal(result.version, 2);
  assert.equal(result.display_text, "new");
  assert.equal(result.tts.locked, false);
  assert.equal(result.tts.regens_used, 0);
  assert.equal(result.tts.take, null);
  assert.equal(result.recording.status, "re-record");
});

test("applyTextEdit - edit on a never-recorded demo section", () => {
  const input = {
    id: "s02",
    version: 1,
    demo: true,
    display_text: "old",
    spoken_text: "old",
    tts: { locked: true, regens_used: 1, take: "t1" },
    recording: { status: "pending" }
  };
  
  const result = applyTextEdit(input, { display_text: "new" });
  assert.equal(result.version, 2);
  assert.equal(result.recording.status, "pending");
});

test("applyTextEdit - edit on non-demo section", () => {
  const input = {
    id: "s03",
    version: 1,
    demo: false,
    display_text: "old",
    spoken_text: "old",
    tts: { locked: false, regens_used: 0, take: null },
    recording: { status: "none" }
  };
  
  const result = applyTextEdit(input, { spoken_text: "new" });
  assert.equal(result.version, 2);
  assert.equal(result.recording.status, "none");
});

test("lockSection - throws with flags", () => {
  const input = {
    id: "s01",
    flags: [{ kind: "VERIFY", note: "foo" }],
    spoken_text: "text",
    tts: { take: "t1", locked: false }
  };
  assert.throws(() => lockSection(input), /Cannot lock section with remaining flags/);
});

test("lockSection - throws with empty spoken_text", () => {
  const input = {
    id: "s01",
    flags: [],
    spoken_text: "",
    tts: { take: "t1", locked: false }
  };
  assert.throws(() => lockSection(input), /Cannot lock section with empty spoken_text/);
});

test("lockSection - throws with null take", () => {
  const input = {
    id: "s01",
    flags: [],
    spoken_text: "text",
    tts: { take: null, locked: false }
  };
  assert.throws(() => lockSection(input), /Cannot lock section with null take/);
});

test("lockSection - valid lock", () => {
  const input = {
    id: "s01",
    flags: [],
    spoken_text: "text",
    tts: { take: "t1", locked: false }
  };
  const originalInput = JSON.parse(JSON.stringify(input));
  
  const result = lockSection(input);
  assert.deepEqual(input, originalInput, "input must not be mutated");
  assert.equal(result.tts.locked, true);
});

test("checkStageMove - skipping a stage", () => {
  const script = { stage: "generated" };
  const res = checkStageMove(script, "polished");
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /Cannot move stage from generated to polished/);
});

test("checkStageMove - locked requires all sections locked", () => {
  const script = {
    stage: "tts",
    sections: [
      { id: "s01", tts: { locked: true } },
      { id: "s02", tts: { locked: false } }
    ]
  };
  const res = checkStageMove(script, "locked");
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /Section s02 is not locked/);
});

test("checkStageMove - happy path per gate", () => {
  const script1 = {
    stage: "tts",
    sections: [
      { id: "s01", tts: { locked: true } }
    ]
  };
  assert.equal(checkStageMove(script1, "locked").ok, true);

  const script2 = {
    stage: "locked",
    sections: [
      { id: "s01", demo: false },
      { id: "s02", demo: true, recording: { status: "received" } }
    ]
  };
  assert.equal(checkStageMove(script2, "recorded").ok, true);

  const script3 = {
    stage: "recorded",
    sections: [
      { id: "s01", demo: false },
      { id: "s02", demo: true, recording: { status: "qc-passed" } }
    ]
  };
  assert.equal(checkStageMove(script3, "qc-passed").ok, true);
});
