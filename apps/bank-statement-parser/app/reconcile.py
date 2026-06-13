"""Deterministic post-processing: canonicalise a model extraction to integer
cents, compute the summary, and run the exact balance-reconciliation check.

This is the headline feature and it is pure (no I/O, no model). Because money is
converted to integer minor units before any arithmetic, the check is exact:
opening + credits - debits must EQUAL closing, with no tolerance fudge.

Also provides `merge_extractions`, used when a large statement is split into
page-chunks and extracted concurrently.
"""
from __future__ import annotations

from .schema import (
    Balances,
    Statement,
    StatementExtraction,
    Summary,
    Transaction,
    Validation,
)


def _to_cents(value: float | None) -> int | None:
    """Convert a decimal money value to integer minor units. Rounds each value
    individually to the nearest cent, which is exact for normal money."""
    if value is None:
        return None
    return int(round(value * 100))


def finalize(extraction: StatementExtraction) -> Statement:
    """Turn a model extraction into the final Statement (integer cents) with a
    computed summary and an exact reconciliation result."""
    txns = [
        Transaction(
            date=t.date,
            description=t.description,
            amount=_to_cents(t.amount) or 0,
            direction=t.direction,
            balance_after=_to_cents(t.balance_after),
            category=t.category,
        )
        for t in extraction.transactions
    ]

    credits = sum(t.amount for t in txns if t.direction == "credit")
    debits = sum(t.amount for t in txns if t.direction == "debit")
    summary = Summary(
        total_credits=credits, total_debits=debits, transaction_count=len(txns)
    )

    opening = _to_cents(extraction.balances.opening)
    closing = _to_cents(extraction.balances.closing)

    if opening is None or closing is None:
        validation = Validation(reconciled=False, discrepancy=0, confidence=extraction.confidence)
    else:
        discrepancy = closing - (opening + credits - debits)
        validation = Validation(
            reconciled=discrepancy == 0,
            discrepancy=discrepancy,
            confidence=extraction.confidence,
        )

    return Statement(
        account=extraction.account,
        period=extraction.period,
        balances=Balances(opening=opening, closing=closing),
        transactions=txns,
        summary=summary,
        validation=validation,
    )


def _first(*values):
    for v in values:
        if v is not None:
            return v
    return None


def merge_extractions(parts: list[StatementExtraction]) -> StatementExtraction:
    """Combine chunk extractions (pages 1-8, 9-16, ...) into one.

    Opening balance comes from the first chunk, closing from the last; account and
    period are filled field-by-field from the first non-null; transactions are
    concatenated in order; confidence is the most pessimistic chunk.
    """
    if len(parts) == 1:
        return parts[0]

    head, tail = parts[0], parts[-1]
    merged = StatementExtraction()
    # account / period: take the first non-null per field across all chunks
    for field in ("holder_name", "account_number_masked", "bank_name", "currency", "iban"):
        setattr(merged.account, field, _first(*(getattr(p.account, field) for p in parts)))
    for field in ("start_date", "end_date"):
        setattr(merged.period, field, _first(*(getattr(p.period, field) for p in parts)))

    merged.balances.opening = head.balances.opening
    merged.balances.closing = tail.balances.closing
    for p in parts:
        merged.transactions.extend(p.transactions)
    merged.confidence = min((p.confidence for p in parts), default=0.0)
    return merged
