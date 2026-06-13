"""Intake: validate and classify an uploaded file in memory.

No file ever touches disk. We sniff the type from magic bytes (not just the
client-supplied content-type, which lies), enforce a size cap, and reject
encrypted PDFs early with a clear signal.
"""
from __future__ import annotations

import io
from dataclasses import dataclass

from pypdf import PdfReader
from pypdf.errors import PdfReadError

# Recognised image types -> Claude image media_type.
_IMAGE_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"GIF87a": "image/gif",
    b"GIF89a": "image/gif",
    b"RIFF": "image/webp",  # WEBP starts with RIFF....WEBP
}


class IntakeError(ValueError):
    """A problem the caller caused — maps to a 4xx. Carries an HTTP status and a
    stable machine-readable code."""

    def __init__(self, message: str, status: int = 400, code: str = "bad_request"):
        super().__init__(message)
        self.status = status
        self.code = code


@dataclass
class Intake:
    kind: str  # "pdf" | "image"
    media_type: str  # MIME, e.g. application/pdf, image/png
    data: bytes
    pages: int = 1  # PDF page count; 1 for images


def _sniff_image(data: bytes) -> str | None:
    for magic, media in _IMAGE_MAGIC.items():
        if data.startswith(magic):
            if media == "image/webp" and data[8:12] != b"WEBP":
                continue
            return media
    return None


def classify(data: bytes, max_bytes: int, max_pages: int = 0) -> Intake:
    """Decide whether the upload is a usable PDF or image, or reject it.

    `max_pages` (when > 0) caps PDF page count so per-request cost stays bounded.
    """
    if not data:
        raise IntakeError("Empty file.", status=400, code="empty_file")
    if len(data) > max_bytes:
        raise IntakeError(
            f"File too large ({len(data)} bytes). Limit is {max_bytes} bytes.",
            status=413,
            code="file_too_large",
        )

    if data.startswith(b"%PDF"):
        try:
            reader = PdfReader(io.BytesIO(data))
        except PdfReadError as e:
            raise IntakeError(f"Corrupt or unreadable PDF: {e}", status=400, code="corrupt_pdf") from e
        if reader.is_encrypted:
            # pypdf reports encrypted even for owner-locked PDFs; either way we
            # can't reliably read it without the password.
            raise IntakeError(
                "PDF is password-protected. Remove the password and retry.",
                status=422,
                code="password_protected",
            )
        pages = len(reader.pages)
        if max_pages and pages > max_pages:
            raise IntakeError(
                f"Statement has {pages} pages; the limit is {max_pages}. "
                "Split it into smaller files and retry.",
                status=413,
                code="too_many_pages",
            )
        return Intake(kind="pdf", media_type="application/pdf", data=data, pages=pages)

    image_media = _sniff_image(data)
    if image_media:
        return Intake(kind="image", media_type=image_media, data=data, pages=1)

    raise IntakeError(
        "Unsupported file type. Send a PDF or an image (JPEG/PNG/GIF/WebP).",
        status=415,
        code="unsupported_type",
    )
