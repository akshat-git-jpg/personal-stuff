"""Google Sheets + YouTube URL helpers."""

import re

import gspread
from google.oauth2.service_account import Credentials

from .env import get_credentials_path

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

_YT_ID_PATTERNS = [
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/watch\?[^\s]*v=([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/shorts/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/embed/([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/live/([A-Za-z0-9_-]{11})"),
]

_SHEET_ID_RE = re.compile(r"/spreadsheets/d/([A-Za-z0-9_-]+)")


def get_gspread_client():
    creds = Credentials.from_service_account_file(get_credentials_path(), scopes=SCOPES)
    return gspread.authorize(creds)


def col_letter(idx_zero_based):
    n = idx_zero_based + 1
    out = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        out = chr(65 + r) + out
    return out


def extract_sheet_id(url):
    """Pull the sheet ID out of any Google Sheets URL like
    https://docs.google.com/spreadsheets/d/<ID>/edit?... -> '<ID>'.

    Raises ValueError if the URL is empty or doesn't match.
    """
    if not url:
        raise ValueError("Sheet URL is empty or None")
    m = _SHEET_ID_RE.search(url)
    if not m:
        raise ValueError(f"Could not extract sheet ID from URL: {url!r}")
    return m.group(1)


def extract_video_id(url):
    if not url:
        return None
    url = url.strip()
    for pat in _YT_ID_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", url):
        return url
    return None
