"""Split large statements into page-chunks so they can be extracted concurrently
and kept under the model's token cap.

- `split_pdf` carves a PDF into smaller PDFs of `chunk_pages` pages each (for the
  scanned/vision path).
- `group_text` joins per-page text into chunk-sized blocks (for the digital path).
"""
from __future__ import annotations

import io

from pypdf import PdfReader, PdfWriter


def split_pdf(pdf_bytes: bytes, chunk_pages: int) -> list[bytes]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    out: list[bytes] = []
    for start in range(0, len(reader.pages), chunk_pages):
        writer = PdfWriter()
        for page in reader.pages[start : start + chunk_pages]:
            writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        out.append(buf.getvalue())
    return out


def group_text(pages_text: list[str], chunk_pages: int) -> list[str]:
    groups: list[str] = []
    for start in range(0, len(pages_text), chunk_pages):
        groups.append("\n".join(pages_text[start : start + chunk_pages]).strip())
    return groups
