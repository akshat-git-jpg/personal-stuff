---
name: yt-script
description: Turn owner-supplied knowledge into a YouTube outline, then a beat-by-beat script plan, then a VO-ready final script. Fourteen numbered steps with six owner gates, tabulated in the skill body, each with its own folder under pipelines/youtube/yt-script/steps/. Triggers on "yt-script", "outline for <video>", "write the outline", "write the script plan", "publish to the desk", "here's the completed draft", "finalise the script", "make it VO-ready".
user-invocable: true
metadata:
  author: kbtg
  version: 3.0.0
---

# yt-script — knowledge in, outline, script plan, VO-ready script back

Working folder: `pipelines/youtube/yt-script/`

**The flow is fourteen numbered steps, each a folder under `steps/`.** The table
below is the contract. Every step's folder holds a `step.json` (the machine
record) and a `README.md` (what to actually do). Read the step's README before
running it — this file deliberately does not repeat them.

```
knowledge.md  ->  outline.md   ->  script-plan.md  ->  script-draft.md  ->  script.md + script.json
  (010)           (030)            (050)               (090, his words)     (100)
```

## The steps

| Step | Kind | What it does |
|---|---|---|
| `010-take-knowledge-llm` | [LLM] | Reads everything you hand over into one knowledge file |
| `020-approve-knowledge-human` | **[OWNER]** | You fill the gaps it found, then say go |
| `030-write-outline-llm` | [LLM] | One page: sections and headings only, no script |
| `040-approve-outline-human` | **[OWNER]** | You approve the direction, while it is cheap to change |
| `050-write-script-draft-llm` | [LLM] | Expands the approved outline into the full beat-by-beat draft |
| `055-review-plan-md-human` | **[OWNER]** | You read the raw markdown and get your edits in cheap |
| `060-review-local-desk-human` | **[OWNER]** | You open it on your machine and give feedback |
| `070-publish-desk-run` | [RUN] | Publishes and prints the freelancer URL |
| `080-freelancer-writes-human` | **[OWNER]** | He records, writes his lines, tells you he is done |
| `090-pull-draft-run` | [RUN] | Pulls his completed draft back into the repo |
| `100-write-script-llm` | [LLM] | Finalises his words into the VO-ready script |
| `110-approve-script-human` | **[OWNER]** | You read what changed and approve |
| `120-voiceover-run` | [RUN] | Synthesizes the voiceover per section, then locks the takes |
| `130-learn-from-feedback-llm` | [LLM] | Folds your feedback into rules — run by `yt-script-feedback` |

`ls steps/` is the check that keeps this table honest. A step on disk that is not
in this table, or a row here with no folder, is a bug in the docs.

**Six owner gates: 020, 040, 055, 060, 080, 110. None is skippable.** The owner drives
every transition — never advance a step on your own, and never treat "it looks
fine" as approval.

## Tutorial or comparison — the fork that runs through everything

Every video here is one or the other, and the two shapes diverge at every
writing step. **Step 010 calls it and the session states the call; it is never a
question for the owner.** He overrides at gate 040, which is the last cheap
moment. Owner decision, 2026-08-27.

`outline.md` carries the call on its first line as `Format: tutorial` or
`Format: comparison`, and steps 050 and 100 read it before writing. Where each
file forks:

| File | What forks |
|---|---|
| `steps/010-take-knowledge-llm/README.md` | who makes the call, and the `# Approaches` section a tutorial needs |
| `OUTLINE-INSTRUCTIONS.md` | section shape, and the `Format:` line itself |
| `SCRIPT-PLAN-INSTRUCTIONS.md` | by-factor vs by-phase, and whether a section closes on a `VERDICT` |
| `SCRIPT-INSTRUCTIONS.md` | the walk's structure, scorecards, exact-value rules |
| `TASTE.md` | how T3–T5 read outside the comparison scripts they were seeded from |

