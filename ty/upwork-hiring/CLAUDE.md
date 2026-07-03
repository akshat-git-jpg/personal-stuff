# Upwork Hiring Workflows

Two workflows live here:

- **Upwork job post** — turn jumbled hiring thoughts into a ready-to-paste Upwork post. High-level pitch. Used pre-hire.
- **SOP** — once a freelancer is selected, generate the day-to-day onboarding doc with real tools, real numbers, real cadence. Used post-hire.

The split is deliberate: the post is the pitch, the SOP is the reality. Day-to-day specifics (exact tools, weekly cadence, feedback format, exact pay schedule) belong in the SOP, never in the job post.

---

# Workflow A — Upwork Job Post

Turn jumbled hiring thoughts into a ready-to-paste Upwork job post (title + description + screening questions).

---

## Trigger

When the user says any of:

- "I need to hire someone for ..."
- "I want to hire ..."
- "upwork post for ..." / "make me an upwork post"
- "/upwork" / "/hire"

…fire this workflow. Match on intent — the user will rarely use the exact phrase.

---

## What this produces

A single markdown file at `/tmp/upwork-<role-slug>-<timestamp>.md` containing **three sections only**:

1. **Title** — a single line, ≤ 70 characters
2. **Job description** — terse Upwork-style post (overview → scope → must-have → nice-to-have → requirements)
3. **Screening questions** — 3–5 filter-oriented questions, marked which should be "required"

At the end, print the absolute file path back to the user so they can open it.

---

## Steps Claude follows

### Step 1 — Capture the user's jumbled input

Read whatever the user said. Don't ask them to "format their thoughts" — that's the whole point of this workflow. Treat the dump as the source.

### Step 2 — Check for gaps

A good Upwork post needs the following. Scan the user's input and infer everything you can. Only ask for the items you genuinely can't infer.

| Required info | Acceptable defaults if user doesn't say |
|---|---|
| Role / skillset | (must ask — no default) |
| Scope: one-off project vs ongoing role | one-off, unless user implies ongoing |
| Pay structure | monthly retainer (default for ongoing), fixed-price (default for one-offs); per-video rate if applicable |
| Budget / rate | (must ask — no default) |
| Volume (videos per month, or hours per week) | (must ask if ongoing — no default) |
| Timeline / urgency | "long term role" for ongoing; "flexible, target 2 weeks" for one-offs |
| Required experience (tools, years, portfolio) | infer from the role |
| What "done" looks like (concrete deliverables) | infer from the input — flag if unclear |
| Communication / timezone preference | "async OK, IST-friendly hours preferred" |

### Step 3 — Ask gaps in ONE batch

If 2+ items need asking, send them as a single `AskUserQuestion` (preferred) or a single numbered list. Do not ask one at a time.

If only the role and budget are missing, ask in a single short message — no need for the AskUserQuestion UI.

If everything is inferable, skip to Step 4 — don't ask anything.

### Step 4 — Draft the three outputs

**Title** (≤ 70 chars):
- Concrete role + headline skill + most distinctive context.
- ✅ `n8n developer to automate Google Sheets → Notion pipeline (3-5 wks)`
- ❌ `Looking for a rockstar developer to help with exciting projects`

**Job description** — use this exact skeleton, in this order:

```markdown
## Overview
[1-2 sentences. What's the project and what role does this person play.]

## What you'll do
- [bullet, concrete action]
- [bullet]
- [bullet]

## Required
- [skill or experience, specific — versions, tools, years]
- [skill]
- [skill]

## Nice to have
- [bullet]
- [bullet]

## Requirements
$X per video (N videos per month)   [or: $X/month for N videos | $X/hour | fixed-price total]
Long term role.
Monthly retainer once selected.
```

The **Requirements** block is standardized — same three lines for every ongoing post. Only the pay line changes per role:
- Per-video work → `$X per video (N videos per month)`
- Flat monthly → `$X/month for N videos`
- Hourly → `$X/hour, ~N hours/week`
- One-off project → replace the block with `## Budget` + a single line, and drop "Long term role" / retainer line.

Do not add a "How to apply" section in the body — applicant filtering happens via the screening questions (next).

