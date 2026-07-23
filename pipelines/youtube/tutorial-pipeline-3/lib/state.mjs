export const STAGES = ["generated", "verified", "polished", "tts", "locked", "recorded", "qc-passed"];

// Returns a NEW section object; never mutates the input.
export function applyTextEdit(section, { display_text, spoken_text }) {
  const hasDisplayChange = display_text !== undefined && display_text !== section.display_text;
  const hasSpokenChange = spoken_text !== undefined && spoken_text !== section.spoken_text;

  if (!hasDisplayChange && !hasSpokenChange) {
    return section;
  }

  const newSection = {
    ...section,
    version: section.version + 1,
    display_text: display_text !== undefined ? display_text : section.display_text,
    spoken_text: spoken_text !== undefined ? spoken_text : section.spoken_text,
    tts: {
      regens_used: 0,
      locked: false,
      take: null
    }
  };

  let newStatus = section.recording.status;
  if (section.demo) {
    if (section.recording.status === "received" || section.recording.status === "qc-passed") {
      newStatus = "re-record";
    } else {
      newStatus = "pending";
    }
  } else {
    newStatus = "none";
  }

  newSection.recording = {
    ...section.recording,
    status: newStatus
  };

  return newSection;
}

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

// Returns { ok, errors: string[] } for a proposed stage move on a whole script obj.
export function checkStageMove(script, toStage) {
  const currentIndex = STAGES.indexOf(script.stage);
  const targetIndex = STAGES.indexOf(toStage);

  if (targetIndex === -1) {
    return { ok: false, errors: [`Invalid target stage: ${toStage}`] };
  }

  if (targetIndex !== currentIndex + 1) {
    return { ok: false, errors: [`Cannot move stage from ${script.stage} to ${toStage}`] };
  }

  const errors = [];
  
  if (toStage === "locked") {
    for (const sec of script.sections) {
      if (!sec.tts || !sec.tts.locked) {
        errors.push(`Section ${sec.id} is not locked`);
      }
    }
  }

  if (toStage === "recorded") {
    for (const sec of script.sections) {
      if (sec.demo) {
        if (sec.recording.status !== "received" && sec.recording.status !== "qc-passed") {
          errors.push(`Demo section ${sec.id} recording status is not received/qc-passed`);
        }
      }
    }
  }

  if (toStage === "qc-passed") {
    for (const sec of script.sections) {
      if (sec.demo) {
        if (sec.recording.status !== "qc-passed") {
          errors.push(`Demo section ${sec.id} recording status is not qc-passed`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [] };
}
