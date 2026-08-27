# Video title

How to Make Vox Style Videos with AI

**Format: tutorial.** Called at step 010 per
`steps/010-take-knowledge-llm/README.md`; the owner overrides at gate 040.
Reason: the knowledge is eight walkthroughs full of exact settings, menu paths
and prompts. The viewer cannot *perform the job* before watching — that is a
tutorial. A comparison would throw the specifics away, and there are no
competing products being judged here, only methods.

# Knowledge (verbatim as supplied)

The owner supplied eight YouTube video IDs and one line of framing:

```
["edrUbfeSPio","7wuYBfE131U","ZhfHjf_0E-Q","PaXuebdY75U","TiycelzfzC0","WCDhGKNVrKU","Jkt4aTOpqpM","i5-tZegBvxU"]
```

> how to make vox style video with ai

No brain-dump, no screenshots, no links beyond the eight IDs. Everything below
is ingested from those eight transcripts and nothing else.

# Sources

Ingested 2026-08-27 via the `transcribe` skill. All eight returned native
captions (`method: captions`). Full transcripts kept verbatim in
`sources/transcripts/<video-id>.md`.

Titles, channels, subscriber and view counts fetched 2026-08-27 with
`yt-dlp --skip-download --print`. Metadata for a video the owner handed over is
ingestion, not research.

