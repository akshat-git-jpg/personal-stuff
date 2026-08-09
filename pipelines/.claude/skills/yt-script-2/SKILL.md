---
name: yt-script-2
description: Turn a knowledge base the owner supplies into a YouTube outline, then optionally a full script. Owner gives topic + knowledge; writes the outline per pipelines/youtube/yt-script-2/OUTLINE-INSTRUCTIONS.md and stops for approval; writes the full script only when asked. Triggers on "yt-script-2", "outline for <video>", "write the outline", "now write the script", "script from this knowledge", "here's the knowledge base for <video>".
user-invocable: true
metadata:
  author: kbtg
  version: 1.3.0
---

# yt-script-2 — knowledge in, outline out, script on request

Owner-supplied knowledge is the ONLY input. This skill does no research: it does
not fetch transcripts, does not read `dossiers/`, does not touch `yt-research/`,
and does not consult the old `yt-script/Guidelines/`. If the knowledge is thin,
say so and ask — never fill the gap by inventing or by going and researching.

Working folder: `pipelines/youtube/yt-script-2/`

```
yt-script-2/
├── OUTLINE-INSTRUCTIONS.md    how to write an outline  (owner-owned)
├── SCRIPT-INSTRUCTIONS.md     how to write a script    (owner-owned)
├── render-outline.mjs         outline.md -> outline.html + outline.pdf
└── videos/<slug>/
    ├── knowledge.md           step 1 — exactly what the owner gave
    ├── outline.md             step 2 — the source of truth
    ├── outline.html/.pdf      generated, gitignored — the PDF is what the
    │                          tutorial maker receives
    └── script.md              step 3
```

## The three steps

The owner drives every transition. Never advance a step on your own.

### Step 1 — take the knowledge

Triggered by the owner handing over a video title plus knowledge (pasted text,
links, a file path, or several of these).

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
2. `mkdir -p videos/<slug>/`
3. Write everything the owner gave into `videos/<slug>/knowledge.md`, **verbatim**.
   Do not summarize, reorder, or clean it up — this file is the record of what
   you were given. If the owner supplied links, fetch each one and append its
   content under a `## Source: <url>` heading, keeping the owner's own text on top.
4. Read it and report back in **5 lines or fewer**: what the video is about, and
   the 2–3 things the knowledge is strongest on.
5. Name any gap you noticed in one line, then **stop**. Do not write an outline
   unless the owner asks.

### Step 2 — the outline

Triggered by the owner asking for the outline.

1. Read `OUTLINE-INSTRUCTIONS.md` in full and follow it exactly. It is the only
   authority on outline format, length, and section shape.
2. **If that file is still the placeholder** (it says so at the top), stop and ask
   the owner for the outline instructions. Do not improvise a format, and do not
   fall back to `yt-script/Guidelines/structure.md` — that file is a tier-list
   comparison format this skill deliberately left behind.
3. Write `videos/<slug>/outline.md`. Every claim traces to `knowledge.md`.
   The outline has **two halves written to different standards**: intro and
   conclusion are finished verbatim spoken copy, the body is lane blocks
   (`**SAY**` / `**SHOW**` / `**EDIT**`) the maker walks while freestyling the
   demo on screen. The markdown is **parsed**, so the exact forms in
   OUTLINE-INSTRUCTIONS.md matter — an unrecognised form renders as plain prose
   with no lane and nothing errors.
4. Render it: `node render-outline.mjs <slug>` → `outline.html` + `outline.pdf`.
   The PDF is what the tutorial maker receives. Both are gitignored.
5. **Stop and wait for approval.** Do not start the script.

### Step 3 — the full script

Optional. Runs only when the owner explicitly asks for the script after
approving the outline.

1. Read `SCRIPT-INSTRUCTIONS.md` in full and follow it exactly. Same placeholder
   rule as step 2 — if it is not filled in, stop and ask.
2. Read the approved `outline.md` and `knowledge.md`.
3. Write `videos/<slug>/script.md`, following the approved outline's structure.
   Departing from the outline requires flagging it to the owner.

## Hard rules

- **Never skip a gate.** Knowledge → stop. Outline → stop. Script only on request.
  "The outline is obviously fine" is not approval.
- **Never invent a key.** The video's key comes from `pipelines/video-registry/`
  (`vreg ensure`), never from re-slugifying whatever the title happens to say
  today. A key derived twice from two wordings of the same title is exactly how
  one video became two folders.
- **Never invent facts.** Numbers, prices, names, and claims come from
  `knowledge.md`. Anything you cannot source, raise as a gap — don't fill it.
- **Never guess a format.** Both instruction files are owner-owned. Empty means
  ask, not improvise.
- **Write nothing outside `videos/<slug>/`.** The two instruction files are edited
  by the owner, not by you.
- Re-running a step overwrites that step's file. Say so before overwriting an
  approved `outline.md`.

## Not this skill's job

`yt-script/` (comparison videos from a Gemini-built KB), `yt-research/` (legacy
Phase 1), and `dossiers/` (persistent per-tool research library) are separate
systems. This skill was built deliberately without them. Don't reach for them.
