"""Affiliate Programs sheet reader + tool name normalization."""

import os
import re
from dataclasses import dataclass

from .sheets import extract_sheet_id, get_gspread_client


@dataclass(frozen=True)
class AffiliateRecord:
    tool: str
    display_name: str
    target_url: str
    approval_status: str
    coupon_status: str
    coupon_code: str

    @property
    def is_approved(self) -> bool:
        return self.approval_status.strip().lower() == "approved"


def normalize_tool_name(name: str) -> str:
    if not name or not name.strip():
        raise ValueError("Tool name is empty")
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def load_affiliate_records() -> dict[str, AffiliateRecord]:
    sheet_url = os.getenv("AFFILIATE_PROGRAMS_SHEET_URL")
    if not sheet_url:
        raise RuntimeError("AFFILIATE_PROGRAMS_SHEET_URL not set in .env")

    client = get_gspread_client()
    ws = client.open_by_key(extract_sheet_id(sheet_url)).worksheet("Sheet1")
    rows = ws.get_all_values()
    if not rows or len(rows) < 2:
        return {}

    header = [h.strip() for h in rows[0]]
    idx = {h: i for i, h in enumerate(header)}

    def cell(row, col):
        i = idx.get(col)
        return row[i].strip() if i is not None and i < len(row) else ""

    records: dict[str, AffiliateRecord] = {}
    for row in rows[1:]:
        display = cell(row, "Affiliate Program")
        if not display:
            continue
        try:
            slug = normalize_tool_name(display)
        except ValueError:
            continue
        records[slug] = AffiliateRecord(
            tool=slug,
            display_name=display,
            target_url=cell(row, "My Affiliate Link"),
            approval_status=cell(row, "Approval Status"),
            coupon_status=cell(row, "Coupon Status"),
            coupon_code=cell(row, "Coupon Code"),
        )
    return records