**Screening questions** (3-5):
- Each question is short, one sentence.
- Each filters out a real category of bad fit.
- Mark which should be **required** (recommend marking all required).
- Good question categories: portfolio link for a similar project, hands-on with the specific tool, rate/availability, timezone, approach to a key technical decision in this project.

### Step 5 — Style rules (apply throughout)

- **No AI tells.** Avoid: "leverage", "robust", "seamless", "fast-paced", "rockstar", em dashes for parallelism, "we're looking for someone who...", "join our team and...".
- **Specific over vague.** "n8n 1.x self-hosted on Hostinger" beats "automation experience". "Python 3.12 + gspread" beats "Python skills".
- **Cut fluff.** No company-culture paragraphs. No bullets longer than one line. If a "nice to have" is genuinely optional, keep it; otherwise delete it.
- **No emojis.** No exclamation marks.
- **Lists over prose** for scope/requirements/nice-to-have.
- **Active voice.** "You'll build X" not "X will be built by you".
- **High-level only.** No exact tools, daily cadences, exact pay schedules, or feedback formats — those belong in the SOP (Workflow B). Keep the post the pitch, not the manual.

### Step 6 — Save and report

1. Compute the slug: lowercase, kebab-case, derived from the role. Example: `n8n-developer`, `thumbnail-designer`, `video-editor`.
2. Compute the timestamp via bash: `date +%Y%m%d-%H%M%S`.
3. Write the full markdown to `/tmp/upwork-<slug>-<timestamp>.md` using the Write tool.
4. Print the file path to the user, plus a one-line preview of the title so they know what was generated.

Example end-of-run message:

```
✓ Written to /tmp/upwork-n8n-developer-20260512-143022.md
  Title: n8n developer to automate Google Sheets → Notion pipeline (3-5 wks)
```

---

## Output file format

```markdown
# Upwork Post — <role>

## Title
<the one-line title>

## Job Description
<the full description with the 5-section skeleton from Step 4: Overview → What you'll do → Required → Nice to have → Requirements>

## Screening Questions
1. [required] <question>
2. [required] <question>
3. <question>
4. <question>
```

---

## Notes

