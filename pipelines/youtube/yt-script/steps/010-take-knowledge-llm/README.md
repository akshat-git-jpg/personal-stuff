# 010 - take the knowledge

**[LLM]** &nbsp; Reads everything you hand over into one knowledge file.

The owner's sources - brain-dump, screenshots, links, YouTube URLs - all become TEXT in `videos/<key>/knowledge.md`, with the originals kept in `sources/`. Fetching what you were handed is ingestion; going and finding more is research, and this skill does no research. Ends by calling the video's format, laying out the candidate approaches where the topic has any, and naming every gap it can see as a question.

**Writes:** `knowledge.md`, `sources/`

---

## What happens

1. Mint the key from the video registry - never slugify a title by hand:
   `KEY=$(node bin/vreg.mjs ensure <name> --title "<title>")` from
   `pipelines/video-registry/`.
2. `mkdir -p videos/<key>/sources/`
3. Ingest all four source shapes into `knowledge.md`:
   - **plain text** - the owner's brain-dump, verbatim, at the top, untidied
   - **screenshots** - read the image, transcribe every number exactly
   - **links** - fetch, keep the facts, record the fetch date
   - **YouTube** - the `transcribe` skill, **plus the metadata** (see below)
4. **Call the format** - tutorial or comparison. See below. This is your call,
   not a question.
5. **Write the `# Approaches` section** where the topic has candidate
   approaches. See below. Skip it, and say you skipped it, where it does not.
6. Report to the owner: the 5-line summary, the format call and why, the
   approaches menu, then the gaps. `steps/020-approve-knowledge-human/README.md`
   has the exact shape of that message.
7. Name every gap as a question, then stop.

## Always fetch YouTube metadata

A transcript alone is anonymous. **Every YouTube source gets its channel and
title recorded**, and the numbers alongside them:

```bash
yt-dlp --skip-download \
  --print "%(channel)s|%(title)s|%(upload_date)s|%(duration)s|%(channel_follower_count)s|%(view_count)s" \
  "https://youtu.be/<id>"
```

This is **ingestion, not research**. Metadata about a video the owner handed
over is part of that video. What stays banned is going to find *more* videos.

Owner instruction, 2026-08-27: *"when you give approaches.. i would like youtube
video name and channel name as well. i like some channels so i wll be able to
decide approaches more better"*.

**Why it changes the decision.** The owner follows some of these channels and not
others, so the source is itself evidence he weighs. Views-against-subscribers
also says which angle the audience actually rewarded, which is a real input to
picking an approach and to writing a title later. Stripping the byline throws
both away.

Record it in the Sources table, and **attribute every approach and every
technique to the channel it came from** - by name, not by row number. "Source 4"
means nothing to the owner; "Joseph, the 188K channel" is a decision he can make.

## Call the format yourself

**Tutorial or comparison is your decision.** Owner instruction, 2026-08-27:
*"going forward you can take the call whether a video is supposed to be a
tutorial or comparison"*.

State the call and the one-line reason in the gate message. Do not offer it as
an option and do not put it in the gap list. The owner overrides it at gate 040
if he disagrees, where changing it still costs one page.

The two formats diverge at every writing step after this, so a wrong call is
expensive later and free now:

| | Tutorial | Comparison |
|---|---|---|
| What the viewer wants | to do the thing | to choose the thing |
| Body sections are | the phases of the job, in the order they are performed | the factors, with every option swept inside each factor |
| The conclusion | what to do next, and what breaks | a named winner, per persona |
| Verdicts | none - there is nothing to rank | the whole point |

**How to tell which one the knowledge is:** ask what the viewer cannot do
before watching. If the answer is *perform a job*, it is a tutorial. If it is
*pick between named products*, it is a comparison.

Knowledge with several methods in it is **still a tutorial**. Several methods do
not make a comparison video; they make a tutorial with an approach to choose,
which is what the next section is for.

## Write the `# Approaches` section

**Conditional.** Write it when the knowledge describes **methods** - ways to get
a job done. Skip it when the knowledge describes **products** being judged, and
say in the gate message that you skipped it and why.

Owner instruction, 2026-08-27: *"also show approches by which we can accomplish
the topic.. basically here claude said 8 different tool stacks.. but claude
never shared the details - it should give options for me to choose and i can
combine and give entirely new approach"*.

**What it is for.** The owner chooses which approach the video teaches, at gate
020, because step 030's outline sections *are* the phases of the chosen
approach. He cannot choose from a list of names. He needs enough of each
approach to pick one, and enough of all of them to splice two into one that no
source did.

**Three parts, always:**

1. **The approaches**, as a table. Cluster the sources - N sources are rarely N
   approaches. One row per approach with, at minimum: the tools, the real cost,
   what the owner still does by hand, and what breaks.
2. **The splice-in techniques** - the tricks that are not an approach on their
   own but drop into several of them. This is the part a new approach is built
   out of, so name each one and say what it buys.
3. **Your recommendation**, one line, with the reason. A menu with no
   recommendation hands the work back.

## Do not

- Search the web to fill a gap. Ask the owner.
- Fact-check a claim already in `knowledge.md`.
- Leave a source as a URL or an image path. If it is not text in
  `knowledge.md`, the next step cannot see it.
- **Ask the owner to choose the format.** That is step 4's call.
- **Name an approach without its detail.** A row that says "Claude Code +
  Remotion" and nothing else is the failure this section was added to fix.
- **Attribute by row number.** Every approach and technique names the channel it
  came from. `Source 7` is not attribution.
- **Leave a YouTube source anonymous.** No channel, no title, no numbers means
  the owner cannot weigh who said it.
- **Compress the approaches out of the gate message** to keep it short. The
  5-line cap in step 6 is on the *summary*, and on nothing else.

## Why the brain-dump stays verbatim

Its messiness carries information. A thing said twice matters. An aside is often
the real hook. A trailing sentence marks where the owner was unsure. Tidying it
destroys all three, and the outline then reads like a spec sheet.
