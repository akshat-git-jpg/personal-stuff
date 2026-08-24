# The Creative Standard — full creativity mode, from the FIRST version

> **This is the load-bearing document of Loop Studio.** Every designed video — explainer, YouTube,
> talking-head, short, longform, intro — obeys it. Read it before authoring a single beat, and
> re-read it before every re-render. `video-taste` is the growing quality *bar*; this is the default
> authoring *mode* that clears that bar on v1.

## Why this exists (the problem it fixes)

Across every project (LoopStudio v2→v11, BusinessBrain v7→v26, ROAM, NO_SIGNAL) the **first** version
was rejected for the *same* reasons, over and over, and it took ~9 rounds of feedback to drag the video
up to "super creative and polished." That is a waste — the reviewer should never have to *ask* for
creativity. The whole point of this standard is: **v1 starts where the old v9 ended.** If a note below
would have been given on v1, you failed the standard, not the video.

The reviewer's own words, distilled:
> "the first version is almost always really bad — very simple, and not in a full creativity mode that
> explains concepts in a creative, engaging way."

Full creativity mode is not "add more stuff." It is: **every spoken idea becomes a picture that *does*
the idea** — clean, real, cinematic, synced to the voice — with text and icons in service of the
picture, never in place of it.

---

## Law 0 — understand the WHOLE video first, then give it a through-line (the highest lever)

Everything below (the 10 laws) is per-beat craft. **This law is what makes the beats add up to a film
instead of a slideshow of nice moments — and it is the single most important part of full creativity
mode.** It happens *before* you write a single beat.

**1. Understand the whole video — state the ONE core concept.** Before authoring anything, distill what
the entire video is actually explaining, in one sentence. If you can't, you're not ready — re-read the
script/transcript until you can. Every visual then serves *that* concept, not just the local clause.

