/**
 * Chart colours.
 *
 * Validated with the dataviz skill's six-checks validator against this app's
 * card surface (#181310) in dark mode. Do not add hues without re-running it:
 * `node scripts/validate_palette.js "<hex,...>" --mode dark --pairs adjacent`.
 *
 * Slot 7 is green rather than the palette's red on purpose — the whole red end
 * belongs to Untraced, so a red slice on this chart always means "money we
 * cannot name".
 */
export const TOOL_HUES = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#9085e9", // violet
  "#008300", // green
];

/** Tools past the seventh fold into this. Neutral, so it never competes. */
export const OTHER_HUE = "rgba(255,240,224,0.30)";

/**
 * Dark red, 3.28:1 on the card surface. On hue alone it sits ΔE 9.6 from the
 * orange tool slot — under the safe floor of 15 — so the diagonal hatch is
 * load-bearing, not decoration. It is what keeps the two unmistakable, and it
 * survives printing and colour-blindness.
 */
export const UNTRACED_HUE = "#c62828";

/** How each hop in a route is tinted, so the table and chart agree. */
export const HOP_HUE: Record<string, string> = {
  PayPal: "#3987e5",
  PartnerStack: "#199e70",
  "impact.com": "#c98500",
  PayKickstart: "#d55181",
  Airwallex: "#d95926",
};

/** Confidence shown to the reader. `exact` is the silent default. */
export const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "confirmed",
  exact: "",
  grouped: "batch",
  matched: "matched",
  inferred: "inferred",
};
