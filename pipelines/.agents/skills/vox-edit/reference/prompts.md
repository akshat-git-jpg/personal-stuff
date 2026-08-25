# Prompt library

Two blocks compose every prompt: the **STYLE DNA** (constant, so every frame belongs to one world)
and the **SHOT** (what varies). Motion prompts add the **RIGID-BODY BLOCK**, which is not optional.

---

## STYLE DNA — cut-paper diorama

The palette below is the vendor's (navy + chartreuse #CFFF05). Swap the colour clause for the
owner's brand: take the accent from `loop-studio/core/brand/brand.json` and enumerate what it must
NOT be, the same way — the negative enumeration is what makes the palette hold.

Reuse verbatim; vary only the subject.

> Cut-paper collage diorama, a miniature set built entirely from layered torn paper and cardboard,
> visible paper fibre edges and hard drop shadows between layers. STRICT COLOUR PALETTE: cool light
> grey paper, deep midnight navy blue, steel blue-grey shadows, with sharp CHARTREUSE ACID
> YELLOW-GREEN accents only — the exact colour of a yellow highlighter pen (#CFFF05), a bright
> YELLOWISH green. It must NOT be emerald green, NOT pure green, NOT matrix green, NOT neon green,
> NOT mint, NOT teal. Absolutely NO sepia, NO brown, NO cardboard tan, NO olive, NO warm tones, NO
> orange. Dramatic low-key lighting, the chartreuse glow as the only light source. No text, no
> lettering, no numbers, no signage anywhere in the image.

**The colour clause is load-bearing.** Without the "NOT emerald / NOT matrix" enumeration, the model
returns saturated green. Naming the hex alone is not enough — enumerate what it must NOT be.

**"No text" is mandatory on every generation.** Generated pixels never render text; Remotion writes
every word and number. Strengthen it for screens/signage subjects:
> ABSOLUTELY NO text, NO lettering, NO numbers, NO symbols, NO icons — every panel is completely blank.

## Depth staging (add to any still that will be flown through)

> STRONG THREE-LAYER DEPTH STAGING: a large dark out-of-focus paper element cutting into the extreme
> foreground from the LEFT frame edge, a sharply lit midground subject, and far background elements
> fading into navy haze.

Real parallax needs a real foreground object to travel past. Flat frontal frames give flat motion.

---

## RIGID-BODY BLOCK — mandatory in every motion prompt

This is what stops the warping. Paste verbatim.

> CRITICAL: this is a rigid physical miniature. Objects NEVER slide through one another, never
> stretch, never morph, never swap places, never wobble. Every rack, pylon and panel stays exactly
> where it is; ONLY the camera moves. Stop-motion paper-craft aesthetic, matte paper texture preserved.

Pair with velocity discipline:
> Steady, smooth, unhurried — constant velocity, no acceleration, no stopping, no reversing.

---

## Camera moves — vary the axis every beat

Three identical dollies means one second in, the viewer knows what happens. Rotate through:

**Pull-back reveal** (opens on something unplaceable):
> RAPID PULL-BACK REVEAL. The shot begins as an extreme macro close-up on <detail>. The camera pulls
> BACKWARD at a steady constant speed, revealing first <near>, then <mid>, then <the whole space>.
> Still retreating, the camera also begins to RISE, climbing steadily upward. Never pushes in.

**Crane down** (axis change):
> CRANE DOWN. Begins as a high overhead bird's-eye view looking straight down at <subject>. The
> camera CRANES DOWNWARD smoothly and continuously, the angle tilting from looking straight down to
> looking forward, until at eye level among <subject>. Never rising, never stopping.

**Lateral track** (reveals scale):
> FAST LATERAL TRACKING SHOT. Begins as an extreme close-up on <detail>. The camera TRACKS SIDEWAYS,
> sliding horizontally at constant speed, revealing that this is only ONE of hundreds. Strong
> parallax: near elements streak past fast while the distant wall drifts slowly.

**Forward dolly** (the workhorse):
> SLOW STEADY FORWARD DOLLY: the camera glides smoothly straight ahead down the central axis at a
> constant unchanging speed. NEVER stops, NEVER pans, NEVER tilts, NEVER orbits — pure forward travel
> with a locked level horizon. The foreground element sweeps past much faster than the midground,
> creating strong parallax depth.

## Continuation prompts (for chained clips 2+)

The clip starts on the previous clip's real last frame, so **state the motion already in progress**:

> The camera begins <where the last frame is> and CONTINUES <moving how> at the same steady constant
> speed it was already travelling, <next leg of the journey>.

Naming the inherited velocity is what makes the join feel like one move rather than two.

## Journey design

Waypoints are the beats of the ARGUMENT, and consecutive waypoints must be plausibly adjacent in one
physical place. Worked example (AI energy):

| Beat | Waypoint | Move |
|---|---|---|
| "rendered somewhere real" | macro on one indicator light | pull-back → server hall → rise |
| "drawing power" | above the racks | glide forward, substation appears ahead |
| "more than entire countries" | substation yard | descend between transformers |
| "it's video" | glowing panel | push in until it fills frame |

Reads as: *inside a rack → out through the hall → over the roof → across to the substation → down
into it → into the screen.* One place, travelled through — not four locations.
