// Single source of truth for cue-pass ROUTING rules (which card fires when,
// and how cards relate to each other). Numbers live in lib/cue-constants.mjs;
// per-card "fire me when X" lives on the card's catalog.json entry.
// lib/build-prompt.mjs renders these into steps/020-cue-pass-llm/cue-pass-prompt.md;
// lib/check-rulebook.mjs fails if RULEBOOK.md restates one instead of citing it.
// Never restate a rule in prose — add it here and regenerate.
export const CUE_RULES = {
  R_DENSITY: {
    rule: 'Density (defaults — follow the script when it disagrees). Keep the video visually active: motion graphics are a near-constant presence, not a rare garnish. A graphic still must ADD something (structure, a number/list, a comparison, or the spoken POINT of a bridge) — but "the footage shows it" is not a licence to leave a long stretch bare.',
    why: 'owner recalibration 2026-07-21 — earlier videos had multi-minute bare stretches',
  },
  R_NO_OVERLAP: {
    rule: 'Never two overlapping fullframe cues.',
    why: 'unattributed — predates the fold log',
  },
  R_COLD_OPEN_ZONE: {
    rule: 'Cold-open beat allowed in the first 15s (this zone stays sparse — W6 does not police it).',
    why: 'unattributed — predates the fold log',
  },
  R_CHOOSING: {
    rule: 'Choosing a card — route by what the VO is doing, matching catalog `purpose` lines:\n' +
      '- Narration makes a claim, lists items, or states numbers and the screen does not show it → fullframe canvas beat (`slate/headline-chips`, `comparison/table-rows`, section slates). The screen already shows what is spoken → no graphic.\n' +
      '- Enumerating pros/cons -> pros-cons; ordered list -> checklist or bullet-points; feature-by-feature comparison -> feature-matrix or summary-table; final judgment -> a verdict card; opening a section -> a section/title card; one reinforced claim -> an overlay card.\n' +
      'If nothing fits, set `flagged: true`, `card` to the closest slug, and add a `note` field explaining the gap — never force a bad match.',
    why: 'unattributed — predates the fold log',
  },
  R_SPECIFICITY: {
    rule: 'Specificity wins (mandatory): big number -> overlay/stat-hit; plan/credit economics too dense to say -> comparison/credits-math; step walkthrough NOT shown on screen -> process/step-flow; who-should-buy-what payoff -> verdict/persona-match.',
    why: 'unattributed — predates the fold log',
  },
  R_RESULT_REVIEW: {
    rule: 'Result-review overlays:\n' +
      "- VO judges a result while footage shows it (a pro or con is spoken) → `overlay/verdict-chips`, one beat per spoken judgment, ≤4.\n" +
      "- VO announces a rating or score ('gets a 9.5 out of 10') → `overlay/score-pill` at the spoken score; `winner:true` only for a final-verdict winner.\n" +
      '- VO walks per-product numbers (price/specs) across 3+ products → `comparison/table-rows`, one beat per product row, cells pipe-separated, anchor each beat at that product\'s first spoken number.\n' +
      '- VO states a claim then lists items under it → `slate/headline-chips`: headline = the claim, one chip beat per listed item.',
    why: 'unattributed — predates the fold log',
  },
  R_KINETIC: {
    rule: 'Kinetic-sentence interstitial (mandatory): for a bridge with no footage, UI, or data worth showing and a single spoken point, use `slate/kinetic-sentence` instead of leaving it on camera — a frequent choice, drawn from the same fullframe cadence above, not an extra quota (`statement/keyword-statement` is a close sibling for the same job). `variables.text` is the voiceover verbatim, one sentence, <=18 words, `beats: []` — paraphrasing fails resolution at step 030; split long sentences into two consecutive cues instead. `variables.accent` is the 2-4 verbatim, contiguous words carrying the sentence\'s point (the consequence or substance, e.g. "burns credits", "cool technical features" — not a brand name or number picked for salience). Anchor at the sentence\'s own opening words.',
    why: 'unattributed — predates the fold log',
  },
  R_STRUCTURAL: {
    rule: 'Structural consistency (mandatory): a repeated semantic slot — e.g. the section opener for each compared tool — uses the SAME card every time; mixing cards across parallel items is a defect, not variety. Structural cards (catalog `structural: true`) are exempt from the repetition cap.',
    why: 'owner fold 2026-07-18 — v2 swapped two of five tool openers to different section cards to dodge the repetition cap',
  },
  R_REPETITION: {
    rule: "Repetition cap (non-structural cards): follow the caps above — for overlay/stat-hit, keep only the numbers the VO leans on most and drop the least impressive rather than exceed the cap. Other overlays: vary callout's style and position when repeating.",
    why: 'unattributed — predates the fold log',
  },
  R_DEMOS: {
    rule: 'Demos & step narration (mandatory): do NOT lay a redundant graphic over a click the screen already shows — no `process/step-flow` re-labeling visible steps (step-flow is only for processes NOT on screen). During a demo/playback stretch only `placement: overlay` cards may be used (this is enforced via lint E5). But do NOT leave a long demo stretch bare either: punctuate it with the SPOKEN layer — `overlay/callout`, `overlay/lower-third`, `overlay/tip-banner`, `overlay/stat-hit`, or `overlay/verdict-chips`. Test: echoes the click → skip; adds the narration\'s point/label → keep.',
    why: 'owner fold 2026-07-18, test-01 c06/c09/c15',
  },
  R_PRICING: {
    rule: 'Pricing (mandatory): no per-tool pricing/credits graphics during tool segments (the pricing page is on screen); consolidate into ONE pricing comparison graphic in the final comparison section. When the `comparison/table-rows` card is used, do NOT also emit stat-hit cues for the same numbers.',
    why: 'owner fold 2026-07-18, test-01 c20–c24',
  },
  R_COLD_OPEN_TITLE: {
    rule: 'Cold open (mandatory for comparison videos): the intro title card makes the compared products the VISUAL hero — `title/title-aurora-wave` with `platforms` logo chips, never a text-only title.',
    why: 'owner fold 2026-07-20, test-02 c01',
  },
  R_VERDICTS: {
    rule: 'Verdicts (mandatory): one winner per verdict card. Two favorites = two verdict cards back to back, each anchored at its own "X was the best" phrase.',
    why: 'owner fold 2026-07-20, test-02 c32',
  },
  R_UNITS: {
    rule: 'Units (mandatory): numeric values on cards carry their unit (prefix "$", suffix "ms"/"/mo") — never a bare number.',
    why: 'owner fold 2026-07-20, test-02 c24',
  },
  R_NO_IDLE: {
    rule: 'Beat cards must not idle: anchor so the FIRST beat lands within ~8s of the card appearing — when the VO rambles before its first data point, anchor at the sentence right before the first beat, not the section opener.',
    why: 'owner fold 2026-07-20, test-02 c29 — 18.9s of empty table scaffold',
  },
};
