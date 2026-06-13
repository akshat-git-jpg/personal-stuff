"""Thin shim that delegates auth to mcp/google-shared/google_auth.py.

Mirrors the same pattern used by mcp/gmail-mcp-server/auth.py so the CLI
and MCP share one OAuth token cache per account.
"""
import sys
from pathlib import Path

_SHARED_DIR = Path(__file__).resolve().parent.parent.parent / "mcp" / "google-shared"
if str(_SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(_SHARED_DIR))

from google_auth import get_credentials, list_accounts  # noqa: E402,F401
