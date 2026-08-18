# yt-script-2 — how to operate here

The operating contract lives in the skill:
`pipelines/.claude/skills/yt-script-2/SKILL.md`. The outline format is defined in
[OUTLINE-INSTRUCTIONS.md](OUTLINE-INSTRUCTIONS.md), the script format in
[SCRIPT-INSTRUCTIONS.md](SCRIPT-INSTRUCTIONS.md). Read the skill plus whichever
format file your step needs before doing anything in this folder.

## What this folder is

Owner-supplied knowledge → outline → final AI-VO script → voiceover. **Four
steps**, each gated on the owner asking for the next one.

| Step | In | Out |
|---|---|---|
| 1 | the owner's knowledge (4 shapes) | `knowledge.md` |
| 2 | `knowledge.md` | `outline.md` → the PDF the tutorial maker gets |
| 3 | the maker's completed draft back | `script.md` + `script.vo.txt` |
| 4 | `script.vo.txt` | voiceover audio — **not wired yet** |

The hinge is step 3. The outline PDF goes out to a remote tutorial maker, who
records his screen and writes the demo-specific lines the outline could not know.
What comes back is **his draft**. Step 3 does not write a script — it finalises
his, for an AI voiceover engine: pronunciation, spelling, pacing punctuation,
clear headings, and a hard split between spoken words and production notes. The
incoming draft is stored untouched as `script-draft.md`; every edit lands in
`script.md`.

Step 4 is deliberately open (2026-08-18) — the owner supplies the VO API. Until
then, stop after step 3 and say so. Do not pick an engine, and do not reach for
`../../video/tts/` on your own judgement.

**No research happens here.** The line is ingestion vs. discovery: opening exactly
what the owner handed over (a link, a screenshot, a YouTube URL) is step 1's job;
going and finding more is not. No `dossiers/` reads, no `yt-research/`, no
searching, no following a link discovered inside a source. What the owner handed
over is the whole input.

The outline is written as markdown, then rendered into the PDF the tutorial
maker actually receives.

The `<key>` in `videos/<key>/` is **not** picked here. It is minted once in
[`pipelines/video-registry/`](../../video-registry/CLAUDE.md) via `vreg ensure`,
and is the same string `visuals-flow` uses for the same video. If a video was
already started on the edit side, `ensure` hands back that key instead of minting
a second identity — so never slugify the title and use it directly.

## Layout

```
OUTLINE-INSTRUCTIONS.md    owner-owned — the only authority on outline format
SCRIPT-INSTRUCTIONS.md     owner-owned — the only authority on script format
render-outline.mjs         outline.md -> outline.html + outline.pdf
render-script.mjs          script.md  -> script.html  + script.pdf
videos/<key>/
├── knowledge.md           every source as TEXT — the only input steps 2/3 read
├── sources/               the originals: screenshots, fetched pages, transcripts
├── outline.md             step 2 — the source of truth
├── outline.html           generated, gitignored
├── outline.pdf            generated, gitignored — this is what the maker gets
├── script-draft.md        step 3 INPUT — the maker's draft, stored untouched
├── script.md              step 3 — the final VO script, human-readable
├── script.vo.txt          step 3 — the engine feed. Step 4's only input.
│                          Anything in here WILL be spoken out loud
├── script.html            generated, gitignored
└── script.pdf             generated, gitignored
```

## The four source types

Knowledge arrives in four shapes and all four land as text in `knowledge.md`:

| Shape | How it is ingested |
|---|---|
| Plain-text brain-dump | Pasted verbatim under `## Owner brain-dump`. Never tidied — the mess is signal. |
| Screenshots | Read as an image, transcribed to text (every number exactly as shown). File kept in `sources/`. |
| Website links | Fetched, fact-bearing content kept under `## Source: <url> (fetched <date>)`. |
| YouTube URLs | Transcribed via the `transcribe` skill (`python3 -m common.transcribe fetch`), timestamps kept. |

Full recipes, including what to do when a fetch fails or a price is illegible,
are in the skill. Two rules matter most:

- **Ingestion is not discovery.** Open exactly what the owner handed over.
  Following a link found inside a fetched page, searching, or opening a "related"
  video is out of bounds — `dossiers/` is the discovery library and stays out.
- **A source left as a URL, an image or a path was not ingested.** Steps 2 and 3
  read `knowledge.md` and nothing else.

## Rendering

```bash
node render-outline.mjs <key>            # writes outline.html + outline.pdf
node render-outline.mjs <key> --no-pdf   # HTML only

node render-script.mjs  <key>            # writes script.html  + script.pdf
node render-script.mjs  <key> --no-pdf   # HTML only
```

Two renderers, not one. `script.md` uses a different grammar from `outline.md`
(Voiceover/Notes instead of SAY/SHOW/EDIT lanes, numbered sections instead of
`SECTION:`/beat headings), so `render-script.mjs` is a separate, simpler parser
styled to match. Both take a `<key>` or a direct path to a `.md` file.

No dependencies. PDF export shells out to headless Chrome (falls back to
Edge/Chromium, and prints a "use Cmd-P" message if none is installed).

Send the maker the **PDF** — it opens on anything, works offline, and needs no
explanation. The HTML is the same content if he'd rather have something that
reflows on a second monitor.

### Why the PDF is dark, and why that's load-bearing

It's read on a screen, never printed, and the owner asked for dark. Two details
in the print CSS keep it working, both of which fail silently if removed:

- `print-color-adjust: exact` — browsers strip background colours when printing.
  Without it every lane chip and rules box prints as an identical grey
  rectangle, and the colour coding *is* the layout.
- `@page { margin: 0 }` with the padding moved onto `.wrap` — with a normal page
  margin the dark ground stops at the text area and every page gets a white
  border frame.

Parts deliberately do **not** force a page break. They used to, which left pages
~70% empty in a document that's scrolled rather than bound.

## Why it exists separately from yt-script/

`yt-script/` is hardwired to tier-list comparison videos built from a
Gemini-generated knowledge base — four tiers, pricing screenshots, ranked
Winners, affiliate-link mentions. It ran once. `yt-script-2` was built
deliberately clean (2026-07-31) for any topic, any format, with the owner
supplying the knowledge directly. The two share no files.

## The traps

- **Step 3 is not a writing step.** It finalises the maker's returned draft. A
  session that writes a script straight from the outline has skipped the person
  whose screen time the demo lines come from. No draft back = nothing to do.
- **Both format files are owner-owned, and empty means ask.** Neither is a
  placeholder any more (`SCRIPT-INSTRUCTIONS.md` was filled in 2026-08-11), but if
  either ever reverts to one, stop and ask instead of improvising a format.
- **The markdown is parsed, not just rendered.** `render-outline.mjs` recognises
  specific forms (`**SAY**` alone on its line, spoken copy in a blockquote). An
  unrecognised form falls through to plain prose with no lane, silently. See
  OUTLINE-INSTRUCTIONS.md for the full table.
- **Anything left in `script.vo.txt` gets spoken.** A stray Note, heading, or
  bracketed pronunciation hint in that file is a line the engine reads out loud.
- **Never commit `outline.html/.pdf` or `script.html/.pdf`** — all four are
  gitignored, regenerate them. (`script.html`/`script.pdf` were tracked by mistake
  until 2026-08-18, because `render-script.mjs` shipped without a matching ignore
  rule.)