**2. Find the digestible frame for the hard idea.** Great explainer editing takes a complicated concept
and makes it click in one second through the right analogy / metaphor / visual system ("your business is
a folder of text files"; "the cost is a tower of money that topples to zero"; "editing assembles around
you like an Iron-Man suit"). Choose the frame that makes the core concept *obvious*, then enact it.
**Digestible beats clever.**

**3. Design a THROUGH-LINE — a recurring visual vocabulary that connects the scenes.** Pick one or two
central objects/motifs that **recur and EVOLVE across the video**, so different parts visibly work
together and the viewer feels the "recognizable overlap." Plant it early, call it back, promote or demote
it, pay it off at the end. This is exactly what separates parts that *rhyme* from parts that just follow
each other.
- *Proof, from your own `design_loopstudio.json`:* the **`this-video.mp4` player window** is planted in
  the hook, becomes the finished cut in the scope beat, and returns as the payoff; the **`$2,000` plate**
  is revealed big, then *demoted* to "the least interesting part," then sits tiny at the origin of the
  "crazy economics" curve. Same objects, evolving meaning — so every scene reinforces the last.
- **Within a video, reuse ONE grammar for related ideas** (a single recurring object, the Marker word,
  the dark=problem / light=solution registers) so scenes echo instead of starting visually from scratch
  each time — but that recurring object is THIS video's own, invented for its concept, not borrowed from
  another video.
- **⚠ Author the recurring object as ONE persistent element with a single keyframed life — NOT a fresh
  copy re-instantiated inside each beat block.** The #1 way a through-line fails is that each beat renders
  its *own* instance of the motif, so it visibly pops out at the end of one beat and pops back in at the
  start of the next — the viewer sees separate objects, not one evolving object. Luuk on the ad2 "?":
  *"we start with a big question mark… then it disappears directly and another question mark pops up. Why
  not keep it as the same question mark?"* The fix (proven in `Ad2WaarBeginJe.tsx`): lift the motif to a
  **single top-level element** driven by one keyframe track — a `QK[]` life array (t → x, y, scale, fill,
  glow) with a small `qAt(t)` interpolator. When it IS on screen it must be that one element moving/rescaling/
  restyling, never a second copy. Each beat's *surroundings* (the swarming bubbles, the orbiting tiles, the
  scan line) reference the motif's **current** position (`q.x/q.y`) so they attach to the same object instead
  of a hardcoded center. The payoff is a literal state-change of that same object (the "?" dissolving into the
  answer's header), not a cut to a new graphic.
- **⚠⚠ RECUR, don't be OMNIPRESENT — a motif is a guest that returns, not wallpaper.** The trap on the other
  side of pop-in-out: keeping the motif on screen *every single frame* for the whole video. The first ad2 pass
  did this — the "?" hovered over the chatter, the standstill, the empathy, the strike, the adrift, the scan —
  and Luuk's correction was blunt: *"the question mark should not be everywhere… it was just an example to make
  it flow, but it should not be in every scene; it's now in there way too long."* One evolving object ≠ an
  always-visible object. Give the motif a **presence envelope of a few disjoint windows** (in ad2: the HOOK
  where the question is posed, ONE callback at the "which tool?" beat, and the RESOLVE into the list) and let
  **every other beat own its own frame** with its own enacted visual. The through-line still reads because the
  same object *returns and has evolved* — recurrence, not saturation. Rule of thumb: if the motif is present in
  more than ~half the beats, it's probably wallpaper; cut it back to where a viewer would actually feel it.
  Continuity means "no separate copies pop in/out," NOT "it's always there." An adversarial frame-review should
  check BOTH failure modes: any vanish-then-new-instance *within* a window, and any window so long the motif
  overstays.

**Not every video needs one rigid metaphor end to end** — but the more recognizable recurrence you build,
the more digestible and *authored* it feels. When in doubt, thread a motif. **Write it down first:** the
`design_<name>.json` screenplay opens with a `concept` block (thesis + digestible frame + through-line
map) *before* the beats, and every beat is then designed to serve it.

> **⚠ Invent it on the spot — the examples in this document are NOT a menu.** Every concrete subject you
> see here (folder-of-files, raw-clip-through-stations, cash-tower-vs-$0, the player window) is ONE past
> video's answer, shown only to demonstrate the *shape* of a concept / frame / through-line. **Reusing a
> past video's metaphor on an unrelated video IS the failure — derive THIS video's frame and through-line
> fresh, from THIS video's own subject and domain.** Two axes, and only one is fixed:
> - **Constant (this is cohesion — keep it):** the brand *look* (palette, type, the Marker word, the
>   dark=problem / light=solution registers) and the *method* (understand-whole → frame → through-line →
>   enact → sync). Every BuildLoop video should *look* like BuildLoop. The style being recognizable is not
>   staleness.
> - **Fresh every time (this is the creativity):** the concept, the digestible frame, the through-line,
>   and the concept-carrying devices. **If the central metaphor could be swapped between two of your
>   videos without anyone noticing, you reused instead of invented.** Draw the frame from the video's own
>   world (a cooking video's through-line comes from cooking, not from a raw clip traveling through stations).

---

## The 10 laws (each one is a v1 reject if broken)

Each law below carries the verbatim note that keeps recurring when it's broken. These are checkable.

1. **ENACT, don't label.** Every spoken concept becomes a visual that *shows* the idea. If it's said
   in the VO, do **not** also type it on screen. "a human" → composite a real human; "a manual step"
   → a keyboard icon + one short caption, never the wordmark `MANUAL STEP`. Max **one** lime Marker
   word per headline. *("making it more visual is the goal here" / "we should not litterally have
   'manual step' typed out")* — **the single strongest through-line in all feedback.**
   **Falsifiable test — apply to every beat:** mute the audio AND hide the headline/caption. If moving
   objects still communicate the idea, it's enacted. If you're left with an empty or meaningless frame,
   it was a label — rebuild it. ("Enacted" is not a vibe; it's this test.)

2. **No code-ish / fake placeholders, EVER.** No fake editor timelines, no fake "parameter/cut"
   panels, no meaningless code. To show a **product**, show its **real UI**; to show an **outcome**,
   show the **real published result** (graded frame + burned captions + lower-third + view count) —
   not track-lanes. *("it looks so code ish and fake! what does a 'cut parameter' even mean?")*

3. **Heroes are FULL-SCREEN, not corner cards.** Hero/example visuals fill the frame with full-blown
   animation. When the presenter points at the screen, keep them full-screen and place the referenced
   thing **beside** them; example sets are full-screen columns, not tiny drifting cards.
   *("I want to see me in full screen because I'm pointing… full screen: three columns")*

4. **1:1 realism on every asset.** Real map SVGs that follow the true outline (never a blob), photoreal
   live-action where the key object is clearly visible, and the **real brand mark in its real colour**
   whenever a brand/platform is named (Claude clay-orange, YouTube red, Shorts, Instagram gradient,
   TikTok, Stripe, Supabase). **A named brand with no logo on screen is a v1 miss.**
   *("it should be one-to-one" / "please add a YouTube logo there")*

5. **Numbers & comparisons are enacted cinematically, with the real values kept inside.** "$2,000/mo"
   is a cash **tower that stacks and topples**, not text. A comparison is **side-by-side with
   contrasting weight** (heavy struck stack vs. light lime $0 plate), never sequential or written flat.
   A retention teaser must **mean** something, never a bare "?". *("a tower of money… cinematic and
   creative, but still keep the numbers in there")*

6. **React to the spoken CADENCE.** One beat per clause; something happens on each point. Nothing static
   held under changing narration. On "never open an editor," something must move **on that word.**
   *("nothing happens on the stream… it's just too static for too long")* **Trivial motion does NOT
   count as a beat: a fade, an opacity/scale pop, or a Marker wipe on text is not "something happening."
   The enacted OBJECT must change STATE on the word — assemble, fill, topple, strike, orbit, advance,
   resolve. If the only thing moving is text, the beat is static and fails.**

7. **The HOOK and the PRODUCT/OFFER get the highest polish, from v1.** The hook must be *insanely*
   polished — it's the whole retention bet. The thing they buy gets a premium lockup (real logo,
   glass/3D card, scarcity pill), never a cheap line-art doodle. Never ship either as a first-pass
   afterthought. *("this is the hook, it should look insanely polished" / "should look more premium…
   like a real studio")*

8. **Clean by construction.** ONE focal point per beat, minimal on-screen text, **nothing overlapping**
   (never a caption sitting on a timeline / logo / counter), no busy noise elements. When a beat feels
   crowded, **cut elements — don't cram.** *("clean and visualizing" / "too many different texts")*

9. **The text law.** Delete every eyebrow/kicker label (`THE BEST PART`, `I USED TO PAY`, `Station One`).
   Headlines go **bottom-middle, centered** — never top-left. Correct contrast always: never lime/yellow
   text on white (use olive-ink `#7a9a00` on the light register), never grey/dark on dark.

10. **Audio is finished in v1, not an afterthought.** One continuous music bed (multi-track mapped to
    structural sections on long videos), kept well **under** the VO and ducked harder over tutorials;
    subtle word-synced SFX that are present-but-never-noticed; voice **centered** (both ears, never one);
    any real statistic backed by a **real source**, with the graph plotting the actual series.

11. **Richness floor — "clean" means *built*, not *empty* (the counter to the actual reject).** The
    reviewer's core complaint is *"very simple,"* not "too busy" — so the subtractive laws (8, 9) are only
    half the standard. **Clean = ONE idea fully built out at full scale, not a bare frame.** A hero beat
    that is only a background + one icon + one headline is a v1 **fail**, even though it's "clean." And
    **do not reduce every video to the stock chain** (`FolderOfFiles → DatabaseHolds → NumbersMove →
    StatBig`) — that's the retired template by another name. **At least the hook and the core-metaphor
    hero beat must use an enactment authored bespoke to THIS video's idea.** Name the one bespoke device
    you built for this video; if it's "none," you shipped the template.

---

## The method that produces it: the design-spec SCREENPLAY (mandatory, before any code)

You do not get a creative v1 by writing scenes and hoping. You get it by writing a **screenplay first** —
one row per spoken clause — and only then authoring the JSX. This is where every creative decision is made
in *words*, so the flat-label failure can't happen. The canonical exemplar is
[`../core/engine/remotion/src/bb2/design_loopstudio.json`](../core/engine/remotion/src/bb2/design_loopstudio.json)
— study it; it is what "full creativity mode" looks like on paper.

Write `core/engine/remotion/src/bb2/design_<name>.json` (or per-act `design_<name>_actN.json`). It **opens
with a `concept` block** (Law 0 — you design the through-line before the beats), then a `beats` array:

```jsonc
{
  "concept": {
    "thesis": "<the ONE thing this whole video explains, in a sentence>",
    "digestible_frame": "<the analogy/visual system that makes it click in 1s>",
    "throughline": "<the 1-2 objects/motifs that recur & EVOLVE across scenes — what's planted, promoted/demoted, paid off>",
    "recurring_grammar": ["<motifs reused so scenes rhyme: e.g. the player window, the Marker word, dark=problem/light=solution>"]
  },
  "beats": [ /* one object per spoken clause: */ ]
}
```
*(A real, shipped `throughline` — `projects/loopstudio-main/video.json`: "the RAW CLIP as a traveling
object: one card that enters dirty and moves through stations — cut → code → sound → taste — until it
ships; each act advances it." THAT is what a through-line looks like.)*

Each beat object:

```jsonc
{
  "id": 4, "beat": "MECH", "start": 14.68, "end": 21.84,
  "narration": "here is the best part, I never open an editor, I never touch a timeline, I just talk and give it notes.",
  "register": "light",                 // dark = problem/tension · light = solution/build · (lime plate = the answer)
  "mode": "panel->hidden",             // how the presenter sits: full · panel · hidden
  "object": "An NLE timeline struck out; a real Claude window taking a typed note",
  "action": "on 'never touch a timeline' a raisin STRIKE kills a real timeline window; face hides; a real Claude Win takes center; a NOTE self-types on 'give it notes'; a lime '✓ done — re-rendered' stamps",
  "continuity": "the Claude Win is the same window species as the player from beat 2 — editing here is a note, not a timeline",
  "copy": { "headline": "NO TIMELINE — JUST NOTES", "marker": "NOTES" },  // minimal; ONE marker word
  "sync": [                            // frame-accurate cues tied to SPECIFIC spoken words
    { "at": 19.1, "event": "raisin STRIKE slashes the timeline on 'never touch a timeline'" },
    { "at": 20.2, "event": "face hides; Claude Win takes center, note self-types" },
    { "at": 21.4, "event": "'✓ done' stamps lime; headline Marker-wipes NOTES" }
  ]
}
```

The fields, and why each one prevents a failure mode:
- **`register`** — decide dark (problem) vs light (solution) per beat. Cross-fade at chapter boundaries. (Law 2/9)
- **`mode`** — full-bleed (land it on the face) · lime-offset panel (park `x74 y52 s0.92`, graphics get the rest) · hidden (the concept owns the frame). Footage moves **only** at a beat boundary, then holds still. (Law 3/6)
- **`object` + `action`** — the enacted thing and what it *does*, in words. If you can't describe the action without typing a label, the idea isn't enacted yet — keep going. (Law 1/5)
- **`continuity`** — what carries from the previous beat. Reusing/demoting an earlier object (the $2,000 plate shrinks to "least interesting") is what makes it feel *authored*, not a slideshow.
- **`copy`** — the *only* words allowed on screen this beat. One headline, one Marker word. No eyebrows. (Law 9)
- **`sync`** — every cue pinned to a spoken word. This is Law 6 made mechanical.

Then author `ActN.tsx` from the spec, render, sound-design, mix. The full engine pipeline is in
[`talking-head.md`](talking-head.md). **Durations stay LOCKED to the baked VO — never change them when restyling.**

---

## The device library — a vocabulary of proven ENACTMENTS to adapt, not a menu to wire the same four

These are how the design system *enacts* ideas — study them to learn the technique (an object that fills,
strikes, assembles, topples), then build the enactment **THIS** video's concept needs. Two guardrails:
**(1)** a shared primitive is fair to reuse when it *genuinely* fits (a filling cylinder really does say
"stored"); but **(2)** wiring only the stock four (`FolderOfFiles → DatabaseHolds → NumbersMove → StatBig`)
for every video is the retired template (Law 11) — the hook and the core-metaphor hero beat must be an
enactment built bespoke to this video's idea. The `useWhen` column is a *pattern*, never a subject to copy.
Two tiers:

### A) Shared, reusable now — `src/bb2/scene.tsx` + `concepts.tsx` (use these by name)
| Device | Enacts | Reach for it when |
|---|---|---|
| `Marker` | lime plate wipes L→R over ONE headline word | emphasizing the single load-bearing word |
| `Win` | a real app-window shell (traffic-lights + title bar) | wrapping any UI (browser, dashboard, editor) |
| `FolderOfFiles` | .md files → a live dashboard (tiles + drawing chart) | "your business = files that become a dashboard" |
| `DatabaseHolds` | event Cards fly on a bezier into a filling cylinder | scattered events getting captured/stored |
| `NumbersMove` | fixed-width tiles counting up, zero flicker | a metrics-going-up montage |
| `StatBig` | one big number/word on a lime plate, overshoot pop | the single big number/answer of a scene |
| `Card` | a discrete event (order/payout/DM), auto-icon | events that fly in, queue, settle into rows |
| `FileGraphic` / `FileChip` | a drawn .md file (can crack) / a named file chip | the "text files" through-line |
| `PhotoCard` + `Filmstrip` | dead static bars vs a live scrolling filmstrip | any "a photo vs a movie" / dead-vs-alive analogy |

Registers & type live in `engine.tsx`: `DarkBg` / `LightBg`; `SANS` = Space Grotesk 800 (uppercase
headlines), `MONO` = JetBrains Mono (labels/filenames/digits, always `tabular-nums`), `SERIF` = Playfair
italic (soft asides only). Palette: `RAISIN`, `LIME #CFFF05`, `SILVER`, olive-ink `#7a9a00` (the
lime-on-white substitute). **Single-accent rule: at most one accent element per composition.**

> **These colour/font names are BuildLoop's *values* — they are brand TOKENS, not hardcoded law.** The
> engine derives its whole palette from `core/brand/brand.json`, so a buyer swaps that one file and every
> scene re-skins. Read every "lime/raisin/silver/olive-ink" in this document as its token: **lime = your
> `accent`, raisin = your `base`, silver = your `ink`, olive-ink = your `accent_on_light`, Space Grotesk =
> your `sans`.** The *principle* (ONE accent, dark=problem / light=solution, one Marker word) is universal;
> the specific colour and font are the owner's. Prefer the semantic aliases (`ACCENT`, `BASE`, `INK`,
> `PANEL`, `CARD`, `BORDER`, `PAPER`) in new scenes — never a raw hex.

### B) Rich devices that EXIST but are HARDCODED in scenes (the meta-gap — promote before reuse)
These were built under later feedback and are the *proof* of what full-creativity looks like — but they
live as one-off consts inside `LSAct2/3/4.tsx` and the intro, so they can't be named yet. **When a new video
needs one, PROMOTE it — lift the reference impl into `concepts.tsx` as a parameterized component (that
extraction IS the sanctioned path, not a "fourth hardcoded copy") and reuse it.** Never ship a flat
fallback of a law-mandated device: Law 4 (real platform mark) and Law 5 (cash-tower-vs-$0) *require* these,
so budget the promote — do not substitute a written label because the device costs a refactor. Copy from:

| Idea the feedback demanded | Reference impl (copy from here) | Promote to |
|---|---|---|
| Cash tower `$2,000/mo` vs lime `$0` | `LSAct1.tsx` / `LoopStudioIntroBB.tsx` (B5) | `<CostVsZero amount plate/>` |
| Atoms tracing a real shape → fuse into a computer | `LSAct2.tsx` (`AtomLaptop` + `US_DOTS`) | `<ShapeAssembly silhouette target/>` |
| Three full-screen niche columns, each a live UI | `LSAct2.tsx` (`NicheCol`/`NicheIcon`) | `<NicheColumns kinds/>` |
| Real platform marks (YT/IG/TikTok/Shorts) | `LSAct4.tsx` (hand-coded SVG) | `logos/` files + `<PlatformMark/>` |
| Social icons **orbiting** to replace the word "attention" | *genuine gap* — only generic orbit exists | build `<IconOrbit icons/>` (don't render the word) |
| A 2-year calendar advancing | `LSAct4.tsx` (Jul2026→Jul2028 flip) | `<Calendar advanceMonths/>` |
| A real **sourced** statistic curve | `LSAct4.tsx` (82% ceiling, cited) | `<SourcedStatGraph points source/>` |
| A review room with **real video stills** | `LSAct3.tsx` (`ReviewRoom`, `public/stills/`) | `<ReviewRoom stills notes/>` |
| Real editor typing real code | `LSAct2.tsx` (`EdWin` + `CodeBody`) | `<CodeWindow lines/>` |

### Real assets on hand (never invent these)
`public/logos/`: `claude*.svg` (clay-orange), `youtube.svg` (red), `brand-tiktok/instagram/x/stripe/revolut/gmail/whatsapp.svg`,
`supabase.svg` (green), `markdown*.svg`, `folder-macos.png`, and **25 Lucide icons × 5 tints**
(base/-dark/-dim/-lime/-silver): activity, banknote, briefcase, calendar-days, clock-4, cloud, coins,
database, file-text, keyboard, mail, message-circle, mic, percent, search, shopping-cart, trending-up,
users, zap, … Also `public/assets/us-map.svg`, `public/stills/frame1-8.jpg` (real frames), `public/assets/subscribe-bug.mp4`.
*(Known empty/missing: `openai.svg`, `brand-linkedin.svg` — recreate before use.)*

---

## Text & icons — the two things the owner always wants on screen

The owner's rule: **"we want text in the video, we want icons in the video"** — across every format. Applied:
- **Text** = one bottom-middle headline with one lime Marker word (Law 9). Filenames/labels/eyebrow-free
  captions in MONO. Playful/human copy is welcome ("please make it look good, bro") but sparse. Never a
  label that restates the VO (Law 1).
- **Icons** = the real logo/Lucide set above, in real colour, **enacting** (an icon that *does* something:
  a cloud that powers a timeline, platform marks that orbit, a database that fills), never a decorative
  sticker in a corner. One accent (lime) among silver/steel.

---

## The v1 self-audit — run this BEFORE you publish the first version

**Do NOT self-certify from intent — look at the actual pixels.** Extract a frame at each `sync.at`
timestamp (`ffmpeg -ss <t> -i <render> -frames:v 1 f.png`), open them, and answer each box against what
you SEE — citing the frame. "I intended to" is not a yes; a beat whose `action`/`sync` from the
screenplay isn't visibly implemented in the render is an automatic fail. Then:
- [ ] Can you state the **one core concept** in a sentence, and does a **through-line** (a recurring, *evolving* motif/object) connect the scenes? (Law 0)
- [ ] Is at least the hook + the core-metaphor hero beat a **bespoke enactment** (not the stock Folder→Database→Numbers→Stat chain), and is no hero beat just background+icon+headline? (Law 11)
- [ ] Does **every clause** have its own beat, with the enacted OBJECT **changing state on the spoken word** (not just text fading in)? (Law 6)
- [ ] Is **each concept enacted** — zero labels that just restate the VO? (Law 1)
- [ ] Any **fake code/timeline/placeholder**? Any product shown as something other than its **real UI**? (Law 2)
- [ ] Are heroes **full-screen**; is every **named brand** wearing its **real logo in real colour**? (Law 3/4)
- [ ] Are numbers/comparisons **enacted with real values inside** (tower/side-by-side), not written flat? (Law 5)
- [ ] Are the **hook** and the **offer** the most polished beats in the piece? (Law 7)
- [ ] One focal point per beat, **nothing overlapping**, no stray eyebrow text, headlines **bottom-middle**? (Law 8/9)
- [ ] Does the through-line motif appear in EVERY frame it's alive (no pop-out/pop-in between beats), and does an enacted beat actually RENDER in the pixels — e.g. faint overlays (thin dots/reticles/rings) placed over **bright talking-head footage** MUST sit on a darkening scrim or they're invisible (the ad2 "adrift" dots were authored at 0.26 opacity over a lit face and simply didn't show)? (Law 0/1)
- [ ] Over the **head/eyes**: a motif parked full-opacity on the speaker's eyes for >1s buries the connection — lift it above the brow or drop its fill so the eyes read through. (Law 3)
- [ ] Music **under** the VO, voice **centered in both ears**, stats **sourced**? (Law 10)
- [ ] Every device either an existing `bb2` component **or** a properly-promoted parameterized one — no fourth hardcoded copy? (meta-gap)

Then, and only then, publish to the reviewer. When a round still teaches a *general* lesson, fold it into
`video-taste` (and, if it's a new enactment, promote the device) so it never has to be said again.