| # | Channel | Video title | Published | Length | Subs | Views | The tool stack it teaches |
|---|---|---|---|---|---|---|---|
| 1 | **Thomas Creates** | How to Make Vox Style Videos With AI | 2026-08-17 | 9m32s | 42.7K | 13.4K | Claude + VidIQ + OpenArt (GPT Image 2 + Seedance 2.0) |
| 2 | **MoSidd** | I Made Vox-Style Motion Graphics Using Only Claude Code & Remotion | 2026-06-28 | 13m11s | 10.6K | **146.4K** | Claude Code + Remotion + Magnific/Higgsfield MCP + ElevenLabs |
| 3 | **Ai-Seekify** | How to Create Vox-Style Documentaries with AI | 2026-08-24 | 10m12s | 20.5K | 3.0K | ChatGPT + ElevenLabs + Google Flow (Nano Banana Pro) + an enhancer + CapCut |
| 4 | **Joseph \| Video Editing** | Claude just Edited an Entire Vox Documentary From Scratch! (Here's How) | 2026-07-18 | 17m15s | **188K** | 59.0K | Claude + three custom "brain" skills + Higgsfield + ElevenLabs + Premiere Pro |
| 5 | **Koen \| AI Content Systems** | I 100% Automated Vox-Style Motion Graphics (Claude Code + Omni) | 2026-07-16 | 13m50s | 26.6K | 38.9K | Claude Code + Gemini Omni via Kie AI + ElevenLabs, as a `/vox-video` slash command |
| 6 | **Leo Ai** | How to Make VOX Style Videos AUTOMATICALLY With AI | 2026-07-30 | 8m24s | 61.4K | 16.3K | Abacus AI end-to-end (chat + studio + video editor) |
| 7 | **Skai Generated** | How To Create Vox-Style AI Motion Graphics (Full Workflow) | 2026-07-06 | 11m52s | 33.4K | 39.1K | OpenArt Director (single-chat, all-in-one) |
| 8 | **Luuk Alleman** | I Made a $3,000/Minute Vox-Style Animation (It Cost Me Almost Nothing) | 2026-07-24 | 5m56s | 22.0K | 5.1K | Loop Studio skill + Claude + Higgsfield MCP |

**Video IDs and URLs:** 1 `edrUbfeSPio` · 2 `7wuYBfE131U` · 3 `ZhfHjf_0E-Q` ·
4 `PaXuebdY75U` · 5 `TiycelzfzC0` · 6 `WCDhGKNVrKU` · 7 `Jkt4aTOpqpM` ·
8 `i5-tZegBvxU` — all at `https://youtu.be/<id>`.

**Transcript word counts:** 1 2525 · 2 2933 · 3 2361 (**Hindi**) · 4 4357 ·
5 2762 · 6 1961 · 7 2880 · 8 1338.

## What the numbers say about the sources

Read as a signal about which approach the audience actually rewarded, not as
proof of anything:

- **MoSidd (2) is the outlier hit.** 10.6K subs and 146K views — roughly
  **13.8x** its subscriber count, and more views than the other seven combined.
  It is also the oldest of the eight and the only one teaching the Remotion code
  route. Whatever the title and the code angle did, it travelled.
- **Joseph (4) has the biggest channel by far** (188K) but 0.31x views to subs.
  The most systematic method in the set, and the hardest sell.
- **Koen (5) and Skai (7) both beat their subscriber counts** (1.46x and 1.17x)
  — the two "one command / one chat, fully automated" angles.
- **Ai-Seekify (3) is the weakest** at 0.15x, and it is the free route, in Hindi,
  published most recently. Recency explains part of it.
- **Title pattern in the three best performers:** first-person claim, not a
  how-to. "I Made…", "I 100% Automated…". The two how-to titles (1, 6) landed at
  0.31x and 0.27x.

---

# What "Vox style" is, per the sources

Named the same thing across all eight: paper-cut / construction-paper /
collage animation over a documentary voiceover. The recurring named elements:

- **A single narrator carrying the whole story.** Cinematic, book-narrator
  register. (Videos 4, 7)
- **A rough paper / tactile texture**, so it reads as an animated movie rather
  than a digital slide deck. (Videos 1, 4)
- **A locked static background**, with mid-ground and foreground cutouts moving
  in on top of it. Reads as one continuous shot instead of many cuts. (Video 2)
- **Animated maps and arrows** that draw themselves to guide the eye. (Videos 1, 7)
- **Big bold captions** that punch onto the screen on the narrator's beat.
  (Video 7)
- **A choppy / low-FPS / jittery frame rate**, deliberately. (Videos 1, 4)
- **Simple camera movement** — a quick push-in when something deserves
  attention, or a slow pan. (Videos 4, 7)
- **One tightly focused, fact-checked topic**, backed by numbers. (Video 7)
- Vox itself covers political and historical subjects backed by numbers, facts
  and stories. (Video 4)

Video 4 breaks a Vox scene into **five assets**, which is the most reusable
taxonomy in the whole set:

1. **Text** — minimal text pop-up animation.
2. **Main object** — paper-unfolding animation, or a position pop-up.
3. **Background** — does not animate.
4. **Secondary objects** — decorative, subtle static animation.
5. **Camera movement** — zoom in, or a pan around the scene.

Named niches this style works for: finance, documentary, true crime (video 6);
crime & documentary, history, money & power (video 3).

---

# The shared five-step spine

Every one of the eight runs the same five steps. Only the tools change.

1. **Topic + script** — always AI-written, always first, always the thing the
   visuals are built around.
2. **Voiceover** — generated before the visuals, because the visuals are timed
   to it. ElevenLabs in 6 of 8.
3. **Style lock** — a reference image, a design guide, or an approved board set,
   established once and reused on every scene so nothing drifts.
4. **Images per scene** — generated from the script, all against the same style
   reference.
5. **Image-to-video, then assemble** — each still animated, then all clips laid
   under the voiceover and exported.

Two videos (2, 5) do step 5 in code (Remotion / a Claude-built pipeline).
Six do it in a generation tool plus an editor.

---

# Video 1 — `edrUbfeSPio`: Claude + VidIQ + OpenArt

**Pitch:** create a Vox documentary explainer from scratch, no motion designer,
no After Effects.

**Step 1 — let Claude study real Vox videos instead of guessing.**
Uses **VidIQ**, a free YouTube research tool that pulls real data off YouTube.
Install: open the VidIQ website, blue "install free extension" button at the
bottom of the page, add to browser. No manual connection — the moment the
extension is installed, VidIQ appears inside Claude on its own. Inside Claude:
click the VidIQ drop-down in the prompt bar → a window says "unlock YouTube
insights in Claude" → hit **connect YouTube insights** → an authorization page
→ click authorize.

**Step 2 — get the style guide.** Ask Claude to break down what gives Vox its
look. It returns a **single PDF Vox research document**: structural principles,
notes on handling generation for the best output, and ready-to-use prompt
examples. Two prompt sets — one for generating images, one for animating them.
Every later prompt in the video runs off this one guide.

**Step 3 — generation tool: OpenArt.** Chosen because both needed models live
inside it, so there is no jumping between two subscriptions:
- **GPT Image 2** for images
- **Seedance 2.0** ("C Dance 2.0" in the captions) for image-to-video
- Note stated in the video: **Seedance 2.5 is already inside OpenArt** by the
  time you watch, and is the model to switch to for smoother results.

**Image settings (used on every frame):** left sidebar → image → model = GPT
Image 2 → paste frame prompt → quality = **high** → resolution = **4K**
(because the first frame is the foundation of the whole video) → generate.

**Video settings:** left sidebar → video → model = Seedance 2.0 → set the
generated image as the starting frame → paste video prompt → **audio ON** →
aspect ratio **16:9** → resolution **1080p** → duration **6 seconds** → mode
**normal** → generate.

**Test shot first (the "8-hour myth").** Before building anything real, run one
cheap test to check the paper look survives motion. Claude proposed a
construction-paper clock splitting one day into work, sleep, and everything
else, plus a frame prompt and a video prompt. Result: each part kept its
tactile look while moving, and kept the low-FPS motion style.

**The map technique — the load-bearing trick in this video.**
> "The thing that makes this look clean is that I never actually animate the
> map."

If you tell the AI to animate a map, it redraws the whole thing every frame and
the map stops looking consistent. Instead:
- Generate **frame one**: the clean map, no route.
- Generate **frame two**: the *same* map with the route arrow and a small paper
  tag added, nothing else touched. Done with **add visual references → from
  references**, attaching frame one, plus a prompt that says keep the whole map
  the same and only add the route and the tag.
- Take both to video, use the **start and end frame** option — frame one as
  start, frame two as end. Because the frames are identical apart from the
  route, Seedance has nothing to redraw, so it just draws the arrow across the
  map while the camera pushes in.

Narration line used: *"In 1904, a single trade route turned a quiet port into
the region's lifeline."* Settings: audio on, mode standard, 16:9, 1080p, 6s.

Honest defect noted: the map's colour and texture changed slightly between
frame one and frame two. Praise noted: the map looked "straight out of some
Lord of the Rings movie", damaged edges included.

**The three-frame evidence board — 15 seconds.**
Same method, three images instead of two, each built on the one before:
- Frame 1: board with just the pinned map and the title. Everything else empty.
- Frame 2: frame 1 attached as reference, prompt adds only the evidence — an
  old photo and a newspaper clipping.
- Frame 3: frame 2 attached as reference, prompt adds only the final thing — a
  stamp saying the town was abandoned.

**The one setting that changes:** the start-and-end-frame option takes only two
images. With three, switch to the **text with reference** tab, model still
Seedance 2.0, open **add visual references → from creations**, load all three
boards **in order**, paste the animation prompt (open on an empty board, build
each part up to each frame in turn). Audio on, mode normal, 16:9, 1080p,
duration **15 seconds**.

Narration on that shot: *"In 1891, surveyors marked a new town on this map,
Lodden Creek. 10 years on, its main street was booming. Then the gold ran dry
and the last families left before winter. In 1907, the county closed the book.
Population zero."*

What worked: paper landing on the board looked smooth, so did marker
underlines, the dusty stamp effect at the end, and the narrator's voice stayed
the same start to finish.

**Monetisation:** OpenArt affiliate link in the description.

---

# Video 2 — `7wuYBfE131U`: Claude Code + Remotion (the code route)

**Pitch:** a 47-second Vox style explainer made with only Claude Code and
Remotion. No motion designer, no After Effects, and *no need to know how to
code*.

**Subject of the demo:** the US/Iran peace deal and the decline of the dollar.
Facts stated in the demo VO: oil at **$116 a barrel**, American inflation at a
**3-year high**, a national debt bigger than the entire economy, interest alone
costing more than the entire military.

**Step 1 — storyboard and script as the timeline.** The script *is* the
timeline; each beat maps to a visual. Built as a **table** with columns for:
voice-over line, foreground asset, midground asset, and the image prompt for
both. Everything is derived from the voiceover first.

**Step 2 — lock a visual system.** One common background across all scenes,
same fonts, same accent palette. What changes per scene is only the midground
and foreground cutouts.

**Step 3 — MCP connectors.** Higgsfield and **Magnific** MCP servers connected
to Claude Code. Path: settings → connectors → customize → add custom connector
→ paste the MCP server address. Effect: instead of going to Magnific to fetch
images by hand, prompt Claude Code directly and it pulls them.

**Step 4 — folder architecture.** Each scene lives in its own folder. Each
scene folder holds its own cutouts plus the **shared background**, which is
repeated in every scene folder.

**The three-layer scene model:**
- **Background** — static and locked. This is what produces the Vox feel: it
  looks like one continuous shot instead of many cuts.
- **Midground** — a black-and-white halftone pattern of characters popping up.
- **Foreground** — structures, scenery, ships, whatever the beat needs.

**Making the cutouts.** Start from a transparent image of the character (e.g.
Donald Trump, Khamenei). Then tell Claude Code to make the image black and
white and give it a halftone pattern finish. Result: a magazine/papery texture
instead of a digital look.

**Animating with intent — two functions only.** `spring` and `interpolate`.
Spring produces the pop-up effects. You never have to name them; plain English
is enough. The prompt used verbatim:

> "Animate scene one with the White House spring up first, followed by Donald
> Trump and Kamina right after. Stagger them so they don't all move at once.
> Give me an offset red marker stroke behind each cutout for the midground
> characters."

The offset red stroke gives the signature slight-3D illusion.

**Remotion Studio fine-tuning.** Ask Claude Code in plain English to start (and
stop) the Remotion Studio. If the **prop controls** are not visible, go back to
Claude Code and ask it to give you a prop control for every element on screen.
Then tweak scale and X/Y position per element — and **save the numbers**, or
they revert. Values actually used in the demo: Trump scale **1.4**, White House
scale **1.5 → 1.6 → 1.8**.

Errors during setup are normal — "fix this error, please" was enough.

**Other scenes shown:** a debt-transition scene; an oil-tanker scene using a
**green-screen ocean video downloaded from Magnific** with the background
removed, plus a number popping up to show oil prices spiking; a
debt/inflation scene with a line chart popping up alongside a US map.

**Assembly.** Get Claude Code to stitch all scenes into one video in order,
each playing for as long as its part of the voiceover, so they run back-to-back
as a single film.

**Voiceover.** ElevenLabs → text-to-speech → voice **"Kate", a cinematic
British RP narrator** → generate → download → drop into the project folder.
Then the sync prompt, verbatim:

> "Embed the voice-over into the composition and sequence the scenes to it.
> Each scene should start and end on its own narration."

**Music, Foley, render.** Add music and background sound for polish. Known
quirk: **audio sounds jerky when scrubbing in Remotion Studio — this is a
Remotion thing and it renders clean.** Final step: ask Claude Code to render
the whole thing as a **1080p MP4** with music and voiceover mixed in. Or export
the composition alone and do audio in Premiere Pro.

---

# Video 3 — `ZhfHjf_0E-Q` (Hindi): the free / phone-friendly route

**Pitch (paraphrased from Hindi):** Vox style videos are trending hard right
now; here is a tool set that makes them **free**, so you can start in this
niche with no investment. Explicitly says **the whole thing can be done from
your phone**.

**Step 1 — topic and script in ChatGPT.** Warning stated: a normal prompt gives
you the same tired topics and scripts, and viewers skip in 10 seconds. So the
video supplies a command via a **Google Doc link in the description**, plus a
**PDF** (also linked in the Doc) that ChatGPT asks you to upload. Flow: paste
the command → ChatGPT asks for the PDF → download it from the Doc → upload →
enter. ChatGPT then offers niches: **crime & documentary, history, money &
power**, and more, or type your own. Demo picks money & power → copy a topic
back in → then type the **video duration**. Demo uses 30 seconds; the video
says you can put 10 or 20 minutes for a proper long-form video. ChatGPT returns
the full storytelling script.

**Step 2 — voiceover in ElevenLabs, free.** Set the model to **V3** for the
most realistic output. Pick a character voice that fits the story. The stated
trick: **type the word "whisper" at the very start of the script** — it gives
the voice a mysterious feel that suits documentary style. Then paste the script
and click generate speech. Claims a simple trick for using ElevenLabs free, but
the trick itself is not stated beyond "use V3" and picking voices.

**Step 3 — image prompts.** Doing them by hand takes too long, so go back to
ChatGPT and type **"proceed"** → you get a complete framework of **13 scene
prompts** → type **"next"** → a text file arrives with all image prompts in one
place.

**Step 4 — bulk images in Google Flow.** Sign up at Google Flow. Enable the
**Agent** option and click it → **settings** → output = **1** → image model =
**Nano Banana Pro** → video output also **1**. Then click the option → **add
instructions** → copy a command from the command file → paste into Google Flow
→ click **Done**. Then paste all the image prompts from ChatGPT at once —
**Google Flow generates every image in one go**, no one-by-one.

**Step 5 — image to video, without extra credits.** Deselect the **Agent**
option. Click the image you want to animate → **add to prompt** (so Flow uses
that image as reference and animates that exact scene). Then settings →
duration = **6 seconds**. For the prompt: go back to ChatGPT, type **"next"**
→ a universal video prompt appears. **Gotcha: that prompt is written for a
10-second video while Flow is set to 6 seconds** — fix it with a correction
command from the Google Doc, pasted into ChatGPT. The final video prompt then
works, and **the same prompt can be reused on every image**. Convert the images
one at a time.

Also stated: if credits run out, continue from another account that has credits
available.

**Step 6 — quality.** Google Flow downloads top out around **720p and 1080p**.
For serious long-term YouTube work that is not enough, and a blurry video
undoes the professional look. So use a third-party enhancer (named in the
captions as "hit povik pia" — **transcription is garbled, tool name unreadable**;
its home page has a **video generator** and a **video enhancer**). Its video
generator offers **Pixverse, Kling, Seedance and Google Veo**; demo picks
**Seedance 2.0**. Enhancer settings given exactly: model **general
restoration**, **detail of restoration = 100**, **sharpen = 35**, **de-noise
= 15**, resolution **4K**, FPS your choice (60 fps possible, demo leaves it on
auto). Always click **preview** to check the before/after difference before
exporting.

**Step 7 — assemble in CapCut.** Chosen because beginners and pros can both use
it. Import all clips → **add the audio to the timeline first**, because the
whole video runs to the audio → then add every video clip. You will notice the
audio is short and the video is long: select all videos in the timeline →
**speed** → adjust until total video length roughly matches the audio. Then
click the audio → **normalize loudness** → set volume to **-10** so the voice
is neither too loud nor too low. Check the whole timeline start to end, then
export.

**Thumbnail.** Do not forget it — however good the video, nobody clicks an
unclickable thumbnail. The creator has an AI command that makes
professional-level thumbnails from one prompt; it is in the same Google Doc but
**locked behind 500 comments saying "thumbnail"**.

The video ends with a demo VO about the **February 4th 2016 Bangladesh Bank
heist** — roughly three dozen payment orders through Bangladesh Bank's account
at the Federal Reserve Bank of New York, most stopped by an automated check,
**$81 million** vanished into casinos and accounts in the Philippines, and the
mastermind was never named. (Caption quality is poor here; the numbers are
transcribed as "five three 81 million" and are only partly legible.)

---

# Video 4 — `PaXuebdY75U`: teaching Claude three "brains" (the most systematic)

**Pitch:** six Vox style animations, all made entirely with AI, using nothing
but Claude — even if you have never used AI to edit video.

**Step 1 — script.** Prompt used, paraphrased from the video: a **60-second Vox
documentary script**, covering **one subject across six different settings**,
required to include **facts, numbers, graphs, a historical event, and a simple
story**, just like Vox. Result included real variety: a numbers section, a
graph section, a human example, and a short story.

**Step 2 — voiceover.** ElevenLabs → text to speech → paste the script → voice
**"Alex the business book narrator"** → speed **medium** → generate.

**Step 3 — the Vox editor brain (skill 1).** Out of the box Claude does not
know how to edit a Vox documentary, so train it:
- Download **10 Vox documentaries** you like, all full of animations built
  around what the script says.
- In ElevenLabs use **speech-to-text**: click transcribe → select the
  **YouTube** tab → paste each URL → after processing you get the full script
  with **timestamps**, i.e. exactly what is said and when.
- Export each as **JSON** and download.
- Feed all of it to Claude: study these documentaries and their scripts,
  analyse what is being said, look at the video, analyse what is being shown,
  and **deduce why**.

Output: a complete guide to how Vox editors think when choosing scenes. Turned
into a downloadable Claude **skill**.

**Step 4 — the Vox design brain (skill 2).**
- Collect references: search Pinterest for **"vox documentary animation
  design"**, spend **~15 minutes** collecting **100 high-quality designs** that
  fit the style.
- Lay them all out in a **Figma file** as an inspiration wall.
- Export the Figma wall as PDF, upload to Claude, prompt it to study every
  design and find the patterns and design systems that make up the Vox style —
  **colours, shapes, text, objects, macro designs, micro details, textures**.

Output: an in-depth PDF, "Vox design guidelines". Called **the most important
part** of getting the six animations right. Turned into skill 2.

**Step 5 — the Vox animator brain (skill 3).** Claude cannot watch animations,
so the creator went through multiple Vox scenes and **manually explained
everything happening** — which produced the five-asset taxonomy quoted at the
top of this file (text / main object / background / secondary objects / camera
movement).

**Why a generation platform is still needed.** Claude knows the design but
cannot generate images. Higgsfield ("Hicksfield" in the captions) generates
image, video and audio. So Claude is the brain and Higgsfield executes.
Connect: go to the Higgsfield MCP page → copy the MCP link → in Claude click
**Customize Connectors → add → add custom connector** → paste the link.

**Production run, three steps.**
1. **Plan the edit.** Prompt Claude to load all three skills, upload the
   script, and use the editor brain to plan every scene. Output shape: every
   phrase in the script gets a breakdown of what the big focus should be, plus
   a guide to what the design must include. Worked example, scene by scene:
   - Scene 1 (attention span 2½ min in 2004 → 47 seconds now): a year counter,
     then a character on the left with text highlighted on the right, then a
     clock with text overlapping it.
   - Scene 2 (Tokyo to Toronto, worldwide): a map animation of both cities,
     then a global map with red circles on each city.
   - Scene 3 (decline year by year, 2007 iPhone): a graph with a circle around
     2007, then a micro shot of the graph.
   - Scene 4 (the average worker, email checking, apps designed for it): a
     character reveal in the middle, then a two-object scene with a MacBook,
     then a big circle closing the scene.
   - Scene 5 (workday split into percentages): a circle graph around the
     character highlighting each percentage.
   - Scene 6 (closing quote): the text on screen with extra design assets.
2. **Design the scenes.** Prompt Claude to use the design brain to design every
   planned scene the way Vox would — rough paper, textures, fonts — with a
   stated accent colour (**blue-teal** in the demo), executed through
   Higgsfield. Processes a few minutes, then returns designs per scene.
   Honest defects noted: the scene-2 maps "could have been done much better".
3. **Animate.** Prompt Claude to use the animator brain to turn each scene into
   a Vox style animation using **Seedance 2.0 inside Higgsfield**, told
   explicitly to use the **rough, choppy, jittery Vox look** on everything and
   to transition between the designs within a scene so the edit flows.

**Cost, stated plainly:** animation is the step that costs the most in credits.
> "this whole edit from zero cost me around **$20 in Higgsfield credits**, and
> that's with testing."

**Final assembly:** download the six animations, import into **Premiere Pro**
with the voiceover, align each where it belongs, and add a **mysterious
synth-wave soundtrack** that felt like Vox.

**Honest defect list from the animation pass:** scene 2 "could still use some
work"; scene 3's transition was "rough" though the animation looked amazing.

**Demo VO facts (for reference, from the finished edit):** 2004 average focus
**2½ minutes**, today **47 seconds**; every country that got smartphones got
the same problem; attention span falls off a cliff at **2007**, the year the
iPhone shipped; the average worker checks email **74 times a day**; her workday
is **60% fragments shorter than 10 minutes** and **only 3%** deep focus.

**Closing argument (worth noting as an angle):** AI has killed the need to learn
complex styles and programs. What is left to learn is **content psychology,
good design, and how to edit with AI**. The thing to worry about is not AI
taking editing jobs — it is other editors learning this before you.

**Monetisation:** the three skills are gated behind the creator's "Ultimate
Editors" course / "AI editing fundamentals" course.

---

# Video 5 — `TiycelzfzC0`: Claude Code builds you a `/vox-video` command

**Pitch:** fully automated Vox style motion graphic video from **just Claude
Code and Gemini Omni**. The finished system is one slash command: type
`/vox-video`, say what it should be about, and it returns the final video ready
to watch and download. Demo output was **38 seconds**; you can make it longer
by specifying that in the prompt.

**Attribution stated in the video:** the prompts were **reverse-engineered from
a Framework Explained video**, linked in the description.

**Costs, itemised:**
- **Claude Code — $20/month** (to build the system).
- **Kie AI — ~$3.50 per 35-second chapter.** Four 35-second chapters = 4 × 3.50
  for one longer video.
- **ElevenLabs — free**; the next plan up is **~$6** if you burn a lot of
  credits.
- Kie minimum top-up demonstrated: **$5**.

**Build setup.**
- Download the **Claude desktop app** from **claude.com/download** — search
  "Claude download" and make sure it is the official site.
- Once logged in, make sure you are on **Code** in the top left. Collapse the
  sidebar.
- Click the file icon → **open folder** → create a new folder wherever you want
  (demo uses the Desktop, folder named "Vox videos") → select folder.
- Start a **new session**. Model used: **Fable 5**; the video says **Opus 4.8**
  works too. **Bypass permissions mode** used to speed things up — stated as
  optional.
- Paste the big build prompt (from the description) and hit enter.

**Four files you must drop into the project folder** (links in the
description): they are prompt guidelines for how to prompt the videos, how to
prompt the images, and **one example style reference image**. The build prompt
asks about them, so add the files first, then answer "I'll add them myself".

**Questions the build asks, and the demo's answers:**
- Reference image / prompt guideline files missing → "I'll add them myself".
- Aspect ratio → **16:9 landscape**.
- ElevenLabs narration voice → "pick a good default".
- Background music source → "I'll drop files in a music folder". Demo pasted
  one song, found by searching YouTube for **"intense violin"**. Noted: Claude
  finds the song regardless if it is anywhere in the project files.

**What the built system actually does — five steps:**
1. Take the prompt (e.g. "the AI bubble").
2. Generate the speech, **split into four or more separate parts**.
3. Generate one reference image per speech part, each **based on what that part
   says** ("the door opened" → a door opening).
4. Every image generated **against the same reference image**, so all share one
   style.
5. Turn each image into video with **Gemini Omni**, using the speech itself as
   context for the video prompt so the action lands when the line lands. Then
   combine all clips into the final video.

**The regeneration advantage:** if you dislike video number two, tell Claude to
regenerate just that one and it still combines all the others into the final
cut.

**API keys, both into `.env` in the project folder:**
- **ElevenLabs** (speech): sign in → bottom left **developers** → **API keys**
  at the top → **create key** on the right → turn **off** "restrict key" →
  create key → the key shows **once**, copy it → paste after `ELEVENLABS_API_KEY=`
  in `.env` → File → Save.
- **Kie** (images and videos): sign in → **billing** on the left → add credits
  (as little as **$5**) → **API keys** on the left → **create new key** → **all
  models** → name it → create → copy → paste after the `=` in `.env` → save.

**Gotcha:** the `/vox-video` command **often will not show up until you restart
Claude**. Close and reopen, stay in the same project folder, start a new
session.

**Output location:** past videos live in the **output** folder.

**Usage notes given at the end:**
- Leave the prompt **empty** and it invents a random news/politics video.
- Put in "the USA" and it uses whatever is happening there currently.
- For length, say "make it three chapters" / "four chapters" — **each chapter is
  about 30 to 40 seconds**.
- For personal changes, **come back to the same session you built it in**, so it
  still has context.
- Framing of Vox itself: their most popular videos do really well, and at that
  scale "this channel is now a company and an entire business in itself".

**Demo VO facts:** 10 companies are **41% of the S&P 500**, more concentrated
than the dot-com peak; Big Tech will pour **$725 billion** into AI data centres
this year (**up 77% in one year** in the second run); Nvidia invests **$100
billion** in OpenAI; OpenAI buys **$250 billion** of computing from Microsoft;
OpenAI spends **$60 billion** a year on compute while earning **$13 billion**;
second run cites **over $800 billion in circular deals** and OpenAI losing
**$14 billion** this year, with central bankers calling it "dot-com deja vu".

---

# Video 6 — `WCDhGKNVrKU`: everything inside Abacus AI

**Pitch:** automate the whole process using **one AI tool**. Claims a Vox style
animation made in **under 15 minutes**.

**Three PDF prompts** drive the whole thing, distributed through the creator's
**free Telegram community**:
1. Ideation and script.
2. Image prompt generator.
3. Editorial paper animation prompt.

**Step 1 — idea and script.** Log in to Abacus AI → click the **plus icon** →
**upload from your computer** → select PDF 1. Then type something simple: *"I
want to make a finance documentary."* (Change that one word for true crime, and
give a sample of the kind of videos you want.) Choose the chat model at the
bottom — the creator prefers **GPT-5** ("GPT soil" in the captions) over
**Claude Fable 5**, because GPT gives exactly what they want. Click **generate**
→ **10 video ideas** → pick one by typing its number. Demo picks J.P. Morgan.
Then it asks how long the video should be — 30 minutes or 1 hour are options;
demo picks **1 minute**.

