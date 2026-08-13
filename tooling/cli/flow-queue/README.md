# flow-queue

A local relay that hands image-generation prompts to the **ZAPI FLOW** browser
extension, which runs them on [Google Flow](https://labs.google/fx/tools/flow).

```
 any pipeline                    Mac (this tool)                  Browser
 ┌────────────────────┐  push   ┌──────────────────┐   poll     ┌──────────────┐
 │ writes a prompt .md│ ──────▶ │ ~/.flow-queue/   │ ◀────────  │ ZAPI FLOW    │
 │ (one per group)    │         │   queue.json     │  :4399     │ side panel   │
 └────────────────────┘         │ serve /queue     │            │ fills itself │
                                └──────────────────┘            └──────┬───────┘
                                                                       │ Run queue
                                                                       ▼
                                                                 Google Flow
```

## Why it is a tool and not a pipeline feature

Several pipelines have a gate where the owner approves a **look** from generated
frames before anything is built or spent. `visuals-flow` has two of them (110
intro ideas, 240 new-card looks), and the shape recurs anywhere a still has to be
judged first. Every one of them was the same copy-paste loop: print a prompt into
a chat window, select it, paste it into Flow, run it, come back for the next one.

So the bridge lives here. **Producers know nothing about the browser, and the
extension knows nothing about any pipeline.** Adding a new producer is one
`pp-flow-queue push` call — no extension change, no new endpoint.

## Commands

```bash
pp-flow-queue push <file.md|-> --source <id> --group <name> [--label <text>]
pp-flow-queue list                    # what is queued right now
pp-flow-queue status                  # is the relay up, and how many prompts
pp-flow-queue clear [--source <id>]   # empty the queue, or one source's part
pp-flow-queue serve [--port N]        # run the relay in the foreground
```

`push` **starts the relay itself** if it is not running, so a producer never has
to think about process lifecycle.

Re-pushing the same `--source`/`--group` **replaces** it rather than appending —
a producer re-running its step is the common case, and appending would queue the
same frames twice and burn generations.

## Prompt file format

One markdown file per **group** (the moments of a single thing being previewed).

```markdown
# Idea A — the race track

## m1 — the empty track

Flat 2D motion-graphics still frame, 16:9, 1920x1080, from a premium dark
tech explainer video.

TEXT RULE: the ONLY text anywhere in the image is: (none).

---

## m2 — three lanes lit

Flat 2D motion-graphics still frame, 16:9, 1920x1080.
```

- `---` on its own line **separates prompts**.
- A leading `##` heading is a **label for you** and is never sent to the
  generator. A `#` inside the body is a hex colour and survives.
- Each prompt is **flattened to a single line** on push. This is not cosmetic:
  the extension's queue is one-prompt-per-line, so a multi-paragraph prompt sent
  raw becomes ~15 junk entries. Newlines mean nothing to an image generator, so
  nothing is lost — and the `.md` on disk stays readable for the human.

## Download filenames

Each prompt is queued with a name (`<group>_m1`, `_m2`, …) that the extension
uses for the downloaded frame, so a folder of PNGs says what each one is.

The name travels **beside** the prompt, never inside it. Look-preview templates
allow-list every word permitted to appear in frame (`TEXT RULE: the ONLY text
anywhere in the image is …`), so a name token in the prompt body is exactly the
sort of thing a generator renders as a caption.

## Setup

The extension lives at `pipelines/video/zapi-flow-ext/` — load it unpacked
(Arc/Chrome → Extensions → Developer mode → Load unpacked). It polls
`http://127.0.0.1:4399/queue` every 5s and fills its own queue; there is nothing
to click.

Optional, to skip the cold-start pause on the first push after a reboot:

```bash
cp com.kushal.flow-queue.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.kushal.flow-queue.plist
```

## Safety rules the panel follows

- It never overwrites prompts you typed by hand — it only refills the box while
  it still holds its own last content (or nothing).
- It never touches the queue while a run is in progress.
- No relay running is the normal resting state, not an error; the panel just
  hides its bar.

## Producers today

| Source | Group | What it previews |
|---|---|---|
| `visuals-flow` | `intro-<idea-id>` | step 110 competing intro directions, judged before gate 120 |
| `visuals-flow` | `card-<card-slug>` | step 240 new-card look, the visual contract the card is built to match |

Adding one: write the `.md`, call `pp-flow-queue push`. That is the whole
integration.
