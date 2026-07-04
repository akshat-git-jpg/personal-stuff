"""The extraction step: hand a statement to Claude and get back a
StatementExtraction via structured outputs (`messages.parse`).

Single pass, no retries. Cost per call is therefore predictable: one model
call, output bounded by `max_tokens`. The reconciliation check in `reconcile`
is the trust signal — a document either reconciles on the first pass or it is
honestly reported as not reconciled. We never silently retry.

Model strategy (both default to Haiku for cost; bump the vision model to Sonnet
if scanned-statement accuracy needs it):
  - digital text    -> PARSER_TEXT_MODEL
  - scanned / image -> PARSER_VISION_MODEL

Every call returns (extraction, model_used) so the pipeline can record which
model produced the answer.
"""
from __future__ import annotations

import base64
import os

import anthropic

from .schema import StatementExtraction

TEXT_MODEL = os.environ.get("PARSER_TEXT_MODEL", "claude-haiku-4-5")
VISION_MODEL = os.environ.get("PARSER_VISION_MODEL", "claude-haiku-4-5")
MAX_TOKENS = int(os.environ.get("PARSER_MAX_TOKENS", "8000"))

SYSTEM_PROMPT = """You are a precise bank-statement extraction engine. You are given \
one bank or card statement (as text, a PDF, or an image) and must extract its \
contents into the required JSON schema. Follow these rules exactly:

- Extract EVERY transaction line. Do not summarise, skip, or merge rows. If the \
statement spans multiple pages, include transactions from all pages in order.
- amount is always a POSITIVE decimal number (e.g. 10.50). Encode money-in vs \
money-out with direction: "credit" for money in, "debit" for money out.
- Normalise all dates to ISO 8601 (YYYY-MM-DD). Infer the year from the \
statement period when a row shows only day/month.
- Capture the opening (brought-forward) and closing (carried-forward) balances \
for the period exactly as printed. These anchor a downstream balance check, so \
get them right.
- Mask the account number to the last 4 digits (e.g. "****1234").
- currency is the ISO 4217 code (USD, GBP, EUR, INR, ...).
- category is best-effort and optional. Leave it null if unsure.
- Set confidence to your honest 0-1 estimate that this is a genuine bank \
statement AND that you captured every transaction.
- Never invent data. If a field is not present, leave it null."""

_INSTRUCTION = "Extract this bank statement into the required schema."


class ExtractionError(RuntimeError):
    """The model could not return a usable extraction (refusal, truncation, etc.)."""

    def __init__(self, message: str, code: str = "extraction_failed"):
        super().__init__(message)
        self.code = code


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from the environment


def _system_blocks() -> list[dict]:
    # Stable system prompt caches across documents (~0.1x cost on the cached prefix).
    return [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]


def _parse(content: list[dict], model: str) -> StatementExtraction:
    resp = _client().messages.parse(
        model=model,
        max_tokens=MAX_TOKENS,
        system=_system_blocks(),
        messages=[{"role": "user", "content": content}],
        output_format=StatementExtraction,
    )
    if resp.stop_reason == "refusal":
        raise ExtractionError("The model refused to process this document.", "refused")
    if resp.stop_reason == "max_tokens":
        raise ExtractionError(
            "Statement is too long for a single pass (hit max_tokens).", "too_long"
        )
    if resp.parsed_output is None:
        raise ExtractionError("The model did not return a parseable extraction.", "unparseable")
    return resp.parsed_output


def extract_from_text(text: str, model: str = TEXT_MODEL):
    content = [{"type": "text", "text": f"{_INSTRUCTION}\n\n<statement>\n{text}\n</statement>"}]
    return _parse(content, model), model


def extract_from_pdf(pdf_bytes: bytes, model: str = VISION_MODEL):
    b64 = base64.standard_b64encode(pdf_bytes).decode("ascii")
    content = [
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
        {"type": "text", "text": _INSTRUCTION},
    ]
    return _parse(content, model), model


def extract_from_image(image_bytes: bytes, media_type: str, model: str = VISION_MODEL):
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    content = [
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
        {"type": "text", "text": _INSTRUCTION},
    ]
    return _parse(content, model), model
