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
      '- FIRST scan the `enacted/` family (and other cards whose `intent` matches) for a device that DOES the clause; only when none fits may a legacy reveal/text card be used, and then the cue must carry `"legacy_why": "<one line>"`.\n' +
      '- Narration makes a claim, lists items, or states numbers and the screen does not show it → fullframe canvas beat (`slate/headline-chips`, `comparison/table-rows`, section slates). The screen already shows what is spoken → no graphic.\n' +
      '- Enumerating pros/cons -> pros-cons; ordered list OR a sentence enumerating 3+ comma-separated items -> checklist/icon-pills or bullet-points (one beat per item — never a single text slate); feature-by-feature comparison -> feature-matrix or summary-table; final judgment -> a verdict card; opening a section -> a section/title card; one reinforced claim -> an overlay card.\n' +
      'Bespoke escalation moves earlier: when the audit WOULD call it labelled (apply the mute test yourself while authoring) and no device fits, set `flagged: true` immediately with a `fix`-style note — do not place a filler text card. Choosing between cards: read each candidate\'s intent / anti_intent lines; an anti_intent match is a hard veto. PROPOSE A NEW CARD (mandatory): when no existing card enacts the clause, the answer is a NEW TEMPLATE, not the nearest existing one. Name the card you would build and give a one-line spec of what it DOES, in the cue\'s `fix` note. Never settle for a weaker existing card and never accept "labelled" as the outcome just because the catalog is short — the library is meant to grow with the videos.',
    why: 'owner fold 2026-07-24 — test-01 first v2 run produced 18/19 legacy cards and audit ignored them; propose-a-new-card clause added 2026-07-25 (owner, test-03: "I don\'t think you are ever proposing the new templates which we should be making. You are always trying to use existing templates") — the same run had accepted a labelled fullframe with the note "no enacted device fits", which is precisely the moment a new card should have been proposed',
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
    rule: 'Kinetic-sentence interstitial (mandatory): for a bridge with no footage, UI, or data worth showing and a single spoken point, use `slate/kinetic-sentence` instead of leaving it on camera — a frequent choice, drawn from the same fullframe cadence above, not an extra quota (`statement/keyword-statement` is a close sibling for the same job). A sentence that ENUMERATES 3+ items (comma-separated list, "such as X, Y, Z") is NOT a kinetic-sentence job — route it to a list card (`checklist/icon-pills`, `checklist/bullet-points`) with one beat per item. `variables.text` is the voiceover verbatim, one sentence, <=18 words, `beats: []` — paraphrasing fails resolution at step 030; split long sentences into two consecutive cues instead. `variables.accent` is the 2-4 verbatim, contiguous words carrying the sentence\'s point (the consequence or substance, e.g. "burns credits", "cool technical features" — not a brand name or number picked for salience). Anchor at the sentence\'s own opening words. The sentence must carry SUBSTANCE — a claim, a consequence, a number, a judgment. A navigational phrase ("So let\'s talk about the good ones first", "Now let\'s look at pricing", "First up", "Moving on") is NOT a kinetic-sentence job: it says nothing, and it takes the whole frame away from footage to say it. Route the transition to a section card, or place no cue at all. Enforced as lint error E11. Test: if you cannot pick an `accent` that states the point, there is no point, so there is no card.',
    why: 'enumeration clause: owner fold 2026-07-24, test-01 Final Cut :5 ("comma separated things would have best suited for some list type motion graphic instead of this text type"); filler clause: owner fold 2026-07-24, test-01 v2 Final Cut :11 ("what is the criteria ... this was not at all a appropriate time" — c19 showed "So let\'s talk about the good ones first"); rest predates the fold log',
  },
  R_COPY: {
    rule: 'On-card copy style (mandatory): headings/titles read like real video headings — Title Case, no comma-appositive constructions ("5 AI Video Tools, Compared" is wrong; "Top 5 AI Video Tools Comparison" is right). NEVER an em dash or en dash in ANY rendered text (title, label, subtitle, reveal, context) — it reads as machine-written; use ":", "·", or plain words instead. Enforced as lint error E10.',
    why: 'owner fold 2026-07-24, test-01 v2 Final Cut :0/:1 — "not such comma separation, doesn\'t look like heading" / "never use em dashes, this indicates AI text. Please have a long term learning"',
  },
  R_OVERLAY_ON_FOOTAGE: {
    rule: 'Overlays sit on FOOTAGE only (mandatory): an overlay cue must never overlap a fullframe card\'s on-screen span (including its extended exposure hold) — two graphics stacked on each other read as an editing bug. Anchor the overlay where screen/avatar footage is visible, or fold its content into the fullframe card itself. Enforced as lint error E9.',
    why: 'owner fold 2026-07-24, test-01 Final Cut :2/:10 — callouts rendered on top of the title card and a tool-intro card',
  },
  R_STRUCTURAL: {
    rule: 'Structural consistency (mandatory): a repeated semantic slot — e.g. the section opener for each compared tool — uses the SAME card every time; mixing cards across parallel items is a defect, not variety. Structural cards (catalog `structural: true`) are exempt from the repetition cap.',
    why: 'owner fold 2026-07-18 — v2 swapped two of five tool openers to different section cards to dodge the repetition cap',
  },
  R_REPETITION: {
    rule: "Repetition cap (non-structural cards): follow the caps above — for overlay/stat-hit, keep only the numbers the VO leans on most and drop the least impressive rather than exceed the cap. Other overlays: vary the corner (pos) and variant when repeating.",
    why: 'unattributed — predates the fold log; callout reference replaced by keyword-pop (owner removed callout 2026-07-24), then keyword-pop itself removed 2026-07-25 (owner v2:7)',
  },
  R_DEMOS: {
    rule: 'Demos & step narration (mandatory): do NOT lay a redundant graphic over a click the screen already shows — no `process/step-flow` re-labeling visible steps (step-flow is only for processes NOT on screen). During a demo/playback stretch only `placement: overlay` cards may be used (this is enforced via lint E5). But do NOT leave a long demo stretch bare either: punctuate it with the SPOKEN layer — `overlay/lower-third`, `overlay/tip-banner`, `overlay/stat-hit`, or `overlay/verdict-chips`. Test: echoes the click → skip; adds the narration\'s point/label → keep. There is deliberately NO generic "word pill" card: the owner removed callout, arrow-label and keyword-pop in turn and asked for no replacement, so a demo stretch with nothing specific to say stays bare rather than getting a decorative label.',
    why: 'owner fold 2026-07-18, test-01 c06/c09/c15; callout replaced by keyword-pop 2026-07-24; arrow-label removed same day (owner template note); keyword-pop itself removed 2026-07-25 (owner v2:7, "no need to have this or alternative") — the no-generic-pill clause records that this was a THIRD rejection of the same idea, not a one-off',
  },
  R_PRICING: {
    rule: 'Pricing (mandatory): no per-tool pricing/credits graphics during tool segments (the pricing page is on screen); consolidate into ONE pricing comparison graphic in the final comparison section. When the `comparison/table-rows` card is used, do NOT also emit stat-hit cues for the same numbers.',
    why: 'owner fold 2026-07-18, test-01 c20–c24',
  },
  R_COLD_OPEN_TITLE: {
    rule: 'Cold open (mandatory for comparison videos): open on a card whose catalog `roles` include `comparison-coldopen`, with the compared products supplied as `platforms` entries carrying their logo slugs — never a text-only title. When two products are compared, prefer `title/title-versus`: it renders both logos at hero size with a VS between them, which is what a versus video promises in its first seconds. The other `comparison-coldopen` cards lead with the title and reduce the products to chips — use them only when there are more than four products, or no logo exists for a product.',
    why: 'owner fold 2026-07-20 (test-02 c01); routing generalized to catalog roles + title/title-versus, plan 119',
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
  R_OPENING: {
    rule: 'The opening must breathe (mandatory): the presenter must be visible within the first 15s — do NOT cover the opening with back-to-back fullframe cards, and never let a fullframe card hold the screen past 12s with no beats. A card with no beats is a still image: if the point needs 20 seconds of screen time it needs beats or two cues, not one long hold. When the VO is doing the work and there is nothing to enact, place NO card and leave the presenter on screen. Enforced as lint warnings W12 (opening-host-coverage) and W13 (frozen-fullframe).',
    why: 'owner 2026-07-28, test-03: the first 53s were three back-to-back fullframe cards and the host first appeared at 0:54; measured mean frame-to-frame delta was 0.01 (a still image) for 20 consecutive seconds inside c02, which carried beats: [] across a 24.3s hold. The intro is the part of a tutorial that decides whether anyone watches the rest, and it was the least directed stretch in the video',
  },
  R_ZONES: {
    rule: 'Intro and conclusion carry the most weight (mandatory): the video structure block names the exact intro, body and conclusion spans, measured from the source files. Author the intro and the conclusion FIRST and give them your strongest devices — an enacted card that DOES the point beats a text slate everywhere, and it matters most here, because the opening decides whether anyone stays and the conclusion is the payoff the opening promised. Neither zone may be left without graphics. There is deliberately NO required structure for either: what an intro needs is a judgment call about THIS script, not a checklist to fill. Do not add a card to a zone because a slot exists; add it because the narration gives you something to enact.',
    why: 'owner 2026-07-28: "Intro and Conclusion are most important and I want best quality there" — and, on encoding a required intro formula, "its subjective. Pls dont make this hardcoded". test-03 measured 0.01 mean frame delta (a still image) for 20 consecutive seconds inside the intro, with the presenter first visible at 0:54; its conclusion was never cut at all',
  },
  R_LINK_CTA: {
    rule: 'Link CTA (mandatory): EVERY time the VO points the viewer to the description — "link/links in the description", "check the description", "linked below" — emit a CTA cue anchored at that phrase. Never leave a description mention uncovered. Which card is positional, not a judgment call: the FIRST mention in the video uses `link-in-description/link-scrim` (full-frame dim scrim — it takes the whole screen once, when the ask is new and deserves it); EVERY later mention uses `link-in-description/link-in-description` (transparent pill overlay), which rides on footage and never hides a demo. Use the scrim exactly once per video. Count mentions across the WHOLE script including the conclusion, not just the stretch you are cueing.',
    why: 'owner fold 2026-07-27, test-03 final-v3:0 ("Pls add cta for link in description whenever mentioned. For first time mention you can use link scrim one template, for rest we can use link in description green card template"). The v2 fold placed ONE scrim cue by hand as an instance fix and nothing generalized it, so of the three description mentions in test-03 the second got no card at all and the third sits in a conclusion that has never been cut — the recurring "fixed on one surface, never taught to the next" shape',
  },
};
