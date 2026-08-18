# yt-script-2 — the write surface (step 2's second output)

**Date:** 2026-08-18
**Status:** design approved, not yet planned
**Owner decision log:** decisions.md 2026-08-18 (four-step restructure)

## The problem

Step 2 produces `outline.pdf`. It solved the **read** problem — the remote
tutorial maker opens it and knows what to say, what to show, and what to edit.
The colour-coded lanes, the rules boxes and the dark styling all earn their keep.

The **write** problem is untouched. The maker opens a blank document and rebuilds
the script by hand. Measured across both finished videos in `videos/`:

| Outline part | Sentences reaching the script **word-for-word** |
|---|---|
| Intro | `ai-avatar-generator-comparison` 16/16 · `character-consistency-ai` 16/16 — **100%** |
| Conclusion | 75–100% |
| Verdicts | 27–100% |
| Body | 16–21% |

Two different jobs are tangled together, and only one of them is work:

1. **Transcription.** The intro, conclusion and verdicts are already finished
   verbatim copy — `OUTLINE-INSTRUCTIONS.md` says so explicitly. The maker
   retypes or copy-pastes them at 100% fidelity. Zero judgement added.
2. **Writing.** The body is where he expands a short SAY draft into full prose
   using what he learned on screen. Word count roughly doubles. This is the only
   part that needs him.

He also rebuilds the scaffolding by hand every time: `SAY` → `**Voiceover**`,
`SHOW` + `EDIT` → one `**Notes**` block, `Part A/B/C` wrappers, beat numbers.
Sampled from `character-consistency-ai`:

- outline `SHOW`: *"One sharp character portrait full-screen. Hard cut through
  three follow-up scenes where the face shape, hair, and jacket each subtly
  shift."*
- his `Notes`: *"[Demo placeholder — team to produce: one sharp character portrait
  full-screen, then hard cut through three follow-up scenes where the face shape,
  hair, and jacket each subtly shift…]"*

Same content, retyped. Mechanical restatement, no judgement.

**Goal:** the maker's job becomes *read the PDF, type in the empty boxes*. Nothing
that a machine can copy or derive should reach his keyboard.

## Decisions taken (owner, 2026-08-18)

1. **Two artifacts, not one.** A single combined file was considered and rejected
   by the owner — separate read and write files are less confusing for the maker.
2. **The write file is markdown.** No web UI for now.
3. **The write file is voiceover only.** No `Notes`, no `SHOW`, no `EDIT`. The
   maker refers to the PDF to understand what to capture; the worksheet is purely
   where words go.
4. **Body slots show the draft as reference, above an empty slot.** The outline's
   SAY draft sits in a `REFERENCE` block marked *do not ship these words*, and the
   maker writes on a clean line underneath it. Chosen over seeding the slot with
   the draft, because the data shows he rewrites ~80% of body drafts and
   half-edited seed text tends to ship. (Markdown enforces nothing — this is a
   convention the layout makes obvious, not a lock.)
5. **Each body beat carries its supporting facts** from `knowledge.md`, so he
   writes without searching a 27K-word file.
6. **Pre-filled text is editable.** Originally specced as locked. The owner
   amended this: the maker may change a pre-filled intro or verdict if his screen
   time showed it to be wrong. He simply never *has* to.
7. **Hybrid generation (approach C).** A script does the mechanical half; the
   step-2 session does the judgement half. Alternatives rejected: a
   generator-only build cannot assemble fact packs (needs judgement); a
   session-only build cannot guarantee the pre-filled copy matches `outline.md`
   character for character.

## The artifacts and the round trip

```
knowledge.md
     │
     ▼
outline.md ──render-outline.mjs──▶ outline.html + outline.pdf
     │                             READ artifact. Unchanged.
     │                             SHOW / EDIT / rules / lanes / dark.
     │
     ├──render-worksheet.mjs──▶ script-worksheet.md   ← NEW
     │        (skeleton)              WRITE artifact. Voiceover only.
     │                                   │
     │   step-2 session fills ───────────┘
     │   the fact packs
     │
     │        [ owner sends the maker BOTH files ]
     │                   │  he types in the empty slots
     │                   ▼
     │            script-draft.md      step 3 input, never edited
     │                   │
     │   diff script-worksheet.md script-draft.md
     │                   │  → slots filled (expected)
     │                   │  → pre-filled text changed (needs owner review)
     ▼                   ▼
outline.md ──────▶ script.md   +   script.vo.txt      step 3
  (SHOW/EDIT           │                  │
   folded into    human-readable    engine feed
   Notes)
```

### Who authors what

| File | Holds | Author | Tracked |
|---|---|---|---|
| `outline.md` | the outline, all lanes | step-2 session | yes |
| `outline.html` / `.pdf` | the read artifact | `render-outline.mjs` | no — gitignored |
| `script-worksheet.md` | pre-filled copy + empty word slots + fact packs | `render-worksheet.mjs` then the session | **yes** — it is the record of what was sent |
| `script-draft.md` | his words in those slots | **the maker** | yes — never edited by us |
| `script.md` | his words + Notes folded back from `outline.md` | step-3 session | yes |
| `script.vo.txt` | spoken words only | step-3 session | yes |

