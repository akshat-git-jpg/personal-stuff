/**
 * Chart colours.
 *
 * Both sets were run through the dataviz skill's six-checks validator against
 * this app's own card surface, and both pass all six. Do not swap a hue without
 * re-running it — two of these took several attempts to get past the CVD and
 * normal-vision separation checks:
 *
 *   node scripts/validate_palette.js "<hex,...>" --mode dark  --surface "#161a24"
 *   node scripts/validate_palette.js "<hex,...>" --mode light --surface "#fbfaf7"
 *
 * Income is deliberately NOT in this list. It is the whole, not one of the
 * parts, so it wears ink — and an earlier draft that gave income a categorical
 * green produced a legend with two identical swatches (income and Rent).
 */
export const HUES = [
  "var(--c5)", // pink
  "var(--c2)", // orange
  "var(--c4)", // gold
  "var(--c6)", // violet
  "var(--c3)", // green
  "var(--c1)", // blue
];

/**
 * Where categories go once the hues run out. Six is about the limit a reader can
 * hold apart at a glance; past that, colour stops carrying meaning and starts
 * being decoration that lies.
 *
 * The fold is by VALUE and recomputed on every render, so a category that grows
 * promotes itself into a real colour with no code change. The ranked list below
 * the chart never folds — every category is always named there.
 */
export const FOLD = "var(--fold)";

/** Money with no category yet. Hatched, never a flat colour: a colour would
 *  imply it belongs somewhere. It also survives printing and colour-blindness. */
export const HATCH_CSS =
  "repeating-linear-gradient(45deg,var(--alarm) 0 5px," +
  "color-mix(in srgb,var(--alarm) 40%,var(--card)) 5px 10px)";

/** Longest-running categories first, so colour stays put as months change. */
export const ORDER = [
  "to_mummy", "credit_card", "education_loan", "unnamed", "education",
  "rent", "travel", "cook", "food", "health", "shopping", "recharge",
];
