---
name: yt-script
description: Turn owner-supplied knowledge into a YouTube outline, then a VO-ready final script. Four owner-driven steps, tabulated in the skill body. Triggers on "yt-script", "yt-script-2" (the old name, still accepted), "outline for <video>", "write the outline", "here's the completed draft", "finalise the script", "make it VO-ready".
user-invocable: true
metadata:
  author: kbtg
  version: 2.0.0
---

# yt-script — knowledge in, outline out, VO-ready script back

Renamed from `yt-script-2` on 2026-08-20, when the original `yt-script` (v1,
tier-list comparison scripts from a Gemini-built KB) was deleted and this pipeline
took its name. There is no v1 any more; it survives only in git history.

Owner-supplied knowledge is the starting input, always ingested first and in full.
The line for **ingestion** (step 1's core job) is still ingestion vs. discovery:
opening exactly what the owner handed over — a link, a screenshot, a YouTube URL —
is ingestion; going and *finding more of the same kind* while transcribing a
source is discovery, and ingestion never does that. It does not read `dossiers/`,
and does not touch `yt-research/`. (The old `yt-script/Guidelines/` it used to
warn about was deleted on 2026-08-20 along with v1 — nothing to consult.)

**This skill does no research** (owner re-confirmed 2026-08-12, reversing a
short-lived 2026-08-11 rule that allowed a research pass). The owner's knowledge
base is the entire input. You may not search online to fill a gap, and you may
not fact-check a claim already in `knowledge.md` against the web. **If something
is missing or looks wrong, ask the owner** — he will supply it. A gap is a
question for him, never a cue to go find the answer.

Working folder: `pipelines/youtube/yt-script/`

```
yt-script/
├── OUTLINE-INSTRUCTIONS.md    how to write an outline    (owner-owned)
├── SCRIPT-INSTRUCTIONS.md     how to finalise a script   (owner-owned)
├── render-outline.mjs         outline.md -> outline.html + outline.pdf
├── render-script.mjs          script.md  -> script.html  + script.pdf
├── render-worksheet.mjs       outline.md -> script-worksheet.md (the write file)
└── videos/<key>/
    ├── knowledge.md           step 1 — every source, as TEXT. The only input
    │                          steps 2 and 3 read
    ├── sources/               step 1 — the originals: screenshots, fetched
    │                          pages, YouTube transcripts. Provenance, tracked
    ├── outline.md             step 2 — the source of truth
    ├── outline.html/.pdf      generated, gitignored — the PDF is what the
    │                          tutorial maker receives
    ├── script-worksheet.md    step 2 — fallback only, if desk is down
    ├── desk-draft.json        local-mode scratch, gitignored
    ├── script-draft.md        step 3 INPUT — the team member's completed
    │                          draft, stored verbatim. Provenance, tracked
    ├── script.md              step 3 — the final VO script, human-readable
    ├── script.vo.txt          step 3 — the flattened engine feed. Step 4's
    │                          only input
    └── script.html/.pdf       generated, gitignored
```

## The four steps

The owner drives every transition. Never advance a step on your own.

| Step | Input | Output | Whose words |
|---|---|---|---|
| 1 | the owner's knowledge (4 shapes) | `knowledge.md` | the owner's |
| 2 | `knowledge.md` | `outline.md` + PDF (read) + `script-worksheet.md` (write) | yours |
| 3 | the team member's completed draft | `script.md` + `script.vo.txt` | his — you finalise them |
| 4 | `script.vo.txt` | voiceover audio | **not wired yet** |

Step 2's PDF leaves the building: the owner sends it to a remote tutorial maker,
who records his screen and writes the demo-specific lines the outline could not
know. **What comes back at step 3 is his draft, not yours.** Step 3 is a finalise
pass over someone else's words, not a fresh write — that is the one big change
from how this skill worked before v2.0.0.

### Step 1 — take the knowledge

Triggered by the owner handing over a video title plus knowledge. That knowledge
arrives in four shapes — **a plain-text brain-dump, screenshots, website links,
and YouTube video URLs** — usually several of them in one message. All four are
handled below; all four end up as text in `knowledge.md`.

1. **Get the key from the registry — never slugify a title and use it directly.**
   Propose a `<name>` from the title (kebab-case, short: `n8n-hosting`,
   `best-ai-video-tools`), confirm it with the owner in one line, then from
   `pipelines/video-registry/`:

   ```bash
   KEY=$(node bin/vreg.mjs ensure <name> --title "<the video's working title>")
   node bin/vreg.mjs where "$KEY"
   ```

   `ensure` is idempotent: it mints when the video is new, and returns the key
   another pipeline already minted when it is not. **Use whatever `$KEY` comes
   back — it may differ from the name you proposed**, which means this video is
   already in flight elsewhere; `where` shows which pipelines have a folder for
   it. This key is the video's identity everywhere downstream: it becomes
   `visuals-flow/videos/<key>/` and the Drive filename `<key>-final.mp4`. It is
   minted ONCE and never re-derived from a later wording of the title.
2. `mkdir -p videos/<key>/sources/`
3. **Ingest every source the owner gave** into `videos/<key>/knowledge.md`,
   following the four recipes below. The owner's own words always go on top,
   verbatim; each fetched source follows under its own `## Source:` heading.
4. Read it and report back in **5 lines or fewer**: what the video is about and
   the 2–3 things the knowledge is strongest on.
5. **Name every gap you can see, as a question to the owner**, then **stop**.
   Look for gaps actively — don't wait for him to spot them — but put them to
   him rather than resolving them. Do not write an outline unless he asks.

#### The four source types

The owner hands over knowledge in four shapes, usually mixed in one message.
Every one of them ends up as **text inside `knowledge.md`** — that file is the
only thing steps 2 and 3 read, so a source that stays a URL, an image path or a
file reference is a source the outline writer cannot see.

Two rules hold across all four, during ingestion:

- **Fetching a source the owner handed you is ingestion, not research.** You may
  open exactly what was given and nothing else — never follow a link found inside
  a fetched page, never open a "related" video, never search. Filling a gap or
  cross-checking a stale claim is nobody's job here; it is a question for the
  owner at step 5.
- **Keep the original.** Raw files (screenshots, saved pages, transcripts) go in
  `videos/<key>/sources/`. `knowledge.md` carries the text; `sources/` carries
  the provenance.

##### 1 · Plain text — the owner braindumping

The default, and the most valuable. The owner rambles: opinions, prices, gotchas,
"the thing nobody mentions is…", half-finished thoughts, things in no order.

**Paste it in verbatim, at the very top, under `## Owner brain-dump`.** Do not
tidy it, reorder it, split it into bullets, or turn its fragments into sentences.
Its messiness carries information — a thing said twice is a thing that matters, an
aside is often the real hook, and a sentence trailing off marks where the owner
themselves was unsure. Rewriting it destroys all three signals, and the outline
then reads like a spec sheet instead of like a person who has used the tools.

If a fragment is genuinely unparseable, keep it verbatim anyway and flag it at
step 5. Never delete or guess.

##### 2 · Screenshots — pricing pages, dashboards, UI, chat

Read the image with the Read tool. **A path in `knowledge.md` is worthless** — the
outline writer never sees the pixels — so transcribe what is in it into text.

1. Save the file into `videos/<key>/sources/` with a descriptive name
   (`heygen-pricing-2026-08.png`, not `Screenshot 2026-08-09 at 14.02.11.png`).
2. Read it and write, under `## Source: screenshot — <filename>`:
   - every **number** exactly as shown: prices, limits, tiers, credits, dates,
     percentages, plan names. These are the claims the outline will make on
     camera, and a misread price is the most expensive kind of error this
     pipeline can ship.
   - what the screen **is** (which product, which page, what state)
   - anything visible that is not text and would not survive transcription: a
     greyed-out button, a "most popular" badge, a warning banner, a struck-through
     price.
3. If a number is genuinely illegible, write `[illegible]` — never infer it from
   what the price "should" be, and raise it at step 5.

##### 3 · Website links

Fetch each URL and append its content under `## Source: <url>`.

Record the fetch date on the heading line — pricing and feature pages go stale,
and an outline written six weeks later needs to know how old its facts are:

```
## Source: https://www.heygen.com/pricing  (fetched 2026-08-09)
```

Keep the parts that carry facts — pricing tables, feature lists, limits, the
product's own description of what it does. Drop nav chrome, cookie banners,
footers and unrelated marketing. If a page is JS-rendered and comes back empty or
as a shell, say so in the heading (`(fetch failed — JS-rendered)`), leave it
empty, and raise it at step 5 rather than substituting what you know about the
product from memory.

##### 4 · YouTube video URLs

Use the **`transcribe` skill** (`pipelines/.claude/skills/transcribe/`). It runs a
fallback chain — native captions, then Groq Whisper, then local Whisper — so you
never pick a method by hand:

```bash
cd /Users/kbtg/codebase/personal-stuff/pipelines
python3 -m common.transcribe fetch "<youtube-url-or-id>" \
  --out-dir youtube/yt-script/videos/<key>/sources/<video-id>
```

It prints `{"video_id", "path", "method"}` and writes `transcript.md` at that
path. Lines are timestamped:

```
[00:04] This is a 3.
[00:06] It's sloppily written and rendered at an extremely low resolution
```

Then append the transcript into `knowledge.md` under
`## Source: youtube — <url>  (via <method>)`, **keeping the timestamps**. They are
what lets a later outline point at the exact moment a claim came from, and they
cost nothing to keep.

Notes:

- `method: captions` is free and instant. `groq` needs `GROQ_API_KEY` (from
  `~/.zshenv`) and downloads the audio; `local` is slowest. The chain falls
  through automatically — a result under 300 words is treated as a failure and
  the next method is tried, so a thin caption track will not silently win.
- Force one method with `--method captions|groq|local` when you already know
  captions are missing, or to retry only the leg that failed.
- **Transcribe only the videos the owner listed.** Do not touch `dossiers/` — it
  has its own per-video-id store and its own skill, and this pipeline was built
  deliberately without it.
- A long transcript is fine in `knowledge.md`. Do not summarise it to save room:
  the exact phrasing a competitor used is often the most useful thing in it.

#### `knowledge.md` shape

```markdown
# <video working title>

## Owner brain-dump

<pasted verbatim, untouched>

## Source: screenshot — heygen-pricing-2026-08.png

<transcribed: every number, what the screen is, non-text detail>

## Source: https://www.heygen.com/pricing  (fetched 2026-08-09)

<fact-bearing content>

## Source: youtube — https://youtube.com/watch?v=abc123  (via captions)

[00:04] …
```

### Step 2 — the outline

Triggered by the owner asking for the outline.

1. Read `OUTLINE-INSTRUCTIONS.md` in full and follow it exactly. It is the only
   authority on outline format, length, and section shape.
2. **If that file is still the placeholder** (it says so at the top), stop and ask
   the owner for the outline instructions. Do not improvise a format. (The old
   v1 fallback `yt-script/Guidelines/structure.md` no longer exists — v1 was
   deleted on 2026-08-20 — so there is nothing to fall back to by design.)
3. Write `videos/<key>/outline.md`. Every claim traces to `knowledge.md` —
   there is no other source.
   The outline has **two halves written to different standards**: intro and
   conclusion are finished verbatim spoken copy — full, final, the same words
   that will end up in the script. The body is lane blocks
   (`**SAY**` / `**SHOW**` / `**EDIT**`) the maker walks while freestyling the
   demo on screen, and **`SAY` here stays short — a draft prompt, not a
   finished sentence.** Writing the body as full polished prose collapses the
   outline into a duplicate of the script and defeats the point of having two
   documents (a session did exactly this on 2026-08-11 and the owner caught
   it). The markdown is **parsed**, so the exact forms in
   OUTLINE-INSTRUCTIONS.md matter — an unrecognised form renders as plain prose
   with no lane and nothing errors.
4. Render the read copy: `node render-outline.mjs <key>` → `outline.html` +
   `outline.pdf`. Both gitignored. The PDF is now a **fallback**, not the
   handoff — keep making it, because it is what works if the desk is down.
5. Publish to the script desk:

   ```bash
   cd apps/yt-script-desk
   DESK_ADMIN_TOKEN=… node bin/desk.mjs publish <key>
   ```

   It prints one URL. That URL is the handoff — the maker reads the
   instructions and writes his lines in the same page, with the two kept in
   separate tracks. Nothing else is sent.
6. **Stop and wait for approval.** Do not start the script.

**Instructions never enter the script track.** The desk splits every beat into
two columns: the words that will be spoken on the left, and the recording
notes, edit notes and facts on the right. That separation is the whole reason
the desk exists — the old `outline.pdf` mixed all four in one vertical stream
and the maker could not tell content from instruction at a glance.

A body beat's `SAY` lane is still a short draft prompt, never finished copy. In
the desk it appears in the RIGHT track, labelled **Angle** — an instruction he
reads, not a line he can paste (decisions.md 2026-08-18; enforced by a test in
`lib/beats.mjs`).

`render-worksheet.mjs` still works and still produces `script-worksheet.md` with a bare `target — words` marker.
Use it only if the desk is unavailable.

### Step 3 — the final AI-VO script

Triggered by the owner handing back the **team member's completed draft** — the
outline plus the demo-specific lines the maker could only write after actually
using the tool on screen. It may arrive as a file, a paste, or a link to a doc.

Your job is **not to write the script**. It is to take a human draft and make it
a script an AI voiceover engine reads correctly on the first take: pronunciation,
spelling, punctuation that paces the delivery, clean headings, and a hard split
between the words that are spoken and the words that are not.

1. **Pull his draft down.** From the repo root:

   ```bash
   cd apps/yt-script-desk
   DESK_ADMIN_TOKEN=… node bin/desk.mjs pull <key>
   ```

   It writes `videos/<key>/script-draft.md` — his words, verbatim — and prints
   to stderr one line per beat whose locked copy he edited. It refuses to
   overwrite an existing draft without `--force`, because that file is the
   record.

   If he sent a file or a paste instead (desk unavailable), store it verbatim
   at that same path by hand. Never edit it in place, then or later, and **Diff it against what was sent**: `diff script-worksheet.md script-draft.md`.
2. **Read the edited-line list.** Every line `desk.mjs pull` printed is a place
   he changed copy that was final. Each one becomes its own line in the step-7
   change report. Changing pre-filled copy is legitimate — his screen time may
   have shown it wrong — but it may never pass silently. The original is kept
   in the desk and reachable with its **Restore original** control.
3. Read `SCRIPT-INSTRUCTIONS.md` in full and follow it exactly. It is the only
   authority on voice, structure, the Voiceover/Notes split, and the VO polish
   rules. If it is a placeholder, stop and ask — same rule as step 2.
4. Read the approved `outline.md` and `knowledge.md`. **Every claim in the draft
   must still trace to `knowledge.md`.** The maker will have added specifics from
   his own screen time — a UI label, a step order, a render time. Those are
   welcome. A new *number, price, or product claim* that `knowledge.md` does not
   support is a **GAP**: flag it to the owner. The no-research rule binds here
   exactly as hard as at step 1 — you may not go verify it, and you may not
   quietly correct it from memory.
5. Write `videos/<key>/script.md` — the final, human-readable script. Voiceover
   and Notes labelled and separated, the pronunciation lexicon at the top, pacing
   punctuation applied, parts and sections clearly headed.
   The maker no longer writes `Notes`: pull the matching beat's `SHOW` and `EDIT`
   lanes out of `outline.md` and fold them into `script.md`'s `Notes` blocks
   yourself. That is mechanical — every `Notes` block in the two existing scripts
   is a reworded SHOW/EDIT pair — so it never needed his keyboard.
6. Write `videos/<key>/script.vo.txt` — the **engine feed**. Spoken lines only,
   pronunciation already substituted in, no Notes, no headings, no brackets, no
   stage directions. **Anything left in this file WILL be spoken out loud.** It is
   a separate file precisely so step 4 never has to parse spoken text back out of
   a document that also contains instructions.
7. Render: `node render-script.mjs <key>` → `script.html` + `script.pdf`. Both
   gitignored.
8. **Report the diff and stop.** List every line you reworded, respelled, or
   repunctuated, plus every gap from step 3. The owner needs to see what changed
   in his team member's words — silently improving them is how a claim shifts
   meaning with nobody noticing.

Rules specific to this step:

- **Rewording for the mouth is the job; changing the meaning is not.** Splitting a
  40-word sentence, respelling a product name, or turning a semicolon into a full
  stop is expected. Changing a number, a verdict, a recommendation, or the order
  of an argument is not — flag it instead.
- **Never delete a Note to tidy the file.** A recording instruction the maker
  wrote is his, and dropping it loses something the camera needed.
- **`script.vo.txt` is written by step 3 and read by step 4. Nothing else touches
  it.**

### Step 4 — the voiceover  (NOT WIRED)

**Deliberately left open on 2026-08-18.** The owner will supply the VO API
details. Until he does:

- Stop after step 3 and say plainly that step 4 is not wired.
- **Do not improvise an engine or a call.** In particular, do not reach for
  `pipelines/video/tts/` on your own judgement — it is the likely home, but the
  owner has not chosen it, and picking a TTS engine is an owner-level decision
  (the `video-and-tts-reference` skill covers why that choice is load-bearing).

Three things are already fixed, whatever the API turns out to be:

- **Input:** `videos/<key>/script.vo.txt`, and nothing else.
- **Output placement:** generated audio is media, so it obeys the repo media
  policy — it lands in `~/kb-scratch/video/tts/<pipeline>/` with a manifest row in
  the `pipelines/video/tts` hub's `OUTPUTS.md`. Never inside this folder, never
  committed.
- **The `<key>`** stays the one minted at step 1.

## Hard rules

- **Never skip a gate.** Knowledge → stop. Outline → stop. Final script only once
  the team member's draft is back. Step 4 only once the owner has wired it.
  "The outline is obviously fine" is not approval.
- **Step 3 finalises someone else's draft.** You no longer write the script from
  the outline. If no draft has come back, there is nothing to do at step 3 — say
  so instead of writing one yourself.
- **`script-draft.md` is never edited.** It is the team member's words, kept as
  provenance. Every change of yours goes into `script.md`.
- **Never invent a key.** The video's key comes from `pipelines/video-registry/`
  (`vreg ensure`), never from re-slugifying whatever the title happens to say
  today. A key derived twice from two wordings of the same title is exactly how
  one video became two folders.
- **Never invent facts, and never research them either.** Numbers, prices, names
  and claims come from `knowledge.md` and nowhere else. Anything you can't source
  there, **ask the owner** — don't fill it and don't go look it up. This binds
  hardest on a source that failed to ingest: an empty fetch or an illegible
  screenshot is a GAP, never a cue to write the price you happen to know.
  `[illegible]` in `knowledge.md` is a correct answer. Volatile facts (live
  pricing, free-tier limits) are better left as a `[PLACEHOLDER]` for the
  owner's team to confirm on recording day than stated as fact that will go
  stale.
- **Open only what you were given.** Step 1 opens the owner's links, screenshots
  and videos and nothing else — no following a link found inside one, no opening
  a "related" video, no web search at any point in any step.
- **A source that stays a URL, an image or a file path was not ingested.**
  Steps 2 and 3 read `knowledge.md` and nothing else, so every source has to land
  there as text. Originals go in `sources/` as provenance, not as the record.
- **Never guess a format.** Both instruction files are owner-owned. Empty means
  ask, not improvise.
- **Write nothing outside `videos/<key>/`.** The two instruction files are edited
  by the owner, not by you.
- Re-running a step overwrites that step's file. Say so before overwriting an
  approved `outline.md`.

## Not this skill's job

`yt-research/` (legacy Phase 1) and `dossiers/` (persistent per-tool research
library) are separate systems. This skill was built deliberately without them —
don't read from them, don't write to them. (The old v1 `yt-script/`, comparison
videos from a Gemini-built KB, was deleted on 2026-08-20; this folder is now the
only `yt-script/`.)

`dossiers/` is the tempting one, because it also transcribes YouTube videos and
would happily tell you more about a tool the owner mentioned. That is exactly why
it stays out: it is a *discovery* library with its own accumulation and its own
skill, and this skill's knowledge base is the owner's material and only that.
The shared piece is one level lower — both use the `transcribe` skill, which is a mechanical fetcher and holds
no opinions about which videos matter.
