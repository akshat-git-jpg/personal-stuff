"""Shared utilities for yt-analysis scripts.

Importing this module:
  - Loads myproj/.env into os.environ
  - Exposes get_gspread_client(), col_letter(), extract_video_id()
"""

import os
import re

import gspread
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MYPROJ_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))

load_dotenv(dotenv_path=os.path.join(MYPROJ_ROOT, ".env"))

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


def get_credentials_path():
    name = os.getenv("CREDENTIALS_FILE", "credentials.json")
    return name if os.path.isabs(name) else os.path.join(MYPROJ_ROOT, name)


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
