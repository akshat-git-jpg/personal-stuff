---
name: kushal-salary
description: Add salary payslips and HR mail notes to Kushal Salary (kushal-salary.agrolloo.com). Finds new RazorpayX payslip PDFs in the work Gmail (get_message RAW, decoded with Python) or a folder, parses them, shows the owner every number to check, pushes numbers + PDFs, and turns appraisal or revised-salary mails into Timeline notes. Triggers on "add my payslips", "update my salary", "new payslip", "kushal-salary", "salary tracker", "add this appraisal letter".
argument-hint: "[folder or payslip PDFs]"
allowed-tools: "Read Bash Write"
---

# kushal-salary: add payslips and mail notes

App: `apps/kushal-salary` (read its `CLAUDE.md` before changing code). All commands run from
the repo root.

## Rules

1. Salary data never goes into git, memory, `decisions.md`, docs, artifacts or any chat
   outside this session. Work files go in `$CLAUDE_JOB_DIR/tmp` if set, else a `mktemp -d` dir.
2. **Never control Chrome with scripts** (no Puppeteer, no AppleScript, no Claude in Chrome on
   the payroll site). Payslips come from Gmail or from a folder the owner filled.
3. Nothing is pushed before the owner says ok to the check table.
4. Numbers come only from payslip PDFs. A mail body's "amount credited" is never pushed as data.
5. Python that reads downloaded files runs with `python3 -I`.

## Setup check

`test -f apps/kushal-salary/.ingest.env`. If missing, tell the owner to copy
`apps/kushal-salary/.ingest.env.example` to `.ingest.env` and put in the `INGEST_TOKEN` secret
value, then stop. (Exit code 2 from the push scripts means the same.)

## What is already stored

`node apps/kushal-salary/scripts/push-month.mjs --history` lists stored months (`has_pdf`) and
notes. The months missing since the last stored one are the ones to fetch.

## Get the payslips

Payslips live in `~/Documents/salary-slips/YYYY-MM.pdf`. If the owner names a folder or PDFs,
use those and skip to **Parse and check**.

**From Gmail** (the work account, through the Gmail MCP):

1. `search_threads` with query `from:razorpay has:attachment filename:pdf`, newest first; page
   until you reach the last stored month. Each "salary credited" mail carries that month's
   payslip PDF.
2. For each new mail: `get_message` with `messageFormat: RAW`. The result is too big to show,
   so the tool saves it to a file and prints its path.
3. Decode it into the folder:
   `python3 -I .claude/skills/kushal-salary/scripts/raw-to-pdf.py <saved file> ~/Documents/salary-slips`
   It names the file from the payslip's own "Payslip: Mon YYYY" line and prints the path.
4. Older mails (about mid-2025 back) have no PDF attached. For those months the owner downloads
   the payslip from the payroll portal into the same folder by hand. Ask; do not script it.

## Parse and check

For each new PDF: `node apps/kushal-salary/scripts/parse-slip.mjs <pdf>`.

- `checks` not empty (net != gross - deductions, or items do not add up): show the owner the
  check and the PDF, do not push that month. Fix only with the owner's numbers (see Fix).
- Empty text: a scanned PDF. Tell the owner and skip it.

Show one table for all new months:

`Month | Title | Gross | Net | Fixed / month | One-time items (label: amount) | Arrears`

Fixed / month = sum of `monthly` over items with `category: "fixed"`. Flag any row where the
title changed (a promotion) or fixed pay moved by 5% or more (a hike), so the owner sees what
the app will show.

Ask: "Do these match the payslips? Say ok, or tell me what to fix." Wait for ok.

## Push

`node apps/kushal-salary/scripts/push-month.mjs <pdf> [more pdfs...]`

It parses each PDF again, refuses one whose checks fail (exit 3), posts the numbers, then
uploads the PDF. A 400 names the field (`bad items[3].category`). Re-pushing a month replaces
it and keeps its PDF.

## Mail notes (appraisal letters, revised salary)

1. `search_threads` for HR mail about pay since the last stored note:
   `(subject:appraisal OR "revised salary" OR promotion OR increment OR "compensation letter") -from:razorpay -from:notifications@github.com`.
   Skip policy announcements and newsletters.
2. Show the owner each candidate: date, sender, subject, one-line gist. Only the ones they pick
   become notes.
3. For each picked mail write a note JSON in the work dir:
   ```json
   { "id": "2026-05-13-appraisal-letter", "date": "2026-05-13", "title": "Appraisal letter FY 2025-26",
     "body": "One or two plain sentences, no numbers the payslips already show.",
     "source_url": "<the message viewUrl>", "source_file": "<attached PDF name or empty>" }
   ```
   `id`: `a-z0-9-` only, date first. A letter attached to the mail: fetch it with
   `get_message` RAW and `raw-to-pdf.py <saved file> <work dir> --keep-name`. A letter behind a
   link (DocSend and the like) cannot be fetched; say so and push the note without a PDF.
4. `node apps/kushal-salary/scripts/push-note.mjs <note.json> [<letter.pdf>]`

## Confirm

Run `--history` again: every new month is there with `has_pdf: true`. Tell the owner how many
months and notes were added and give https://kushal-salary.agrolloo.com. Delete the work dir.

## Fix a month

If the owner corrects a number: `parse-slip.mjs <pdf> > <work dir>/YYYY-MM.json`, edit the
JSON (drop the `checks` key), then
`node apps/kushal-salary/scripts/push-month.mjs <work dir>/YYYY-MM.json <pdf>`.
