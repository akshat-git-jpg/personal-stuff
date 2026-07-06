# STATUS: SHARED-AUTH — imported by all tooling/cli google CLIs; do not move
"""Shared OAuth helper for all Google MCP servers (Sheets, Gmail, Tasks,
Calendar, Drive, YouTube, ...).

One OAuth Desktop client (credentials.json) and one combined-scope token
per Google account in tokens/<email>.json. Each tool call passes the full
email address to select which account to act as.

Adding a new scope to SCOPES requires re-running setup_auth.py for each
account (Google needs fresh consent for the new scope).
"""
from __future__ import annotations

import re
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/youtube",
]

BASE_DIR = Path(__file__).parent
CREDENTIALS_FILE = BASE_DIR / "credentials.json"
TOKENS_DIR = BASE_DIR / "tokens"

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _validate_email(account_email: str) -> None:
    if not isinstance(account_email, str) or not _EMAIL_RE.match(account_email):
        raise ValueError(
            f"account must be a full email address, got: {account_email!r}"
        )


def token_path(account_email: str) -> Path:
    _validate_email(account_email)
    return TOKENS_DIR / f"{account_email}.json"


def get_credentials(account_email: str) -> Credentials:
    """Return refreshed OAuth credentials for the given account email.

    Raises a clear error pointing to setup_auth.py if no token exists or the
    existing one cannot refresh.
    """
    token_file = token_path(account_email)

    if not token_file.exists():
        raise RuntimeError(
            f"No token for {account_email}. Run the one-time consent:\n"
            f"    python3 \"{BASE_DIR}/setup_auth.py\" {account_email}"
        )

    # Load whatever scopes the token file already declares (scopes=None) rather
    # than forcing the current SCOPES constant. Refresh sends the declared
    # scopes to Google; a refresh_token only covers what it was originally
    # granted, so forcing a superset (e.g. after SCOPES gains a new entry)
    # fails with invalid_scope even though the token is otherwise healthy.
    creds = Credentials.from_authorized_user_file(str(token_file))
    if creds.valid:
        return creds
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKENS_DIR.mkdir(exist_ok=True)
        token_file.write_text(creds.to_json())
        return creds
    raise RuntimeError(
        f"Token for {account_email} is invalid and cannot refresh. Re-run:\n"
        f"    python3 \"{BASE_DIR}/setup_auth.py\" {account_email}"
    )


def run_consent(account_email: str) -> Credentials:
    """One-time browser consent for an account. Writes tokens/<email>.json."""
    _validate_email(account_email)
    if not CREDENTIALS_FILE.exists():
        raise FileNotFoundError(
            f"credentials.json missing at {CREDENTIALS_FILE}. "
            "Place the OAuth Desktop client JSON here first."
        )
    flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
    creds = flow.run_local_server(port=0)
    TOKENS_DIR.mkdir(exist_ok=True)
    token_path(account_email).write_text(creds.to_json())
    return creds


def list_accounts() -> list[str]:
    """Emails of accounts that currently have a token."""
    if not TOKENS_DIR.exists():
        return []
    return sorted(p.stem for p in TOKENS_DIR.glob("*.json"))