`script-worksheet.md` is tracked even though it is partly generated, because the
session hand-writes the fact packs into it and because it is the diff baseline for
what the maker changed.

## The worksheet format

Voiceover only. Every line in this file is either words that will be spoken, or a
label telling him where to put them.

```markdown
# <video title> — script worksheet

Fill the empty **Voiceover** slots. Everything else is already done.

Open `outline.pdf` beside this file — that is where the demo, the screen actions
and the section rules live. They are deliberately not repeated here.

Pre-filled beats are final. Change one only if your screen time showed it to be
wrong; anything you change is flagged for Kushal's review.

---

## PART A — INTRODUCTION

### A1 · Cold open                 ✎ pre-filled — final unless it's wrong

> "Perfect face. Perfect outfit. Exactly the character you wanted.
>
>  Scene two. Different face. Different hair. Different person.
>
>  That's identity drift, and it kills every AI story before it gets going."

### A2 · Credibility               ✎ pre-filled — final unless it's wrong

> "Every AI generator can nail one clip. The problem starts on clip two…"

---

## PART B — BODY

### SECTION: The Character Consistency Test

#### B4 · Five scenes, five tools            target 90–140 words

> REFERENCE — the angle to hit. Do not ship these words.
> Five scenes. Studio, rainy neon street, low-angle close-up, hallway run,
> then animated. InVideo AI breaks first. OpenArt held all five.

<details><summary>Facts for this beat</summary>

- OpenArt held face, hair, sweater and pendant across all 5 scenes
  src: owner brain-dump
- Higgsfield Soul ID locks the face; wardrobe drifted (navy sweater → leather)
  src: owner brain-dump
- InVideo AI: new face and outfit almost every scene
  src: owner brain-dump

</details>

**Voiceover**
>
>
>

---

## PART C — HONEST VERDICT + CONCLUSION

### C1 · Overall synthesis          ✎ pre-filled — final unless it's wrong

> "None of these are bad. They're just built for different priorities."
```

### Grammar rules

- **`### A<n> ·` / `#### B<n> ·` / `### C<n> ·`** — beat headings, numbered so the
  owner, the maker and the editor can refer to a beat by name. The letter is the
  part.
- **`✎ pre-filled — final unless it's wrong`** on the heading line marks a beat
  that arrived complete. Its spoken copy follows immediately as a blockquote, with
  no `**Voiceover**` label — there is nothing to fill.
- **`target <n>–<n> words`** on the heading line of every empty beat. The
  generator emits it bare (`target — words`); the session fills the number from
  `SCRIPT-INSTRUCTIONS.md`'s budgets, because only it can tell what kind of beat
  this is.
- **`> REFERENCE — the angle to hit. Do not ship these words.`** wraps the
  outline's body SAY draft. Reference only.
- **`<details><summary>Facts for this beat</summary>`** holds the supporting facts,
  each with a `src:` line naming where in `knowledge.md` it came from. Collapsed so
  it does not crowd the writing surface.
- **`**Voiceover**` followed by an empty blockquote** is the only place he types.
  Three empty `>` lines, so the blockquote survives even if he types on one line.
- **No `Notes`, no `SHOW`, no `EDIT`, no rules boxes, no tables.** Those live in
  the PDF. Repeating them here is the mistake this format exists to avoid.

## `render-worksheet.mjs` — the mechanical half

New script beside `render-outline.mjs`, same no-dependency style.

```bash
node render-worksheet.mjs <key>          # videos/<key>/outline.md -> script-worksheet.md
node render-worksheet.mjs <key> --force  # overwrite an existing worksheet
```

It parses `outline.md` with the same lane grammar `render-outline.mjs` already
recognises, and emits the worksheet:

1. **Copies** — never retypes — the spoken copy of every intro beat, conclusion
   beat and `> **VERDICT:**` line, byte for byte, and marks each beat pre-filled.
   Copying is the point: a retyped intro can drop a word, and that word goes to
   camera.
2. Emits every body beat as heading + `REFERENCE` block + empty `**Voiceover**`
   slot, in outline order, under its `SECTION:` heading.
3. Numbers the beats `A1…`, `B1…`, `C1…` by part.
4. Emits an empty `<details>Facts for this beat</details>` block per body beat,
   and an unstamped `target — words` marker on its heading, both for the session
   to fill.
5. Drops every `SHOW`, `EDIT` and `RULES` block on the floor. They belong to the
   PDF.
6. Refuses to overwrite an existing `script-worksheet.md` without `--force`, since
   the session's hand-written fact packs are not regenerable.

### Which beats are pre-filled — positional, not string-matched

Decided structurally, never by guessing at a heading's wording. The three existing
outlines already disagree on wording:

| Outline | Part headings |
|---|---|
| `ai-avatar-generator-comparison` | INTRODUCTION · BODY · HONEST VERDICT |
| `ai-avatar-generators` | INTRODUCTION · BODY · HONEST VERDICT · CONCLUSION |
| `character-consistency-ai` | INTRODUCTION · BODY · HONEST VERDICT & CONCLUSION |

So matching on the literal word `CONCLUSION` would break on two of three. The rule
is positional instead:

> **The `BODY` part is the only part holding draft SAY lanes. Every part before it
> and every part after it is finished copy, whatever it is called.** `VERDICT`
> lines are finished copy wherever they appear.

This follows `OUTLINE-INSTRUCTIONS.md`'s own contract ("intro and conclusion are
finished verbatim copy… the body is lane blocks") and survives a renamed tail part.
If a future outline has no part literally named `BODY`, the generator must fail
loudly rather than guess which half is draft.

### Word targets are the session's job, not the generator's

`SCRIPT-INSTRUCTIONS.md`'s budgets are per *kind* of beat — cold open 100–160,
roadmap 60–100, per-option overview 25–40, per-metric explanation 50–90 — and a
parser cannot tell which kind beat `B4` is. The generator therefore emits a bare
`target — words` marker and the session fills the number alongside the fact pack,
where the beat's kind is obvious. A worksheet shipped with an unfilled `target —
words` is a bug.

## The session's half

After running the generator, the step-2 session fills two things per body beat:
the `<details>` block, with the facts from `knowledge.md` that back that beat, each
carrying a `src:` line; and the bare `target — words` marker on the heading, with
the matching budget from `SCRIPT-INSTRUCTIONS.md`.

This cannot be mechanised — deciding which of 27K words back the pricing beat is
judgement — and it is nearly free at this point in the session, because the same
session just used those facts to write the outline.

Rules:

- Facts are **copied** from `knowledge.md`, never restated from memory. The
  no-research rule binds exactly as at step 1.
- Every fact carries a `src:` naming its `knowledge.md` heading (screenshot
  filename, URL + fetch date, or `owner brain-dump`).
- A beat with no supporting facts gets `- none — this beat is his screen time`.
  An empty block is a bug; an explicit "none" is an answer.
- A volatile number (live pricing, free-tier limits) is copied with its fetch date
  so the maker can see how stale it is.

## Changes to step 3

Step 3's contract in `SKILL.md` gains two things:

1. **Diff the return, don't just read it.** `diff script-worksheet.md
   script-draft.md` splits his return into empty slots he filled (expected) and
   pre-filled text he changed (needs the owner's eyes). This replaces the guard
   script an earlier draft of this design proposed — two tracked files under
   different names make a plain `diff` sufficient, so no new tooling is needed.
   Every pre-filled change goes into the step-3 change report as its own line.
2. **Fold the Notes back in.** `script.md` still needs `Notes` blocks for the
   editor, but the maker no longer writes them. Step 3 reads `outline.md`'s `SHOW`
   and `EDIT` lanes for the matching beat and merges them into `script.md`'s
   `Notes`. Mechanical, no judgement — verified against the two existing scripts,
   where every Notes block is a reworded SHOW/EDIT pair.

`script.vo.txt` is unaffected: it never contained Notes.

## Documentation to update

- `pipelines/.claude/skills/yt-script-2/SKILL.md` — step 2 gains the worksheet
  output; step 3 gains the diff and the Notes fold; folder tree gains
  `script-worksheet.md`; step-2 gate becomes "outline + worksheet → stop".
- `pipelines/youtube/yt-script-2/CLAUDE.md` — layout, rendering section (three
  renderers), and a trap for "the worksheet must never carry SHOW/EDIT".
- `pipelines/youtube/yt-script-2/SCRIPT-INSTRUCTIONS.md` — the input is now a
  filled worksheet, not a free-form doc; word budgets become the generator's
  source for slot targets.
- `.gitignore` — no change. `script-worksheet.md` is tracked.
- `decisions.md` — one dated entry after landing.

## Out of scope

- **A web UI.** Considered and deferred: the owner chose markdown for now. If the
  maker ever finds the markdown slots awkward, the natural next step is a
  self-contained HTML worksheet emitted by the same script, exporting the same
  markdown. The format above is deliberately mechanical enough to generate either.
- **Combining the read and write artifacts.** Explicitly rejected by the owner —
  two files are less confusing than one.
- **Step 4 (VO generation).** Still unwired, pending the owner's API choice.

## Success criteria

1. The maker's returned `script-draft.md` contains no retyped intro, conclusion or
   verdict copy, and no hand-written `Notes` blocks.
2. Every body beat he filled has its facts already present in the worksheet — he
   never had to open `knowledge.md`.
3. `diff script-worksheet.md script-draft.md` reports his changes cleanly, and
   any pre-filled edit reaches the owner in step 3's change report.
4. The pre-filled spoken copy in the worksheet is byte-identical to `outline.md`'s
   — verifiable by regenerating the worksheet and diffing the pre-filled blocks.
