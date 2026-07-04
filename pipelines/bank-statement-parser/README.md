# Bank Statement Parser

Turn a bank statement (PDF or image, digital or scanned) into clean, normalized
JSON, with a built-in balance check that tells you whether the parse can be
trusted.

Built to be sold on RapidAPI. The niche there is thin and the leading incumbent
runs at ~11 seconds per call with no validation. This service goes straight to
extraction, checks its own math, and returns in a few seconds.

## What it does

`POST /v1/parse` takes one statement file and returns:

- account details (holder, masked number, bank, currency, IBAN)
- the statement period and opening/closing balances
- every transaction (date, description, amount, debit/credit, running balance, category)
- a summary (total credits, total debits, count)
- a `validation` block: `reconciled`, `discrepancy`, and `confidence`
- a `meta` block: which model ran, input type, page count, processing time, whether it was a cache hit

**Money is in integer minor units (cents).** `1050` means $10.50. This keeps the
balance check exact, so no floating-point rounding can make a correct statement
look wrong.

The `validation` block is the point. We recompute `opening + credits − debits`
and compare it to the closing balance. If they match exactly, `reconciled` is
true. If they don't, you get the exact `discrepancy` instead of a silent wrong
answer. That is what makes the output safe to feed into underwriting or
accounting.

## How it works

One stateless FastAPI service, small focused pieces:

1. `cache` returns an instant result if this exact file was parsed before.
2. `intake` sniffs the file type from its bytes, enforces a size cap, and
   rejects password-protected PDFs early.
3. `textlayer` checks whether a PDF has a real text layer (digital vs scanned).
4. `chunking` splits long statements into page-chunks.
5. `extractor` sends the statement to Claude. Both paths default to Haiku for
   cost: digital PDFs go as text, scanned PDFs and images go as the file itself,
   which Claude reads directly, so there is no separate OCR step. Bump
   `PARSER_VISION_MODEL` to Sonnet if scanned accuracy needs it.
6. `reconcile` converts everything to cents, computes the summary, and runs the
   exact balance check. It is a pure function (no model, no network), so the
   trust signal is deterministic.
7. `pipeline` ties it together: cache, concurrency, page cap, and meta.
8. `main` is the thin HTTP layer.

**Single pass, no retries.** A statement either reconciles on the first pass or
it does not, and we report that honestly via the `validation` block. There is no
hidden second call, so the cost of a request is predictable: one model call per
chunk, output bounded by `max_tokens`.

Long statements are split into page-chunks and extracted **concurrently**, then
stitched back together. Anything over the page cap is rejected up front, which
keeps the per-request cost bounded.

Nothing is written to disk. Statements are processed in memory and dropped when
the request ends.

## Run it locally

You need an Anthropic API key (console.anthropic.com → API keys). Calls are
billed per token; a typical 3-page statement costs a few cents.

```bash
cd bank-statement-parser
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env          # then paste your key into .env
./run.sh                      # serves on http://localhost:8080
```

Parse a statement:

```bash
curl -F "file=@statement.pdf" http://localhost:8080/v1/parse
# add ?include=raw_text to also get the extracted text back (debugging)
```

Interactive docs are at `http://localhost:8080/docs`.

## Check the reconciliation logic without a key

The balance check is the load-bearing part, and you can exercise it offline:

```bash
./.venv/bin/python check_reconcile.py
```

It runs a few hand-built cases in exact cents: a clean reconcile, one off by
$50, one off by a single cent (which is correctly flagged, since there is no
tolerance), and a statement missing its opening balance (which honestly reports
that it cannot reconcile rather than faking a pass).

## Config

All optional except the key. Set them in `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required. Your Anthropic key. |
| `PARSER_TEXT_MODEL` | `claude-haiku-4-5` | Model for digital (text) PDFs. |
| `PARSER_VISION_MODEL` | `claude-haiku-4-5` | Model for scanned PDFs and images. Bump to `claude-sonnet-4-6` for higher scanned accuracy. |
| `PARSER_MAX_TOKENS` | `8000` | Output cap per call (bounds cost). |
| `PARSER_MAX_FILE_MB` | `15` | Upload size limit. |
| `PARSER_MAX_PAGES` | `30` | Reject statements over this many pages (bounds per-request cost). |
| `PARSER_CHUNK_PAGES` | `8` | Statements longer than this are split and parsed concurrently. |
| `PARSER_CACHE_SIZE` | `256` | Recent results kept in the file-hash cache. |
| `RAPIDAPI_PROXY_SECRET` | — | When set, `/v1/parse` requires a matching `X-Parser-Secret` header. Set this in production so only the RapidAPI proxy can reach the service. |

## Status and what is next

The code is complete and the whole pipeline is verified except the live Claude
call, which needs a key. Verified so far: every input guard, the HTTP layer, the
schema, and the reconciliation logic (exact, in cents).

Still to do, in order:

1. Run a live pass against real statements (varied banks, at least one scanned,
   one long) and confirm the JSON and the balance check.
2. Deploy to the Hostinger VPS.
3. List it on RapidAPI and wire the proxy secret.

## Errors

Every error returns `{ "error": "...", "code": "..." }` so integrators can branch
on the code.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `empty_file` / `corrupt_pdf` | Empty or unreadable file. |
| 413 | `file_too_large` / `too_many_pages` | Over the byte or page limit. |
| 415 | `unsupported_type` | Not a PDF or supported image. |
| 422 | `password_protected` | PDF needs a password. |
| 422 | `too_long` / `refused` / `unparseable` | The model could not extract it. |
| 502 | `upstream_error` | The extraction call failed (often a missing or bad API key). |
