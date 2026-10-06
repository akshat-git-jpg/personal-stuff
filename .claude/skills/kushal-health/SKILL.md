---
name: kushal-health
description: Add a blood test / lab report PDF to Kushal Health (kushal-health.agrolloo.com). Reads the PDF with pdftotext, maps each test to a marker, shows the owner every value to check, writes a short verdict from the history, then pushes the numbers and the PDF. Triggers on "add my blood report", "add this lab report", "kushal-health", "blood test report", "upload my health report", "redo that blood report".
argument-hint: "<path to lab report PDF> [more PDFs]"
allowed-tools: "Read Bash Write"
---

# kushal-health: add a blood report

App: `apps/kushal-health` (read its `CLAUDE.md` before changing code). This skill turns a lab
PDF into the JSON the app takes, with the owner checking every number before it is saved.
All commands run from the repo root.

## Rules

1. Health data never goes into git, memory, `decisions.md`, docs, artifacts or any chat
   outside this session. Work files go in `$CLAUDE_JOB_DIR/tmp` if it is set, else a
   `mktemp -d` dir. Delete them at the end.
2. Nothing is pushed before the owner says ok to the check table.
3. Copy values and ranges exactly as printed. Never guess a missing range: leave
   `ref_low`/`ref_high` null and `ref_text` empty.
4. The verdict is not medical advice: no diagnosis, no medicine or dose suggestions. If
   anything is out of range, end with "Worth showing to your doctor."

## Setup check

`test -f apps/kushal-health/.ingest.env`. If it is missing, tell the owner to copy
`apps/kushal-health/.ingest.env.example` to `.ingest.env` and put in the `INGEST_TOKEN`
secret value, then stop. (Exit code 2 from the push script means the same thing.)

## Read the PDF

`pdftotext -layout "<pdf>" -`

- Empty or near-empty text means a scanned image. Tell the owner this skill only reads text
  PDFs, and stop.
- Pull out: the collection date (the `Collection` line; fall back to the `Report` date) as
  `YYYY-MM-DD`, the lab name (letterhead or footer), the lab id (`Lab. Id` or similar).
- Every result row: test name, observed value, unit, reference interval. Skip `Method:`,
  `Remarks`, `Comments`, `Note` and the explanation text under a result.
- One visit can give several PDFs with the same date. Each PDF is its own report.

## Map to markers

First run `node apps/kushal-health/scripts/push-report.mjs --history` and list the existing
`markers[].key` values with their names. For each test on the PDF:

1. If an existing marker is the same test, reuse its key. This is what keeps one test on one
   chart line across labs and years.
2. Else use the key from `markers.md` (next to this file) whose "names seen" matches.
3. Else coin a key: lowercase `a-z0-9_`, short, from the test's common short name
   (`ferritin`, `apo_b`). Pick the panel from `markers.md` or the best fit in:
   Diabetes, Lipid, Thyroid, Liver, Kidney, CBC, Vitamins, Hormones, Other.

Values:

| Printed value | value_text | value_num | qualifier |
|---|---|---|---|
| `5.6` | `5.6` | 5.6 | null |
| `<1.3` | `<1.3` | 1.3 | `<` |
| `>90` | `>90` | 90 | `>` |
| `Non Reactive` | `Non Reactive` | null | null |

Ranges:

| Printed range | ref_text | ref_low | ref_high |
|---|---|---|---|
| `0.35 - 4.94` | `0.35 - 4.94` | 0.35 | 4.94 |
| `<4.00` or `Upto 4` | as printed | null | 4.00 |
| `>40` | `>40` | 40 | null |
| `Non Reactive` | `Non Reactive` | null | null |
| Age/sex tables (e.g. `Male: 13-17`) | the adult male line | 13 | 17 |
| nothing printed | empty | null | null |

## Owner check

Show the date, lab, report id and PDF file name, then one table:

`Marker (key) | As printed | Value | Unit | Range | Status`

Status is the app's rule in words: **out of range**, **near edge** (within 10% of the range
width from a limit), **normal**, or **no range**.

Ask: "Do these match the PDF? Say ok, or tell me what to fix." Do not go on until the owner
says ok.

## Write the verdict

Use the `--history` output to compare each marker with its last reading. The verdict must:

- be at most 120 words, in plain short sentences; any medical word gets a 3-word explanation;
- start with a one-sentence overall call, e.g. "Mostly normal. 2 values need a look.";
- have one bullet per out-of-range or near-edge marker: name, value and unit, the range, and
  the change since last time if there is one ("up from 140 in Jun 2024");
- have one bullet for clear improvements, if there are any;
- end with "Worth showing to your doctor." when anything is out of range.

Show the verdict to the owner before pushing. Put in any edits they ask for.

## Push

Build the JSON and write it to the work dir:

```json
{
  "report": { "id": "<collected_on>-<lab-slug>-<lab id lowercased>", "collected_on": "YYYY-MM-DD",
              "lab": "<lab name>", "source_file": "<PDF base name>", "verdict": "<verdict>" },
  "results": [{ "marker_key": "tsh", "name": "TSH", "panel": "Thyroid", "name_on_report": "<as printed>",
                "value_text": "2.10", "value_num": 2.1, "qualifier": null, "unit": "µIU/mL",
                "ref_text": "0.35 - 4.94", "ref_low": 0.35, "ref_high": 4.94 }]
}
```

The id may only hold `a-z`, `0-9` and `-`. Then run:

`node apps/kushal-health/scripts/push-report.mjs <json> "<pdf>"`

A 400 names the failing field (for example `bad results[3].qualifier`). Fix it and push again;
the same id replaces the report. Several PDFs: one JSON and one push per PDF.

## Confirm

Run `--history` again and check the report id is in `reports` with `has_pdf: true`. Tell the
owner: report added, how many markers, and the link https://kushal-health.agrolloo.com.
Delete the work dir.

## Redo or fix a report

Run the same flow with the same `report.id`. The push replaces that report's results and
keeps its PDF unless a new PDF is passed.
