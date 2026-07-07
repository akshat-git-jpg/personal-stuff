# Storyboard — `test` (Gemma 4 12B: encoder-free)

**Source:** `transcript.txt` (first ~5 min). **Style:** full motion-graphics, Devsplainers clone (no live footage). **Target:** ~31 scenes, ~4:12 total (~6 scenes/min, matching the channel). Every scene is fullscreen MG built from the kit atoms (`kit/atoms.md`); color carries the argument.

**Color law for this video:**
- **blue** = the OLD way — encoders / translators / "normal multimodal model"
- **amber** = the NEW way — Gemma 4, encoder-free, the reshape trick (hero)
- **red** = the problem — the cost of translators (memory / lag / frozen), the "torn-out eyes"
- **green** = the payoff — "still works", 35M, runs on your laptop
- **white** = neutral narration / setup

This is the **plan-before-pixels gate** (SPEC §6 Step 1). Review the metaphors/columns; once locked, each row becomes a static scene, then a motion pass.

---

| # | start | dur | VO beat (paraphrase) | Visual metaphor + layout | Kit atoms | Accent |
|---|------|-----|----------------------|--------------------------|-----------|--------|
| 01 | 0:00 | 8 | Google built a model that sees photos + hears voice memos | Center model-face icon with eye + ear icons lit; small photo + audio-wave icons feeding in | headline, icon set (model-face/eye/ear), pill | amber |
| 02 | 0:08 | 5 | …then tore out its eyes and ears right before release | Same model; eye + ear icons struck through with red X, drop away | icon set, connector, caption `is-bad` | red |
| 03 | 0:13 | 7 | No vision/audio network — deleted the piece every model was built around. And it still works | Two labeled encoder boxes crossed out → green "STILL WORKS" check | card (`is-blue` crossed), stamp, caption `is-good`, icon check | red→green |
| 04 | 0:20 | 7 | Top HN comment: "read it 3× and still can't figure out how it's possible" | Pull-quote scene, mono attribution "— top comment, Hacker News" | pull-quote scene (#33) | white |
| 05 | 0:27 | 4 | It comes down to one word: encoder-free | Full-screen color flash, single word "ENCODER-FREE" | color-flash (#34) | amber |
| 06 | 0:31 | 4 | This is Gemma 4 12B | Title card: GEMMA 4 **12B** | title card (#30), headline hero | amber |
| 07 | 0:35 | 12 | By the end: what an encoder is · why it seemed impossible · how Google did it · why it runs on your laptop · where marketing overreaches | Numbered agenda list, 5 rows staggering in | criteria-list card (#6 numbered), map-list, pills | white + amber |
| 08 | 0:47 | 4 | Section: first, what's an encoder? | Numbered-section divider "1 WHAT'S AN ENCODER?" | numbered-section (#31) | white |
| 09 | 0:51 | 7 | Picture an executive who only reads English | Person/authority icon centered, label "THE LANGUAGE MODEL · reads English only" | authority card (#32), person icon, pill | white |
| 10 | 0:58 | 10 | A photo slides in; she can't read it → hires a translator that studies the image, writes a paragraph | Pipeline: photo icon → [VISION ENCODER] → paragraph card, draw-on connectors | pipeline (#21), card `is-blue`, icons, connector | blue |
| 11 | 1:08 | 8 | A voice memo → a second translator listens, types what was said | Parallel pipeline: audio-wave → [AUDIO ENCODER] → paragraph | pipeline, card `is-blue`, connector | blue |
| 12 | 1:16 | 8 | Two tidy paragraphs → she does her job. That's a normal multimodal model | Node-graph: exec node + 2 paragraph cards feeding in; banner "NORMAL MULTIMODAL MODEL" | node-graph (#22), stamp | blue |
| 13 | 1:24 | 7 | Executive = language model; translators = encoders | Mapping table: exec→"language model", translator→"encoder" rows | mapping-table (#27), pills | blue/white |
| 14 | 1:31 | 8 | Vision encoder = its own full network, hundreds of millions of params, one job: pixels→readable | Big-stat "100s of MILLIONS" over a network-box icon | big-stat (#18), card, caption | blue |
| 15 | 1:39 | 8 | Field treated it as law: want sight? bolt on vision. want hearing? bolt on audio | Executive with two encoder boxes "bolted on" (pill labels BOLT-ON ×2) | node-graph, pills, connector | blue |
| 16 | 1:47 | 5 | Section: but every translator bills you | Numbered-section "2 THE COST", red catch-stack seeded | numbered-section, catch-stack (#3) | red |
| 17 | 1:52 | 8 | They eat memory — three networks loaded, not one | Three stacked network boxes + memory bar filling red; CATCH 1 | bars/status-bar (#26), cards, catch pill | red |
| 18 | 2:00 | 8 | They add lag — the LM waits for translators before it can start | Timeline: translators run, LM idle/greyed until they finish; CATCH 2 | timeline-dots (#28), status-bar, catch pill | red |
| 19 | 2:08 | 9 | Headache to improve — encoders frozen, sealed boxes you can't open | Two encoder boxes with lock icons; "FROZEN"; CATCH 3 | cards, lock icon, stamp, catch pill | red |
| 20 | 2:17 | 9 | Google fired both translators — taught the executive to read/hear herself | Translator boxes slide out; exec regains eye+ear icons (amber) | node-graph, icons, connector, caption | amber |
| 21 | 2:26 | 9 | The bet: the assumption was that raw pixels/sound are a foreign language needing translation first | Framing card: "THE ASSUMPTION: raw pixels + sound = a foreign language" | headline, card, caption | white→amber |
| 22 | 2:35 | 10 | Gemma bets that's wrong — model's smart enough to take raw input, if reshaped to fit the words' slot | Amber headline "WHAT IF IT'S NOT?"; raw input arrow into the same slot as words | headline hero, pipeline, pill | amber |
| 23 | 2:45 | 9 | Chop the image into a grid of tiles; each tile = a list of raw color values | Photo with grid-of-cells overlay; one tile pulled out → mono value list | grid-of-cells (#25), data-block, icon | amber |
| 24 | 2:54 | 11 | One dumb math step — a single multiply — stamps it into shape to sit beside text. Nothing studies it | Mono data block: `[r,g,b …] × W → token`; caption "NO NETWORK" | data-block (#14), mapping (`→`), caption `is-hero` | amber |
| 25 | 3:05 | 8 | Wrinkle: a pile of tiles doesn't know where it came from; position matters | Scrambled/unordered tiles, "?" over them | grid-of-cells (shuffled), pill `?`, caption `is-bad` | red/amber |
| 26 | 3:13 | 9 | Fix: stack each tile with its grid coordinates — like numbering jigsaw pieces | Tiles re-ordered, each tagged with (row,col) coords | grid-of-cells (`is-on` + coord tags), pills | amber |
| 27 | 3:22 | 11 | Vision side = reshape + position tags. Traded 100s of millions of params for ~35M | Two-bar compare: tall blue bar (100s M) vs tiny amber bar (35M); big-stat "35M" | bars (#23), big-stat, caption `is-good` | amber/green |
| 28 | 3:33 | 12 | Audio's blunter: slice the wave into thin slivers, each one reshape into the same stream — no audio network | Waveform → sliced slivers → single stream of tokens; "NO AUDIO NETWORK" | timeline-dots/pipeline, data-block, caption | amber |
| 29 | 3:45 | 10 | Everything's in — tiles, slivers, words become one kind of token in one pile. A single brain reading across all of it | Three streams (image/audio/text) pour into one model box; "SINGLE BRAIN" | pipeline (#21) merge, cards, headline | amber/green |
| 30 | 3:55 | 8 | Where did seeing/hearing go? Into the main model — it learned the translator's job in its own head | Arrow of "sight/hearing" absorbed into the model icon | node-graph, icons, connector, caption | amber |
| 31 | 4:03 | 9 | Firing the translators is why it runs on hardware you already own — start with memory | Laptop icon + freed memory bar (red→green); "RUNS ON YOUR LAPTOP" | status-bar (#26), laptop icon, big-stat, caption `is-good` | green |

**Total ≈ 4:12 (252s), 31 scenes.**

## Notes / bespoke calls
- **Recurring characters:** the *executive* (person icon = language model) and the *two translators* (blue encoder boxes) are the spine metaphor — reuse the same icons/positions in S09–S20 so "firing them" in S20 reads as the same characters leaving.
- **The one signature beat:** S24 (the single-multiply "nothing studies it") is the whole thesis — give it the most deliberate motion (the multiply stamping the token into the word-stream). Everything else supports it.
- **Icons to add to the kit** (not yet built as examples, author inline per `atoms.md` §19): eye, ear, model-face (happy/neutral), lock, laptop, waveform. Single-weight line-art, stroke from tokens.
- **Deferred (phase 2, per SPEC §2/§10):** VO/audio, assembly/concat, and picking the cheap generation driver — none block the static pass.
