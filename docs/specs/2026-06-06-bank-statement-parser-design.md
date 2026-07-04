# Bank statement → structured JSON parser

Date: 2026-06-06
Status: Approved design, pre-implementation

## Goal

A best-in-class API that turns a bank statement (PDF or image, digital or
scanned) into clean, normalized, **trustworthy** structured JSON. Built to be
sold on RapidAPI, where the niche is thin (29 APIs on 2026-06-06) and the
leading incumbent runs at ~11.4s latency. The wedge: fast, accurate across
banks and input types, and self-validating via balance reconciliation.

Buyers: lending/underwriting, accounting tools, expense/PFM apps — B2B, billed
per document.

## Decisions (locked)

- **Engine:** hybrid — text-first for digital PDFs, vision fallback for scans.
- **Model:** Claude **Sonnet 4.6** (`claude-sonnet-4-6`) for every document.
  Flat ~$0.05/doc, no escalation ladder. Charged at $0.05–0.20/doc on RapidAPI.
- **Input coverage:** digital + scanned from day one (the vision path covers
  scans natively — see below).
- **MVP cut:** core `/parse` endpoint + reconciliation, validated locally
  against real statements. VPS deploy + RapidAPI listing are the next phase,
  out of scope for this spec.

## Why this is feasible / key platform facts

- **Claude has native PDF support**: a base64 `document` block is read for both
  its text layer and rendered page images, so scanned/photographed statements
  need no separate OCR stack (no Tesseract). Verified in the Claude API skill.
- **Structured outputs** (`client.messages.parse()` with a Pydantic schema) on
  Sonnet 4.6 guarantee valid JSON matching our schema — extraction can't return
  malformed output.
- **Prompt caching**: the extraction system prompt + schema are stable, so they
  cache across documents (~0.1x cost on the cached prefix).

## Architecture

Python **FastAPI** service. One main endpoint:

```
POST /parse   multipart file (PDF or image) → structured JSON
GET  /health  liveness
```

Fronted by RapidAPI (handles auth/billing/rate-limits, proxies to the VPS over
a shared secret header) — that wiring is the next phase, not this MVP.

Units, each with one job and a clear interface:

1. **`intake`** — accept the upload, sniff type (PDF vs image), reject
   password-protected/oversized/empty with clear 4xx. In-memory only.
2. **`textlayer`** — `pdfplumber`/PyMuPDF: does this PDF have a usable text
   layer? Returns extracted text or a "needs vision" signal.
3. **`extractor`** — the Claude call. Two entry paths, one schema:
   - digital: send extracted text + schema → `messages.parse()`
   - scanned/image: send the PDF/page-image `document` blocks + schema →
     `messages.parse()` (vision)
   Both return the same `Statement` Pydantic model.
4. **`reconcile`** — `opening + Σcredits − Σdebits == closing`. Sets
   `validation.reconciled` + `discrepancy`. Pure function, no I/O — unit-tested
   in isolation.
5. **`api`** — FastAPI wiring: route, error mapping, response shaping. Thin.

Data flow: `intake → textlayer → extractor → reconcile → api response`.

## Output schema (Pydantic `Statement`)

```
account:   { holder_name, account_number_masked, bank_name, currency, iban? }
period:    { start_date, end_date }
balances:  { opening, closing }
transactions: [ { date, description, amount, direction(debit|credit),
                  balance_after?, category? } ]
summary:   { total_credits, total_debits, transaction_count }
validation:{ reconciled(bool), discrepancy(number), confidence(0-1) }
```

Amounts are signed by `direction`; `category` is best-effort and optional.

## The differentiators (what makes it "best")

- **Balance reconciliation** returned on every response — the caller can trust
  the parse, or see exactly where it's off. The headline feature nobody does
  cleanly.
- **Both input types day one** via Claude's native PDF/vision — digital and
  scanned, no OCR stack to maintain.
- **Privacy as a feature:** statements processed fully in-memory, never
  persisted, scrubbed on return. Stated plainly in the API docs.
- **Speed:** target 2–5s typical vs the 11.4s incumbent — straight to
  extraction, pages handled in one call.

## Error handling

- Password-protected PDF → `422` with a clear message.
- Oversized / empty / unsupported type → `415`/`413`/`400` as appropriate.
- Not a bank statement → low `validation.confidence`, not a crash.
- Model/transport failure → `502` with a retryable signal; the Anthropic SDK
  already retries 429/5xx with backoff.
- Reconciliation mismatch is **surfaced** (`reconciled:false` + `discrepancy`),
  never hidden.

## Testing (personal tooling — manual, no test suite)

Per personal-tooling preference: design upfront, implement directly, test
manually. `reconcile` is a pure function and will be exercised with a few
hand-built cases inline. Validate end-to-end against a small set of REAL
statements (varied banks, one scanned) and eyeball the JSON + reconciliation.

## Out of scope (this spec)

- VPS deployment + RapidAPI listing (next phase).
- Exact `$` pricing-tier extraction from competitor pages (unrelated).
- Auto-escalation across model tiers (chose flat Sonnet 4.6).
- Persistence / accounts / dashboard — the service is stateless by design.

## Open implementation notes

- Confirm Sonnet 4.6 PDF page limits / image-token cost on a real multi-page
  statement with `count_tokens` before locking the prompt.
- Decide category taxonomy later (income, transfer, fee, purchase, …) — keep it
  optional in v1.
