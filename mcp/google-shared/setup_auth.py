"""One-time OAuth consent for a single account.

Usage:
    python3 setup_auth.py <account_email>

Opens a browser; on approval, writes the combined-scope token to
tokens/<account_email>.json. The token auto-refreshes from then on.
"""
import sys

from google_auth import run_consent

if len(sys.argv) != 2:
    print("usage: python3 setup_auth.py <account_email>", file=sys.stderr)
    sys.exit(2)

email = sys.argv[1]
creds = run_consent(email)
print(f"token written for {email}. valid={creds.valid}")
