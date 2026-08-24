# Format: INTRO — the cold-open hook film (≤~40s, highest polish)

> **Treatment = [talking-head.md](talking-head.md) (designed motion-graphics). Creative mode =
> [creative-standard.md](creative-standard.md) (mandatory).** This file adds only what's specific to a
> short, front-loaded hook film that opens a longform video. The proven exemplar is
> [`../core/engine/remotion/src/bb2/design_loopstudio.json`](../core/engine/remotion/src/bb2/design_loopstudio.json)
> — study it as THE intro screenplay.

## What's different about the INTRO shape
- **Canvas:** 1920×1080 (or 3840×2160 for a 4K cold open). ≤~40s.
- **Polish:** this is the single most-polished stretch of the whole video (Law 7). The reviewer's bar:
  *"this is the hook, it should look insanely polished."* Never ship the intro as a first-pass afterthought,
  and never let it sit below the polish of the body it introduces.
- **The arc** (adapt beats to the VO, but this is the proven shape):
  1. **HOOK** — a direct-address taunt / doubt, face full-screen in the dark register. Land it on the face.
  2. **TURN** — the pivot to the promise; register crossfades dark→light on the turn word; face docks to the panel.
  3. **SCOPE** — what you'll show, enacted (raw take → finished cut as one transform).
  4. **MECH** — the mechanism, enacted with the **real product UI** (a note typed into a real Claude window, a timeline struck out).
  5. **COST / STAKES** — the number, enacted cinematically (cash tower vs $0), back in the dark register.
  6. **TEASE** — a curiosity gap that *means* something (demote the earlier object; a forward arrow), never a bare "?".
  7. **BUTTON** — one big lime plate ("LET'S DIVE IN →"), a pre-flash, then a white flash **out** into the body.
- **Contrast between beats 1 and 2:** the hook and the turn should read differently at a glance (e.g. a
  darker hook room → a lighter turn) so the pivot lands. *(Locked from LoopStudio v9: "make it a lighter
  room so there's contrast between scene 1 and 2.")*
- **ONE continuous piece with the body — no music seam.** The intro's music must flow into the body track;
  do not hard-cut songs at the intro→body boundary. *(Locked from LoopStudio v2: "the music changes and it
  doesn't feel like one complete video; it's more like two separate parts.")* If the intro and body are
  rendered separately, conform the score across the seam in the mix.
- **Continuity is the craft:** an object introduced in an early beat (the player window, the $2,000 plate)
  should carry forward and get **demoted/promoted** across beats — that's what makes an intro feel authored.

## Recipe
1. **Head:** recorded → cut with `core/engine/cut/` (mandatory); or AI → `avatar-video`.
2. **Project:** `projects/<name>/video.json` → `{ "mode":"talking-head","format":"intro","aspect":"16:9"|"4k","fps":30 }`.
3. **Screenplay:** `design_<name>.json`, one beat per clause, following the arc above (copy the loopstudio exemplar's shape).
4. **Author + render** the intro comp; **sound**; **mix** — and conform the score to flow **into** the body with no seam.
5. **v1 self-audit** (hook + button are the polish gates) → publish (Gate A) → feedback loop (Gate B) → learn.

## Format checklist (on top of the v1 self-audit)
- [ ] Hook lands on the face; beat 1 and beat 2 visibly contrast (dark→lighter)?
- [ ] Mechanism shown with real product UI, not a fake timeline/panel?
- [ ] Number enacted cinematically (tower vs $0), not written flat?
- [ ] Music flows into the body with NO seam; one complete piece?
- [ ] Button plate + flash-out cuts cleanly into the body?
