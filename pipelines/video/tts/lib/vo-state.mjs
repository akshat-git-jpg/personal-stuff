// The VO half of tp3's old state.mjs, moved to the hub (plan 251).
// Only this function moved: it reads `flags`, `spoken_text` and `tts.take`,
// all of which are voiceover fields. `applyTextEdit`, `checkStageMove` and
// `STAGES` stayed in tp3 because they read `section.demo` and
// `section.recording` — that is tp3's recording model, not a VO concern.

// Throws Error with a message naming the failed precondition; else returns new section.
export function lockSection(section) {
  if (section.flags && section.flags.length > 0) {
    throw new Error("Cannot lock section with remaining flags");
  }
  if (!section.spoken_text) {
    throw new Error("Cannot lock section with empty spoken_text");
  }
  if (section.tts.take === null) {
    throw new Error("Cannot lock section with null take");
  }

  return {
    ...section,
    tts: {
      ...section.tts,
      locked: true
    }
  };
}
