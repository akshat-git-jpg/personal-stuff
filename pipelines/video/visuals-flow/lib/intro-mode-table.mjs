// Leaf module: imports nothing. Exists only to break the cycle between
// lib/intro-modes.mjs (which calls loadRunConfig from lib/run-config.mjs) and
// lib/run-config.mjs (which derives its accepted enum from this table) — both
// import the table from here instead of from each other.
//
// Every intro flow the pipeline supports, declared. Adding a flow is a row
// here plus its own step folders — NOT a hunt through consumers. See
// lib/intro-modes.mjs for why this table replaced an identity check.
//
//   ownsIntroSpan  the flow renders the intro itself, so the cue passes must
//                  stand down over the intro span: zones drop "intro", E13
//                  (open-cover) is suppressed, E23 (link-scrim) is enabled.
//   spanFrom       where the owned span comes from, or null when it owns nothing.
export const INTRO_MODES = {
  cards: {
    label: 'catalog cards',
    ownsIntroSpan: false,
    spanFrom: null,
  },
  film: {
    label: 'bespoke intro film',
    ownsIntroSpan: true,
    spanFrom: 'segments.structure.intro',
  },
};

export const INTRO_MODE_NAMES = Object.keys(INTRO_MODES);