**Step 2 — image prompts.** Upload PDF 2. Before clicking generate you must
type something, e.g. *"Give me scene prompt."* → generate → it returns the image
prompts.

**Step 3 — bulk images.** Highlight and copy the prompts. **Right-click the tab
and duplicate it** — do not close the first chat, you still need it for the
animation prompts and the voiceover. In the duplicate: click **image video** →
this opens **Abacus AI Studio** → paste the prompts → change **auto** to **Nano
Banana Pro** (stated: GPT Image did not give as good a result as Nano Banana) →
change **auto** to **16:9** → generate. All images generate at once: **12
images in about 1 minute.** Explicit instruction: do not generate them one
after another.

**Step 4 — animation prompts.** Back in the first chat: plus icon → upload PDF 3
(editorial paper animation prompt) → type *"Give me the animation prompt for
each scene."* → generate → copy all the animation prompts.

**Step 5 — animate.** Go to the chat where the images were generated, paste the
animation prompts → change **image** to **video** → click **auto** and pick the
video model. Models discussed: **VEO 3** ("creates these videos very well, it
adds a lot of sound effects and motion"), **Seedance 2.0** (the demo's choice),
and **Gemini "Onion" Flash** if you are short on credits. Settings given
exactly: duration **8 seconds** ("for videos like this, leave it at 8 seconds
to get the best result"), aspect ratio **16:9**, resolution **720p** ("to get
the best quality"). Generate. Abacus uses the earlier images as reference, so
every clip inherits the style. Download the clips.

**Step 6 — voiceover.** Back in the first chat, type *"Give me the narration."*
→ copy the narration → click **image to video** to reach Abacus AI Studio →
paste the narration → change **image** to **speech** → change **auto** to
**text-to-speech** → choose the provider (creator picks **ElevenLabs**) → click
**flash** and change it to **ElevenLabs V3** for the best-sounding voice →
generate → three dots at the side → download.

**Step 7 — assemble in the Abacus video editor.** Import icon → select all the
studio videos **and** the voiceover → **add the voiceover to the timeline
first** → then add the animations one after another, **listening to the voice to
know exactly where each clip goes** → export.

**Demo VO subject:** October 1907, New York City — Wall Street collapsing,
banks failing, no central bank, J.P. Morgan summoning the most powerful bankers
to his private Manhattan library, examining their finances, deciding which
institutions survive, organising emergency loans, moving millions into the
system, locking financiers inside the library until they agreed to a rescue
plan. Payoff: it worked, but it exposed that America's economy depended on one
unelected banker — which convinced lawmakers the country could never again rely
on a single private citizen.

**Monetisation:** Abacus AI affiliate link in the pinned comment.

---

# Video 7 — `Jkt4aTOpqpM`: OpenArt Director, one chat end to end

**Pitch:** take any topic, turn it into a narrated explainer, and lay motion
graphics on top, even if you have never opened editing software. Framed as
**"vibe directing"** rather than editing. Everything runs inside **OpenArt
Director** — chosen because the whole thing lives in one chat where you write
the scripts and design the scenes.

**Rebuttal of the common assumption:** the style used to take years of editing
skill and a full studio. "To be fair, they might have been right a few years
ago, but that's just not true anymore."

**Step 1 — the script carries the video, not the graphics.** In OpenArt, left
column → **director** → the big chat box in the middle. Two modes: ask it to
guide you step by step, or skip straight to the finished video. Demo uses
**guide me**, for full control and adjustments along the way. Topic: how an
Amazon package reaches you in two days.

**The script builder template** (in the creator's free prompt pack) does three
specific things:
1. Tells the director the **format**.
2. Hands over the **surprising angle** you want to land.
3. Feeds the **real verified facts up front**, with one firm instruction: **do
   not invent a single number beyond them.**

The director returns a real explainer structure — **hook, buildup, payoff** —
not plain text. Then: never take the first pass as final, and you do not have to
re-prompt the whole thing. **Click into the script and edit it like a Google
Doc**, tighten it, double-check every number against real data, save. The
director then locks it in.

**Step 2 — lock the style before generating anything.** Stated as a wall you
will hit otherwise, no matter how advanced the tool: every scene comes back with
inconsistent style and voice, clunky motion, and alien text.

> "Don't just describe the style and hope it sticks."

Instead, paste the style prompt, have the director generate **a few boards
first**, pick the frames that nail the look, and **approve** them — the director
then holds that same style across every scene. When the first boards came back
generic, the fix was plain English: *"a modern collage look, real cutout photos
in bold flat colour, grayscale subjects against coral and navy and cream"* — and
it rebuilt every board to match. Before/after: generic flat blue boards with
plain icons → bold collage frames with real cutout photos popping off the
background.

**Step 3 — build the audio base before any motion.** In an explainer the
narrator plus the music set the mood before the visuals take over; get those
wrong and nothing else saves it.
- **Narrator audition:** ask the director for **10 voices, five male and five
  female**, each reading your script. The first few sounded flat and robotic;
  the fourth was the pick. Chosen quality: *warm, calm, and a little curious.*
- **Music audition:** ask for **10 tracks varying in vibe and tone**. Pick:
  warm and calm with just enough tempo to keep things alive without fighting
  the narrator.
- **Copyright warning:** "copyrights and the takedowns that come with them are
  not worth the trouble. So keep your music original."
- Then ask the director to lay voice and music over all the boards in order.
  Result at this stage is a narrated slideshow — cohesive and on-topic, but
  boring. That is expected.

**Step 4 — motion, deliberately restrained.** The bottleneck where most
beginners throw the project away. The common mistake is throwing complicated
animations at every board and praying; even when it works it looks over the top.

> "The trick is to have simple motions per board that are perfectly timed to the
> voice."

Method: break down the base first, then add motion board by board — one pasted
prompt does it. Then ask the director to stitch the final cut, **timed exactly
as in the base**.

**Scale claim:** motion added to all **14 boards** in one go, made in **under 3
minutes**. No batch limits. The session persists — unlike agents that forget
everything when you close the tab.

**Three named failure modes and their fixes** — the most useful part of this
video:
1. **A shot looks off.** Do not start over in a new chat. Type **`@`**, click
   the asset you want fixed, tell the director what is wrong, and it
   **regenerates just that one asset** — your good takes survive. To save time,
   ask for **three to five variations** of that shot and pick the one that got
   it right.
2. **Text glitches into gibberish** (hit hardest). **Lock your captions as
   static graphics and only animate the objects.** The director is great at
   moving pictures but struggles to redraw letters.
3. **One board keeps breaking no matter what.** Stop fighting it and
   **redesign the thing causing the problem.** Worked example: a map for the
   prediction board kept glitching its dots, so it was replaced with *a guy
   thinking over a chessboard* — zero glitches, and a better visual anyway. The
   director always stitches a regenerated scene back into the right spot.

Also admitted plainly: animation glitches and alien text did happen, and they
were costly mistakes.

**Demo VO facts (the Amazon package explainer):** Amazon guessed what your
region would buy and shipped it close to you in advance; **more than 300
fulfilment centres** worldwide; **over 1 million robots**, the largest robot
fleet on Earth; shelves come to the workers; orders picked, packed, labelled,
then sent to a sortation centre and split by zip code; the network splits in two
— far away flies (**over 100 cargo planes** in Amazon's own air fleet, moving
boxes overnight), close enough drives; both land at a delivery station, the last
stop; vans fan out across a **45-mile radius**, each driver running up to **300
stops a day**, roughly **one delivery every 2 minutes**; **over 20 million
packages a day**. Payoff line: *"two-day shipping was never really the trick.
The machine started moving your package before you even knew you wanted it."*

**Closing warning:** "YouTube has been cracking down hard on AI content this
year, and if you're not careful your channel can get banned before you even
finish your first playlist." Leads into the creator's video on building a
monetisable faceless channel in 2026.

**Monetisation:** OpenArt link plus a promo code for **15% off the monthly
plan**; the **annual Wonder Plan** pitched as the best overall value.

---

# Video 8 — `i5-tZegBvxU`: Loop Studio, and the iteration argument

**Pitch and the cost framing:** animation like this used to mean a motion
designer hunched over After Effects for weeks, at **thousands of dollars per
finished minute**. This one was made by **one person in one afternoon**.

**The honest part, and the reason this source matters:**
> "the first version was super terrible. But after a lot of iterations and a lot
> of burnt credits, we finally got to a point where it's super good."

**The claim it makes against the other seven:** in the other AI-Vox videos the
creator checked, people generated the images and then **animated everything
themselves**, because they are good editors. This one is **all AI generated**.

**Version-by-version log** (the actual content of the video):
- **v1** — first try, just finding out what was possible.
- **v5** — visibly better, but a real defect: **two electricity towers, one
  moving into the other and disappearing.** Called out as the kind of mistake
  that simply cannot happen.
- The feedback loop: **click "send to Claude"** → Claude works through it,
  generating the images with the **Higgsfield MCP** in the background, and
  animating them into an end frame. Then in Claude say **"feedback is done"** →
  it collects all the feedback given in the tool and starts working on it → next
  version.
- **v9** — the actual editor on screen. New defect: too long, too many shots
  from behind his back. Feedback: the scene should move faster, more movement.
- **v10** — a zoom-in effect, more distinct scenes one after another. "Already
  way better." New defect: the scenery changes into something that no longer
  looks first-person. Feedback given: *"Please make sure that the person here
  looks like the person in the previous scene."*
- **Final** — the version in the intro.

**The creativity argument, stated as the important point:**
> "Whenever I just let AI do everything itself, the results were pretty flat.
> But the moment I had a great idea for visualizing something, it turned out
> amazing. So make sure to trust your creativity. It is the one thing nobody can
> clone."

**Setup:** the skill ships inside **Loop Studio** (existing buyers get it as a
free update). You install **Higgsfield** and can start immediately in your own
style. Loop Studio is fine-tuned on your styling, so it understands your style
and can create Vox animations in it. Pitched as a big leap specifically for
**intros and documentary style**.

**A direct technical claim:** *"This is not something you can just do with
Remotion."* — i.e. this route is positioned against video 2's approach.

**Demo VO facts:** every AI video watched this year was rendered somewhere real,
in a building; data centres now consume more electricity than entire countries;
the fastest growing slice of that is not chat, it is video.

---

# Cross-source synthesis

## Every tool named, and by whom

| Tool | Role | Named in |
|---|---|---|
| Claude / Claude Code | The brain: script, planning, orchestration, code | 1, 2, 4, 5, 8 |
| ChatGPT / GPT-5 | Script and prompt generation (the free-route brain) | 3, 6 |
| ElevenLabs | Voiceover (and speech-to-text for training) | 2, 3, 4, 5, 6 |
| OpenArt | Images + video in one place; Director mode | 1, 7 |
| Higgsfield | Image/video/audio generation via MCP | 2, 4, 8 |
| Magnific | Cutouts, green-screen assets, via MCP | 2 |
| Abacus AI | Chat + studio + editor, all in one | 6 |
| Google Flow | Bulk image generation, image-to-video | 3 |
| Kie AI | API access to Gemini Omni | 5 |
| Remotion | Code-driven animation and render | 2 |
| Loop Studio | Packaged Vox skill, style fine-tuned to you | 8 |
| VidIQ | Real YouTube data into Claude | 1 |
| Pinterest + Figma | Reference collection for the design brain | 4 |
| Premiere Pro | Final assembly | 2, 4 |
| CapCut | Final assembly (beginner route) | 3 |

**Image models named:** GPT Image 2 (1, 2), Nano Banana Pro (3, 6). Video 6
explicitly prefers Nano Banana Pro over GPT Image.

**Video models named:** Seedance 2.0 (1, 4, 6, and the enhancer in 3), Seedance
2.5 (1, as the newer better option), Gemini Omni (5, called "the number one AI
video model right now"), VEO 3 (6, praised for sound effects and motion),
Gemini Flash (6, the cheap option), Pixverse and Kling (3, listed only).

## Every number, price and setting stated

| Fact | Value | Source |
|---|---|---|
| Claude Code subscription | $20/month | 5 |
| Kie AI per 35-second chapter | ~$3.50 | 5 |
| Kie AI minimum top-up | $5 | 5 |
| ElevenLabs | Free; next tier ~$6 | 5 |
| Higgsfield credits, whole 6-scene edit incl. testing | ~$20 | 4 |
| Old-world cost per finished minute | Thousands of dollars | 8 |
| Image resolution | 4K | 1 |
| Image quality setting | High | 1 |
| Aspect ratio | 16:9 | 1, 3, 5, 6 |
| Video resolution | 1080p | 1, 2 |
| Video resolution (Abacus) | 720p "for best quality" | 6 |
| Clip duration | 6 seconds | 1, 3 |
| Clip duration | 8 seconds "for best result" | 6 |
| Long clip (3-frame board) | 15 seconds | 1 |
| Chapter length | 30–40 seconds | 5 |
| Finished demo lengths | 38s (5), 47s (2), 60s script (4), 1 min (6) | — |
| Enhancer: detail of restoration | 100 | 3 |
| Enhancer: sharpen | 35 | 3 |
| Enhancer: de-noise | 15 | 3 |
| Enhancer: output | 4K, optional 60 fps | 3 |
| CapCut audio normalise volume | −10 | 3 |
| Prop scale values used | Trump 1.4; White House 1.5→1.6→1.8 | 2 |
| Reference designs collected | 100 designs, ~15 min | 4 |
| Vox documentaries studied | 10 | 4 |
| Bulk image generation | 12 images in ~1 minute | 6 |
| Motion added to boards | 14 boards, under 3 minutes | 7 |
| Voice audition size | 10 voices (5 male, 5 female) | 7 |
| Music audition size | 10 tracks | 7 |
| Time-to-finish claim | Under 15 minutes | 6 |

## The consistency problem — the real subject under all eight

Every source hits the same wall and solves it differently. This is the strongest
structural spine available for the video.

| Approach | How it holds style | Source |
|---|---|---|
| One style reference image, reused on every generation | Cheapest; the whole system is built around it | 5 |
| Generate boards, approve them, tool holds them | Approval gate before any scene work | 7 |
| A studied design guide (100 refs → PDF → skill) | Most work up front, most control | 4 |
| Chain frames: each new image references the previous one | Best for building up one scene | 1 |
| Lock the background, change only mid/foreground | Structural, not prompt-based; zero drift | 2 |
| Reuse the earlier images as reference at animate time | Automatic in the tool | 6 |
| Fine-tune the tool on your own style | Packaged product | 8 |

## The "never animate it directly" principle

Two sources arrive at the same rule from opposite directions:
- **Video 1:** never animate a map — generate before/after frames and let the
  video model interpolate, because a model told to animate a map redraws it
  every frame.
- **Video 7:** never animate text — lock captions as static graphics and animate
  only the objects, because the model struggles to redraw letters.

Both are the same insight: **give the model less to redraw.**

## Failure modes named across the set

- Style and voice drift scene to scene (7).
- Alien / gibberish text (7).
- Clunky, over-the-top motion (7).
- Object continuity breaks — two towers merging (8); a character who stops
  looking like himself between scenes (8).
- Colour and texture shifting between reference-chained frames (1).
- Rough transitions between designs inside one scene (4).
- Maps generating badly (4, 7).
- Prompt/setting mismatch — a 10-second prompt against a 6-second clip (3).
- Jerky audio while scrubbing in Remotion Studio — cosmetic, renders clean (2).
- The slash command not appearing until Claude is restarted (5).
- Prop tweaks reverting because the numbers were not saved (2).

## Costs and quality, the two honest positions

- **Cheap and honest about it:** ~$20 in credits for a six-scene edit (4);
  $20/month + $3.50 per chapter (5); free route entirely, phone-only, at the
  cost of 720p/1080p output plus a separate upscale step (3).
- **The iteration tax nobody else mentions:** "a lot of iterations and a lot of
  burnt credits" before it was good (8). Video 4 also says its ~$20 figure
  includes testing.

## Where the sources disagree

- **GPT Image 2 vs Nano Banana Pro.** Video 1 builds on GPT Image 2; video 6
  says it tried GPT Image and "it's not just giving me a good result like Nano
  Banana".
- **Resolution.** Video 1 insists on 4K images and 1080p video; video 6 says
  720p "to get the best quality" for its video pass.
- **Clip duration.** 6 seconds (1, 3) vs 8 seconds "to get the best result" (6).
- **Is AI actually doing the animation?** Video 8 claims the other creators
  animate by hand and only the images are AI. Videos 1, 4, 5, 6, 7 all present
  the animation itself as AI-generated.
- **Remotion vs generative video.** Video 2 builds the whole thing in Remotion;
  video 8 says "this is not something you can just do with Remotion".
- **Which chat model.** Video 6 prefers GPT-5 over Claude Fable 5 for ideation;
  video 5 uses Fable 5 and says Opus 4.8 also works.

## Angles available for the hook

- The consistency wall is the actual skill, not the prompting (all eight).
- "Vibe directing" instead of editing (7).
- One afternoon and one person, versus weeks and thousands per minute (8).
- Creativity is the part AI cannot clone; unattended AI output is flat (8).
- The tool matters less than you think — eight creators, eight stacks, one
  identical five-step spine (cross-source).
- A cost comparison nobody has laid out: ~$20 of credits vs a free
  phone-only route vs $20/month + per-chapter API spend.
- The risk nobody wants to lead with: YouTube cracking down on AI content (7).

---

# Approaches

Six approaches, not eight. The eight sources cluster: two teach the same
all-in-one-chat method with different vendors, and one is a packaged product
wrapping another's method. The owner picks one row, a mix of rows, or something
new built from the splice-in techniques below.

## The six

| # | Approach | Whose | Tools | Real cost | Still done by hand | What breaks |
|---|---|---|---|---|---|---|
| **A** | All-in-one chat | **Skai Generated** (7, 39K views / 33K subs) and **Leo Ai** (6, 16K / 61K) | OpenArt Director *or* Abacus AI | subscription only (OpenArt has a 15% promo; Abacus bundles chat + studio + editor) | almost nothing — one chat does script, boards, voice, motion, stitch | text turns to gibberish; boards come back generic on the first pass |
| **B** | Claude directs, an MCP generates | **Joseph \| Video Editing** (4, the 188K channel) and **Luuk Alleman** (8) | Claude + Higgsfield MCP + ElevenLabs + Premiere Pro | ~$20 in Higgsfield credits for a six-scene edit, testing included | final assembly in Premiere | maps generate badly; transitions inside a scene are rough |
| **C** | Claude Code builds you a machine | **Koen \| AI Content Systems** (5, 1.46x views-to-subs) | Claude Code + Gemini Omni via Kie AI + ElevenLabs | $20/mo + ~$3.50 per 35-second chapter; ElevenLabs free | nothing after the build — type `/vox-video` | the slash command stays hidden until Claude is restarted |
| **D** | Real code, no generative motion | **MoSidd** (2, the 146K-view outlier) | Claude Code + Remotion + Magnific MCP + ElevenLabs | $20/mo + image credits | scale and position tweaks in Remotion Studio | tweaks revert unless the numbers are saved; audio sounds jerky while scrubbing (cosmetic — renders clean) |
| **E** | Free, phone only | **Ai-Seekify** (3, Hindi) | ChatGPT + ElevenLabs V3 + Google Flow (Nano Banana Pro) + an enhancer + CapCut | $0 | most of it — one image at a time, manual CapCut sync | output caps at 720p/1080p, so a separate upscale pass is required; prompt/duration mismatch (10s prompt vs 6s clip) |
| **F** | Buy the packaged skill | **Luuk Alleman** (8) | Loop Studio + Higgsfield | price of Loop Studio | give feedback, it re-runs | author admits many burnt credits and ten versions before it was good |

Approach **A** also draws on **Thomas Creates** (1) for its OpenArt image/video
settings, though that video is closer to a hybrid of A and the frame-chaining
technique below.

The bolt-on brain below is **Joseph's** (4). Techniques 1 is **Thomas Creates'**
(1), 2 is **MoSidd's** (2), and 3, 4, 5 are all **Skai Generated's** (7).

## The bolt-on layer

**Train your own Vox brain** (source 4). Study 10 Vox documentaries plus ~100
Pinterest designs, and turn the findings into three Claude skills: an *editor
brain* (script → scene plan), a *design brain* (scene → Vox-style design), an
*animator brain* (design → Vox-style motion).

Not an approach on its own — it bolts onto A, B or C. Most work up front, most
control, and **the only thing in this whole knowledge base that survives a tool
change**, because it encodes the style rather than a vendor's UI.

## Splice-in techniques

Each drops into more than one approach. This is what a new approach is built out
of.

| # | Technique | What it buys | Source |
|---|---|---|---|
| 1 | **Frame-chaining** — never animate a map. Generate a before still and an after still, let the video model move between them. | Consistency. A model told to animate a map redraws it every frame. | Thomas Creates (1) |
| 2 | **Locked background** — static background, only mid- and foreground move. | Zero style drift, structurally rather than by prompt. Also produces the one-continuous-shot Vox feel. | MoSidd (2) |
| 3 | **Board approval gate** — generate boards, approve them, the tool holds that style everywhere after. | Kills drift before any scene work is paid for. | Skai Generated (7) |
| 4 | **Static captions** — animate objects only, never letters. | Removes the single worst failure mode in the whole set. | Skai Generated (7) |
| 5 | **`@`-asset regeneration** — fix one bad shot in place; ask for 3–5 variations and pick. | The good takes survive. No starting over in a fresh chat. | Skai Generated (7) |
| 6 | **Version feedback loop** — send feedback, get the next version, repeat. | Catches continuity breaks (two towers merging, a character changing face). | Luuk Alleman (8) |

**The principle under 1 and 4:** give the model less to redraw. Two sources
reached it independently, from maps and from text.

## CHOSEN — Approach A, OpenArt Director

**Owner decision, gate 020, 2026-08-27:** *"i like open art approach , 1sst one -
lets go with that.."*, confirmed as **OpenArt Director**, not the manual
image/video panels of source 1.

So the video teaches **Skai Generated's route** (source 7): one chat inside
OpenArt Director does script, boards, voice, music, motion and stitch. The
tutorial's sections are the phases of that route, in the order they are
performed.

**What that makes primary:** source 7 in full — it is the only end-to-end run of
this exact approach in the knowledge base.

**What stays in, as supporting material:**

- **Source 6 (Leo Ai, Abacus AI)** — the same all-in-one shape in a different
  tool. One section at most, on why OpenArt Director over Abacus.
- **Source 1 (Thomas Creates)** — OpenArt's own image and video panels, and
  frame-chaining. Relevant because it is *the same platform*: a viewer who
  outgrows Director drops down to the panels. Also supplies real model names and
  settings (GPT Image 2, Seedance 2.0/2.5, 4K, 6s, 16:9).
- **The five-asset taxonomy and the design vocabulary** (sources 2, 4, 7) — what
  makes a shot read as Vox at all. Needed for the section that explains what we
  are recreating before any tool is opened.
- **Techniques 3, 4, 5** (board approval gate, static captions, `@`-asset
  regeneration) — all three are native to Director, so they are phases of this
  approach rather than splices.

**What is now out of scope, and must not leak into the script:**

- Approach **B** (Higgsfield MCP), **C** (`/vox-video` + Kie), **D** (Remotion),
  **E** (free/Google Flow/CapCut), **F** (Loop Studio).
- Everything specific to them: Higgsfield MCP setup, Remotion `spring`/
  `interpolate` and prop controls, `.env` API keys, Kie pricing, CapCut sync,
  the video enhancer settings, the three "brain" skills.
- Techniques 1, 2 and 6 as *instructions*. Technique 1 (frame-chaining) may be
  named as the principle behind Director's board approach, but the video does not
  teach the two-frame method, because Director does not expose it.

**Per `SCRIPT-PLAN-INSTRUCTIONS.md`:** the rejected approaches get **at most one
section**, saying why A won. Not a second walkthrough.

## Recommendation (superseded by the owner's pick above, kept for the record)

**The bolt-on brain, on top of C, with techniques 1, 3 and 4 baked into the
prompts.** Reason: C is the only approach where the finished artefact is a
reusable command rather than a one-off video, the brain is the only part that
outlives the tools, and 1/3/4 pre-empt the three defects every source hit. No
source in the knowledge base did this combination, which makes it the video's
own contribution rather than a repeat of source 5.

**Cheaper alternative if the owner wants a shipped video fast:** plain A. One
subscription, one chat, no build step — at the cost of teaching nothing that
survives the vendor.

---

# GAPS — questions for the owner

Nothing below is guessable, and this skill does no research. All of these are
questions for you.

**About the video you are making**

1. ~~**Who is this for?**~~ **Called 2026-08-27: beginners with no editing
   background**, the framing Skai Generated used, and the audience Approach A
   suits. Not asked as a gap — an audience the chosen approach implies is a call
   for the session to make, and the owner overrides at gate 040.
2. ~~**Is this a tutorial or a comparison?**~~ **Called at step 010: tutorial.**
   No longer a question the owner is asked — see the "Call the format yourself"
   section of `steps/010-take-knowledge-llm/README.md`.
3. ~~**Which stack do we teach?**~~ **Closed at gate 020: Approach A, OpenArt
   Director** (Skai Generated's route). See the CHOSEN block in the Approaches
   section above for what is in scope and what must not leak in.
4. ~~**Target length?**~~ **Closed 2026-08-27: 22 minutes, eleven sections.**
   Owner: *"i prefer longer videos without making audience bored... always try to
   make as long video as possible."* Derived section by section from what this
   file supports; ~25 min is the honest ceiling and past it the video would be
   repeating itself, which `TASTE.md` T6 forbids. See T6 for the standing rule.
5. ~~**Do you have your own run of this?**~~ **Closed 2026-08-27, and the question
   is retired.** Owner: *"pls always assume that i know things. you can add claim
   about prior experince. assume i have explored tools for yeards and know my
   stuff."* The credibility line is written as fact. See `TASTE.md` T7 and the
   "Which gaps are worth asking" section of `steps/010-take-knowledge-llm/README.md`
   — this class of question is no longer asked at all.
6. ~~**Are we affiliating with any tool?**~~ **Closed 2026-08-27.** Owner: *"yes i
   haave affiliate similarly as skai"* — an OpenArt affiliate, on the same terms
   Skai Generated used (link plus a promo code; Skai's was 15% off monthly, with
   the annual plan pitched as better value). Two consequences: the tool choice in
   section 2 is settled from the outset rather than retro-fitted, and the CTA
   carries the link and the code **in the CTA, not in a section of its own** -
   Skai Generated never had a costs section, only a plug at the end, and the cost
   figures in this file all come from rejected approaches. The disclosure still
   has to be honest — `TASTE.md` T3 means the method is stated before any verdict, so the
   recommendation reads as a finding rather than a placement.

**Facts I cannot verify and will not invent**

7. **Prices go stale fast.** Claude Code $20/mo, Kie ~$3.50/chapter,
   ElevenLabs free tier, ~$20 of Higgsfield credits — all quoted from the
   sources. Confirm each on recording day, or I mark them `[PLACEHOLDER]`.
8. **Model names and versions are already moving.** Seedance 2.0 vs 2.5, GPT
   Image 2, Nano Banana Pro, Gemini Omni, VEO 3, Fable 5 vs Opus 4.8. Which do
   you want stated as current?
9. **The enhancer tool in video 3 is unreadable in the captions** — transcribed
   as "hit povik pia". If you know which tool that is, tell me; otherwise it
   stays `[illegible]`.
10. **The `$81 million` Bangladesh Bank figure in video 3** comes from badly
    transcribed Hindi-accented English captions. Do not treat it as verified.
11. **The demo VO facts** (attention spans, S&P concentration, Amazon logistics,
    the 1907 panic) are all quoted from other creators' scripts. Do we reuse any
    of them as examples, or avoid them entirely?

**Material that is missing**

12. ~~**No video titles or channel names.**~~ **Closed 2026-08-27** — fetched with
    `yt-dlp --skip-download --print`. Titles, channels, subscriber counts, view
    counts, publish dates and durations are all in the Sources table now, and
    every approach and technique is attributed by channel.
13. **No screenshots.** Every UI path in here (menu names, button labels,
    settings panels) is reconstructed from spoken description. If the video
    shows UI, we need real captures.
14. **No results data.** Nothing in these eight tells us whether Vox style AI
    videos actually perform on YouTube — no view counts, no RPM, no retention.
    If you have that, it changes the whole pitch.
15. **The three "brain" skills from video 4 and the four prompt files from video
    5 are gated** behind a course and a description link. We do not have them.
    Does the video need them, or do we teach the method instead?
