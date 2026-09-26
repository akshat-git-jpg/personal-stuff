"""Open a password-protected statement PDF and return its text."""

from __future__ import annotations

from pathlib import Path

import pypdf


class ParseError(RuntimeError):
    """A statement that cannot be trusted. Never returns partial rows."""


def read_text(path, passwords):
    """Try each password in turn. Raises ParseError if none opens the file."""
    reader = pypdf.PdfReader(str(path))
    if reader.is_encrypted:
        for pw in passwords:
            if pw and reader.decrypt(pw):
                break
        else:
            raise ParseError("no saved password opens %s" % Path(path).name)
    return "\n".join(p.extract_text() or "" for p in reader.pages)