**The failure this prevents:** a tutorial written with comparison habits becomes
a ranked survey of approaches instead of a walkthrough of one. It reads fine and
teaches nothing.

## What changed on 2026-08-23 (read this if you remember the old flow)

Three things, all owner decisions:

1. **The outline is now a real outline.** What used to be called `outline.md` was
   never one — it held verbatim intro and conclusion copy plus 25+ beats with
   lanes, which is a draft script. It is now `script-plan.md` (step 050), and
   `outline.md` is a new, earlier, one-page document (step 030) holding sections
   and a card each. The owner approves *direction* there, when changing it is
   still cheap.
2. **The local review gate exists.** The old step 2 published the live freelancer
   URL *before* any owner review, then said "wait for approval" — approval of a
   link that already existed. Publishing is now step 070 and happens only after
   the owner has seen the real UI at 060.
3. **No HTML or PDF.** `render-outline.mjs` and `render-script.mjs` are dropped
   from the flow. The script desk replaced the outline PDF as the handoff, and
   the VO engine reads the per-section `script.json` (`script.vo.txt`, which this
   note originally named, was dropped by plan 252), so nothing read the script PDF
   any more. The scripts still exist in the folder; the flow does not call them.

4. **The markdown gets read before the desk boots (added 2026-08-23).** Step 055
   is a plain read of `script-plan.md` in an editor — no server, no browser. The
   wording and the section order settle there, cheaply, and 060 is left to ask the
   only question the markdown cannot answer: does it work in the two-track UI.

## If the desk is down

`render-worksheet.mjs` still works and is the documented fallback:

```bash
cd pipelines/youtube/yt-script
node render-worksheet.mjs <key>          # -> videos/<key>/script-worksheet.md
```

It turns `script-plan.md` into `script-worksheet.md`, a plain markdown write file
with a bare `target — words` marker per body beat. Send that instead of a URL,
take his completed file back as `script-draft.md`, and check what he changed with
`diff script-worksheet.md script-draft.md`. Steps 070 and 090 are what you are
replacing; everything else in the flow is unchanged.

Retiring it is deferred until one real video has gone end to end through the
desk.

## The files

| File | Written by | What it is |
|---|---|---|
| `videos/<key>/knowledge.md` | 010 | Every source, as TEXT, plus the `# Approaches` menu where the topic has one. The only input later steps read |
| `videos/<key>/sources/` | 010 | The originals — screenshots, fetched pages, transcripts. Provenance, tracked |
| `videos/<key>/outline.md` | 030 | A table of contents plus a card per section. Carries `Format:` and `Target:`. The direction |
| `videos/<key>/script-plan.md` | 050 | The beat-by-beat document the desk publishes |
| `videos/<key>/script-draft.md` | 090 | The maker's completed work, verbatim. Provenance, tracked |
| `videos/<key>/script.md` | 100 | The final VO script, human-readable |
| `videos/<key>/script.json` | 100 | The per-section engine feed. Step 120's input |
| `videos/<key>/respell.json` | 100 | Pronunciation map, applied at synth time |
| `videos/<key>/desk-draft.json` | local desk | Local-mode scratch, gitignored |
| `TASTE.md` | 130 | Your accumulated taste rules, numbered and dated |
| `FEEDBACK-LOG.md` | 130 | Every reaction, tagged. The repeat-detection index |

Two owner-owned instruction files govern the writing steps and are the only
authority on their formats:

- `OUTLINE-INSTRUCTIONS.md` → step 030
- `SCRIPT-PLAN-INSTRUCTIONS.md` → step 050
- `SCRIPT-INSTRUCTIONS.md` → step 100

## Ingestion is not research

**This skill does no research.** The owner's knowledge base is the entire input.
Opening exactly what the owner handed over — a link, a screenshot, a YouTube URL —
is ingestion. Going and *finding more of the same kind* is discovery, and
ingestion never does that. You may not search online to fill a gap, and you may
not fact-check a claim already in `knowledge.md` against the web. **If something
is missing or looks wrong, ask the owner** — he will supply it. A gap is a
question for him, never a cue to go find the answer.