- **Output is throwaway by design.** Files in `/tmp/` get cleaned up by the OS — the user is expected to copy-paste into Upwork immediately. Don't promise the file will persist.
- **One post per run.** Don't bundle multiple hires into one file. If the user dumps thoughts on multiple roles, ask them which one to do first.
- **Re-runnable.** If the user says "make it shorter" or "add a question about X", regenerate the whole file (don't try to patch the existing one) and write to a new timestamped path.

---

# Workflow B — SOP (post-hire onboarding doc)

Shared with a freelancer once you've decided to go ahead with them. Unlike the job post, this one carries the real numbers, exact tools, and step-by-step day-to-day mechanics. No team intro — the SOP is about what THEIR work will look like and how they get paid.

---

## Trigger

When the user says any of:

- "make sop"
- "make SOP for <role>"
- "draft sop" / "/sop"

…fire this workflow. If a role isn't named, try to infer it from the current conversation (e.g. an Upwork post was just generated for `<role>`). If still ambiguous, ask.

---

## What this produces

A single markdown file at `/tmp/upwork-sop-<role-slug>-<timestamp>.md` containing:

1. **How your work will look** — concrete walkthrough of the day-to-day or per-video cycle
2. **Tools you'll use** — exact tools + what each is used for
3. **What "delivered" looks like** — format/output spec for one unit of work
4. **Pay** — exact rate, cycle, method
5. **First week** — optional, only if the user mentioned onboarding/probation specifics

At the end, print the absolute file path back to the user.

---

## Steps Claude follows

### Step 1 — Capture the user's jumbled input

Same as Workflow A. Take whatever the user dumps. Don't ask them to "format their thoughts".

### Step 2 — Check for gaps

The SOP is built from real specifics — most of these can't be inferred. Ask for anything missing.

| Required info | Acceptable default if user doesn't say |
|---|---|
| Role / scope | infer from current conversation if an Upwork post was just generated; else must ask |
| Work cadence (when work arrives, when feedback/output is due) | (must ask — no default) |
| Tools used + where work lives | (must ask — no default) |
| What one delivered unit looks like (format, length, location) | (must ask — no default) |
| Pay rate | infer from the Upwork post if available; else must ask |
| Pay cycle (weekly / monthly / per-delivery) | "monthly, paid at month-end" |
| Pay method (Upwork fixed-price milestones, Upwork hourly, direct transfer) | "Upwork fixed-price milestones" |
| First-week / probation | omit if not mentioned |

### Step 3 — Ask gaps in ONE batch

If 2+ items need asking, send a single `AskUserQuestion` or single numbered list. Don't ask one at a time. If everything is inferable, skip to Step 4.

### Step 4 — Draft the SOP

Use this skeleton:

```markdown
# SOP — <role>

## How your work will look
[Concrete walkthrough. Use a weekly cadence OR per-delivery cycle, whichever fits.

Weekly example:
- **Monday morning** — you receive 2-3 videos in Frame.io with briefs attached
- **By Wednesday EOD** — you post a Loom review + timestamped comments per video
- **Thursday** — quick async sync with the screencast creator if anything's blocking
- **Friday** — confirm next week's queue

Per-delivery example:
- A video drops into Frame.io with a brief
- Within 48 hours: post timestamped feedback comments + a 3-5 min Loom
- Once edits land: re-review, mark approved or send back with a clear list

Be specific: WHEN, WHERE, HOW. No vague "you'll review videos".]

## Tools you'll use
- **Frame.io** — review videos, timestamped comments
- **Slack** — async chat with the team, urgent pings only
- **Google Drive** — briefs and supporting docs
[Only list what they'll actually touch.]

## What "delivered" looks like
[One concrete unit of done. Format, length, where it goes. E.g. for a reviewer:
- A Loom (3-5 min) walking through the video with timestamp-anchored notes
- A written summary in Frame.io: 3-5 bullets, ranked by impact
- A clear pass / send-back call at the end]

## Pay
- **Rate:** $X per <unit>   (or $X/month, $X/hour)
- **Cycle:** [weekly / monthly / per-delivery]
- **Method:** [Upwork fixed-price milestones / Upwork hourly / direct transfer]
- **First payment:** [conditions, e.g. after first 2 approved deliveries]

## First week
[OPTIONAL — only include if the user mentioned onboarding or probation specifics.]
- [What to expect, what's expected of them]
- [Trial / probation terms if any]
```

### Step 5 — Style rules

Same as Workflow A, plus:

- **Concrete over vague.** "By Wednesday EOD" beats "midweek". "Loom 3-5 min" beats "a video review".
- **No team intro.** Skip "meet the team" / "you'll be working with…". The SOP is about THEIR work, not the org chart.
- **Real numbers only.** If you don't know the actual rate or cycle, ask. Never ship a final SOP with placeholder text like "$X" or "[TBD]".
- **Second person throughout.** "You receive…", "you send…", "you get paid…".

### Step 6 — Save and report

1. Slug: lowercase, kebab-case (`content-reviewer`, `video-editor`, etc.) — same convention as Workflow A.
2. Timestamp: `date +%Y%m%d-%H%M%S`.
3. Write to `/tmp/upwork-sop-<slug>-<timestamp>.md`.
4. Print the path and a one-line preview (the role).

Example end-of-run message:

```
✓ Written to /tmp/upwork-sop-content-reviewer-20260512-143022.md
  Role: Content reviewer for AI software comparison videos
```

---

## Output file format

```markdown
# SOP — <role>

[the sections from Step 4 — Overview is implicit in "How your work will look"]
```

No screening questions, no apply-block — this is a private doc shared post-hire.

---

## Notes

- **Output is throwaway.** Copy-paste the SOP into wherever you share it (Upwork message, Google Doc, Notion). Don't promise the /tmp file will persist.
- **Re-runnable.** If the freelancer asks for clarification or you adjust pay, regenerate the file with the new info — don't try to patch the old one.
- **Pair with the job post.** If you just ran Workflow A for this role, pull role + rate from there so the two stay consistent. Otherwise just ask.
