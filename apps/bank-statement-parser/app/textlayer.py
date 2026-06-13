"""Text-layer detection for PDFs.

A digital PDF (exported from online banking) has a real text layer we can pull
cheaply with pdfplumber and hand to Claude as text — far fewer tokens than
rendering pages as images. A scanned/photographed PDF has little or no text
layer, so we fall back to the vision path.

Returns per-page text as well, so a large statement can be split into page-chunks
and extracted concurrently.
"""
from __future__ import annotations

import io

import pdfplumber

MIN_CHARS = 120


def extract_pages(pdf_bytes: bytes) -> tuple[bool, list[str]]:
    """Return (has_usable_text_layer, per_page_text).

    `has_usable_text_layer` is True when the whole document yields at least
    MIN_CHARS of extractable text.
    """
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            pages.append((page.extract_text() or "").strip())
    total = sum(len(p) for p in pages)
    return (total >= MIN_CHARS, pages)