## Hard rules

- **Never skip a gate.** 020, 040, 055, 060, 080, 110. "The outline is obviously fine"
  is not approval.
- **Never publish before 060.** Publishing mints a live secret URL. Reviewing
  after that is reviewing something already shipped.
- **Never ask the owner whether a video is a tutorial or a comparison.** 010
  decides; gate 040 is where he overrides.
- **Never name an approach without its detail.** The owner picks the approach at
  gate 020, so a list of tool names with no cost, no steps and no failure modes
  hands the decision back with the evidence removed.
- **Never ask whether the method works, and never ask about the owner's
  experience.** The sources prove the first; `TASTE.md` T7 settles the second.
  Write the credibility claim as fact and let him correct it at review.
- **Never pad to hit a length target.** `TASTE.md` T6 wants the video as long as
  the material honestly carries, and says plainly that repetition breaks the rule
  rather than serving it. Name the ceiling at the gate instead.
- **Step 100 finalises someone else's draft.** You do not write the script from
  the script plan. If no draft has come back, there is nothing to do — say so
  instead of writing one yourself.
- **Pronunciation lives in `respell.json`, never in the script.** A respelling
  typed into `script.md` is applied twice. The engine owns pronunciation
  (`pipelines/video/tts/lib/spoken.mjs`).
- **`script-draft.md` is never edited.** It is the maker's words, kept as
  provenance. Every change of yours goes into `script.md`.
- **Never invent a key.** It comes from `pipelines/video-registry/` (`vreg
  ensure`), never from re-slugifying whatever the title says today. A key derived
  twice from two wordings of one title is how one video became two folders.
- **Never invent facts, and never research them either.** Numbers, prices, names
  and claims come from `knowledge.md` and nowhere else. This binds hardest on a
  source that failed to ingest: an empty fetch or an illegible screenshot is a
  GAP, never a cue to write the price you happen to know. `[illegible]` is a
  correct answer. Volatile facts (live pricing, free-tier limits) are better left
  as `[PLACEHOLDER]` for the owner to confirm on recording day than stated as
  fact that will go stale.
- **Open only what you were given.** No following a link found inside a fetched
  page, no opening a "related" video, no web search at any point in any step.
- **A source that stays a URL, an image or a file path was not ingested.** Later
  steps read `knowledge.md` and nothing else.
- **Never guess a format.** The three instruction files are owner-owned. Empty
  means ask, not improvise.
- **Write nothing outside `videos/<key>/`.** The instruction files and the step
  folders are edited by the owner, not by you.
- **Say so before overwriting an approved file.** Re-running a step overwrites its
  output.

## Changing the flow

Each step is a folder, so changing one is local:

- **Edit a step** — change its `README.md`. Change `step.json` only if what it
  reads or writes changed.
- **Add a step** — make `steps/NNN-verb-thing-kind/` with a `step.json` and a
  `README.md`, and add its row to the table above. Numbers go up in tens so there
  is room to slot one in.
- **Kinds** are `llm` (Claude writes it), `run` (a command), `human` (the owner
  decides). A `human` step with a `gate` field is a hard stop.

## Not this skill's job

Feedback on what this skill produced is a separate skill: `yt-script-feedback`.
It runs step 130. Do not fold feedback into a rule from inside an operating
session — rule surfaces change between videos, never during one.

`yt-research/` (legacy) and `dossiers/` (the persistent per-tool research library)
are separate systems. This skill was built deliberately without them — don't read
from them, don't write to them.

`dossiers/` is the tempting one, because it also transcribes YouTube videos and
would happily tell you more about a tool the owner mentioned. That is exactly why
it stays out: it is a *discovery* library with its own accumulation and its own
skill, and this skill's knowledge base is the owner's material and only that. The
shared piece is one level lower — both use the `transcribe` skill, a mechanical
fetcher that holds no opinions about which videos matter.
