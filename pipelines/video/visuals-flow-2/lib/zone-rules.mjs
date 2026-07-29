// Routing rules for the INTRO/CONCLUSION pass (step 035) — the judgment the
// zone pass applies, as distinct from the numbers in lib/zone-constants.mjs.
//
// Mirrors lib/cue-rules.mjs in shape so the two rulebooks stay legible side by
// side, but they are separate on purpose: a lesson folded from an intro review
// changes THIS file and never touches the body's rules, and the reverse
// (owner decision 2026-07-29).
//
// `rule` is what the model is shown. `why` is provenance for the 130 fold and
// is never rendered into the prompt.
export const ZONE_RULES = {
  R_ZONE_SCOPE: {
    rule: 'You are authoring the INTRO and the CONCLUSION only. The video structure block names their exact spans, measured from the source files the owner recorded. Every cue you emit MUST carry a `zone` field of "intro" or "conclusion" and MUST anchor inside that zone. The body is authored by a separate pass against a separate rulebook — do not cue it, do not reason about its pacing, and do not assume what it contains beyond the transcript you are given.',
    why: 'owner 2026-07-29: "i want intro conclusion steps to be very explicit and not tied with full body.. its rules, guildeliness, execution should be seprate". Previously one pass authored the whole video against one rulebook, so every intro lesson was a body lesson too',
  },
  R_ZONE_STAKES: {
    rule: 'These two zones carry the most weight in the video and are worth spending more on than any equivalent stretch of body. The opening decides whether anyone stays; the conclusion is the payoff the opening promised. Author them with your strongest devices, and prefer a card that ENACTS the point — shows it happening — over one that titles it. Commissioning a NEW card for a zone is an expected outcome, not a last resort: if nothing in the catalog does the job, flag the cue and describe the card you actually want.',
    why: 'owner 2026-07-26: "Intro and Conclusion are supposed to be most imp part of tutorials and I want this to be literally the best. Even if we need to create new motion graphic i am ok"; reaffirmed 2026-07-29: "more than open to make new graphics for intro/conclusion"',
  },
  R_ZONE_NO_FORMULA: {
    rule: 'There is deliberately NO required structure for either zone — no mandatory hook slot, no mandatory agenda card, no fixed running order. What an intro needs is a judgment call about THIS script. Never add a card because a slot exists; add it because the narration gives you something to enact. An intro that fills five prescribed slots badly is worse than one that does three things well.',
    why: 'owner 2026-07-28, on encoding a required intro formula: "its subjective. Pls dont make this hardcoded"',
  },
  R_ZONE_MOTION: {
    rule: 'Motion is the quality bar in a zone, not cue count. A zone can be dense with cues and still feel dead if the cards are static slates and the footage underneath is not moving. Before you finish, walk the zone start to end and ask what is MOVING at each second: a card revealing beats, footage in motion, or the presenter. If the answer for some stretch is "nothing", that stretch is the defect — fix it there rather than adding another card somewhere easier.',
    why: 'test-03 intro measured 3.57 cues/min against a 2.30/min body — DENSER than the body — and was still rejected. 4 fullframes, 1 enacted, and 20 consecutive seconds at ~0.01 mean frame delta (a still image). Density was never the problem',
  },
  R_ZONE_SHARED_CATALOG: {
    rule: 'There is ONE card collection, shared with the body. No card is reserved for a zone and no card is forbidden in one — a body card is a fine choice in an intro when it genuinely fits. Choose on merit, never on where the card came from. Commissioning a NEW card for a zone is an expected outcome, not a failure: set `card` to the slug you would build (a slug NOT in the catalog) and add a `propose` object `{"does", "kind", "placement", "beats", "variables"}`. The owner approves or kills it at step 037, step 038 builds it, and it joins the shared collection — so the body can use it on the next video.',
    why: 'owner 2026-07-29: "No need to restrict on templates. Also there will be one template collection which body and intro,conclusion anyone can use. lets keep on maintaining that collection" — the owner rejected a zone-only card family',
  },
  R_ZONE_HOST: {
    rule: 'The presenter must actually land in the intro. Do not wallpaper the opening with fullframe cards — leave the host real time on screen early, because a tutorial that opens on wall-to-wall graphics has nobody on it to trust yet. The same applies in reverse at the conclusion: the payoff lands better from a person than from a slate.',
    why: 'lint W12 (opening-host-coverage) exists because test-03 did not show the presenter until 0:54',
  },
};
