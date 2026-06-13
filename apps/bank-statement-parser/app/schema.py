"""Pydantic models.

Two shapes:
  - `StatementExtraction` is what Claude fills. It uses decimal amounts because
    that is how money is printed and how the model naturally reads it.
  - `Statement` is what the API returns. Money is canonicalised to INTEGER MINOR
    UNITS (cents): 1050 means 10.50. We convert decimals -> cents once, in
    `reconcile.finalize`, so all balance math is exact integer arithmetic and the
    reconciliation check never suffers a floating-point rounding error.

Amounts assume a 2-decimal currency (the common case). The `currency` field still
tells the caller the ISO code; zero/three-decimal currencies are a later concern.
Dates are ISO 8601 strings (YYYY-MM-DD).
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0"


class Account(BaseModel):
    holder_name: Optional[str] = Field(None, description="Account holder's full name")
    account_number_masked: Optional[str] = Field(
        None, description="Account number masked to the last 4 digits, e.g. ****1234"
    )
    bank_name: Optional[str] = Field(None, description="Issuing bank or institution name")
    currency: Optional[str] = Field(None, description="ISO 4217 currency code, e.g. USD, GBP, INR")
    iban: Optional[str] = Field(None, description="IBAN if present")


class Period(BaseModel):
    start_date: Optional[str] = Field(None, description="Period start, ISO 8601 YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="Period end, ISO 8601 YYYY-MM-DD")


# ---- model-facing (decimal money) -------------------------------------------------

class _DecimalBalances(BaseModel):
    opening: Optional[float] = Field(None, description="Opening/brought-forward balance")
    closing: Optional[float] = Field(None, description="Closing/carried-forward balance")


class _DecimalTransaction(BaseModel):
    date: Optional[str] = Field(None, description="Transaction date, ISO 8601 YYYY-MM-DD")
    description: Optional[str] = Field(None, description="Transaction narrative as printed")
    amount: float = Field(..., description="Absolute amount, always positive (e.g. 10.50)")
    direction: Literal["debit", "credit"] = Field(
        ..., description="'debit' = money out, 'credit' = money in"
    )
    balance_after: Optional[float] = Field(None, description="Running balance after this row")
    category: Optional[str] = Field(
        None, description="Best-effort: income, transfer, fee, purchase, atm, interest, ..."
    )


class StatementExtraction(BaseModel):
    """What Claude is asked to fill — facts read off the statement only.

    No summary/validation: we compute those so the trust signal is deterministic.
    """

    account: Account = Field(default_factory=Account)
    period: Period = Field(default_factory=Period)
    balances: _DecimalBalances = Field(default_factory=_DecimalBalances)
    transactions: list[_DecimalTransaction] = Field(default_factory=list)
    confidence: float = Field(
        0.0,
        description="Your 0-1 confidence that this is a real bank statement and that "
        "you captured every transaction.",
    )


# ---- API-facing (integer cents) ---------------------------------------------------

class Balances(BaseModel):
    opening: Optional[int] = Field(None, description="Opening balance in minor units (cents)")
    closing: Optional[int] = Field(None, description="Closing balance in minor units (cents)")


class Transaction(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: int = Field(..., description="Absolute amount in minor units (cents), always positive")
    direction: Literal["debit", "credit"]
    balance_after: Optional[int] = Field(None, description="Running balance in minor units")
    category: Optional[str] = None


class Summary(BaseModel):
    total_credits: int = Field(0, description="Sum of credit amounts, in minor units")
    total_debits: int = Field(0, description="Sum of debit amounts, in minor units")
    transaction_count: int = 0


class Validation(BaseModel):
    reconciled: bool = Field(
        False, description="True when opening + credits - debits exactly equals closing"
    )
    discrepancy: int = Field(
        0, description="closing - (opening + credits - debits), in minor units; 0 when reconciled"
    )
    confidence: float = Field(0.0, description="0-1 confidence this is a fully-parsed statement")


class Meta(BaseModel):
    schema_version: str = SCHEMA_VERSION
    input_type: str = Field("", description="digital_pdf | scanned_pdf | image")
    pages: int = 0
    model: str = Field("", description="Model used for the extraction")
    processing_ms: int = 0
    cached: bool = False
    raw_text: Optional[str] = Field(None, description="Extracted text; only when ?include=raw_text")


class Statement(BaseModel):
    """The full structured result returned by the API."""

    account: Account = Field(default_factory=Account)
    period: Period = Field(default_factory=Period)
    balances: Balances = Field(default_factory=Balances)
    transactions: list[Transaction] = Field(default_factory=list)
    summary: Summary = Field(default_factory=Summary)
    validation: Validation = Field(default_factory=Validation)
    meta: Meta = Field(default_factory=Meta)
