// The screenplay is the intro's plan, written and approved BEFORE any HTML.
// One entry per beat, contiguous, covering the whole intro.
export const INTENTS = ['hook', 'turn', 'scope', 'mech', 'stakes', 'tease', 'button'];
export const REGISTERS = ['dark', 'light'];
export const FACE_MODES = ['full', 'panel', 'none'];
export const TRANSITIONS = ['cut', 'flash', 'crossfade', 'dock', 'push'];

// The DEFAULT arc, in order. It is a starting shape, NOT a requirement:
// a screenplay may drop, merge or reorder beats, and must then say why in
// `deviation_reason`. Owner decision 2026-07-28: intro structure is
// subjective and must not be hardcoded.
export const DEFAULT_ARC = ['hook', 'turn', 'scope', 'mech', 'stakes', 'tease', 'button'];

// A beat:
// {
//   id: "b01",                       // unique, ordered
//   intent: "hook",                  // one of INTENTS
//   clause: "5 AI video tools, 5 very different promises",  // EXACT transcript words
//   t_start: 0.0,
//   t_end: 4.2,
//   register: "dark",                // the colour world this beat lives in
//   face: "full",                    // where the presenter is: full-screen, docked panel, or absent
//   stage: "...",                    // prose: what is on screen and what it does
//   carries: null | { from: "b01", object: "tool-tiles", as: "shrunk into a left rail" },
//   transition_out: "flash",
//   deviation_reason: null | "..."   // REQUIRED when the intent order departs from DEFAULT_ARC
// }

// True when `intents` appears in DEFAULT_ARC order (dropping beats is fine,
// reordering or repeating is a deviation).
export function followsDefaultArc(intents) {
  let cursor = -1;
  for (const intent of intents) {
    const at = DEFAULT_ARC.indexOf(intent, cursor + 1);
    if (at === -1) return false;
    cursor = at;
  }
  return true;
}

// Normalise for verbatim matching against the transcript: lowercase, strip
// punctuation, collapse whitespace. The model writes clauses with natural
// punctuation; the transcript has its own. Neither should decide the match.
export function normaliseClause(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
