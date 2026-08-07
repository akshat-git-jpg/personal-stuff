# 038 · build cards, then the owner reviews them · [LLM] (Sonnet) + [OWNER]

Build every card the owner approved as NEW at step 037, into the **shared**
card collection, **and then show it to them**. Then the video continues at 040
with a catalog that contains everything its cues name.

This step is two things, which is why its folder says both. At 037 the owner
approved a written *spec*. Nobody has seen the actual card. Landing it flips its
plan item from `new` to `existing`, and that change resets the 037 approval by
design (`lib/card-plan.mjs`), so the built card goes back in front of the owner
before 090 will render it. See "The review is not optional" below.

- **In:** `videos/<slug>/card-plan.json` (`approved: true`), the `proposal`
  block on each `status: "new"` item
- **Out:** new cards in `../card-library/<type>/<card-name>/`, each with a
  `catalog.json` entry (committed **and pushed**), plus a re-approved
  `card-plan.json`
- **Skip when:** `card-plan.json` has no `status: "new"` items. Most videos.
  Record it as `skipped` in the run ledger with the reason, do not leave it blank.
- **Next:** `run.sh <slug> resolve` (step 040)

## This step owns almost nothing

**The authoring procedure lives in `../card-library/CLAUDE.md` ("Adding a new
card") and the visual rules in `../card-library/DESIGN.md`.** Read them and
follow them. Do not restate them here — one authoritative home, referenced, not
recopied.

What is specific to this step is only:

1. **The work list comes from `card-plan.json`.** Build exactly the
   `status: "new"` cards, and nothing else. A card the owner did not approve
   does not get built because it seemed like a good idea while you were in there.
2. **The card goes in the shared collection, not the video's folder.** There is
   ONE card collection. A card born for an intro is available to the body on the
   next video — that is the whole reason proposals are worth approving (owner,
   2026-07-29: *"there will be one template collection which body and intro,
   conclusion anyone can use. lets keep on maintaining that collection"*).
3. **The proposal is the spec.** `does` / `kind` / `placement` / `beats` /
   `variables` came from the pass and survived the owner's review. Build that
   card. If the spec turns out to be unbuildable as written, stop and report —
   do not quietly build something else, because the owner approved the spec, not
   your judgement of it.
4. **The owner previews the LOOK before any code (owner rule 2026-07-31).**
   The 037 approval covered WHAT the card does; it did not cover how it looks.
   Before building each new card, produce 1–2 image-generation prompts from
   the template in `../card-library/DESIGN.md` (New-card checklist, item 0) —
   one per key moment — hand them to the owner to run in Google Gemini/Flow,
   and wait for the verdict. The approved frames are the visual contract:
   build to match them. This applies to EVERY new card, including ones
   commissioned mid-fold outside this step — and it survives
   `run-config review=express` (owner rule 2026-08-01: "even if I say run till
   final cut, if you are making new motion graphics I still want the prompt").
   Express waives the 037/080 board approvals, never this.

## The catalog entry

The card is invisible to the cue passes until `catalog.json` has it. Minimum
shape (this is the stub the retired `scripts/promote-bespoke.mjs` used to print):

```json
{
  "slug": "<type>/<card-name>",
  "kind": "single | beat",
  "placement": "fullframe | overlay",
  "purpose": "",
  "intent": "",
  "anti_intent": "",
  "variables": {}
}
```

`purpose`, `intent` and `anti_intent` are not optional padding — they are what
the next cue pass routes on, and `anti_intent` is a hard veto during selection.
A card with empty routing fields will sit in the catalog unused, which is the
same as not having built it.

## Done means pushed

A card committed but not pushed is invisible to the editor **forever, silently**
— nothing errors, it just never appears (`card-library/CLAUDE.md`; this actually
happened to `verdict/winners-podium`, which sat untracked for a day).

Gates, all of which must pass before this step is done:

```bash
cd ../card-library
npx hyperframes@latest lint <type>/<card-name>   # font/Studio warnings are expected
node scripts/card-qa.mjs <type>/<card-name>      # the max variant must not clip or overlap
node scripts/check-catalog.mjs
bash scripts/beat-smoke.sh                       # beat cards only
bash scripts/check-cards.sh --publish            # also requires everything PUSHED
```

## The review is not optional

Back in the pipeline, run `node lib/card-plan.mjs <slug>`. The rebuilt plan
flips the card from NEW to EXISTING, which **resets the 037 approval on
purpose**: the owner approved a spec, and now there is a real card to look at.

```bash
node lib/card-plan.mjs <slug>     # rebuild; approval resets to false
bash run.sh <slug> board          # Card Plan tab; owner re-approves
```

Re-approving is one click, and it is the only moment the built card is compared
against what was asked for before it reaches a video. It is enforced, not
merely advised: `render.mjs` refuses to run while `card-plan.json` is
`approved: false`, so a card nobody looked at cannot reach 090.

Do not `--force` past it. The whole reason 037 approves a spec rather than a
finished card is that the card does not exist yet; this is where that debt is
settled.

## Why a real model, not a form-filler

Writing a card is design work against `DESIGN.md` — palette, type scale, layout
capacity at the declared caps, and the shared TIMELINE motion feel. A cheap
model produces a card that lints clean and looks wrong, and the cost lands on
the owner at the 080 board. Route this to Sonnet or better.
