"""OAuth credentials loader for the daily calendar digest.

Loads a vendored copy of akshat's combined-scope OAuth token from
`token.json` (this directory). The token is a copy of:

    mcp/google-shared/tokens/akshatpatidar17@gmail.com.json

Vendoring keeps this tool deployable standalone — VPS and GitHub Actions
runners don't have the parent `mcp/` tree.

The token JSON includes `client_id` and `client_secret` from the shared
OAuth client, so refresh works without a separate credentials.json file.

To rotate / refresh the vendored token, run `./deploy.sh` (copies the
latest shared token in and pushes to the VPS) or do it by hand:

    cp ../../../../tooling/mcp/google-shared/tokens/akshatpatidar17@gmail.com.json token.json
"""
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# This tool only reads calendar data, but the vendored token carries the
# shared combined-scope set. We accept whatever scopes the token already
# has — declaring a narrower set here would cause refresh to fail with
# invalid_scope (refresh sends the declared scopes; Google won't issue a
# refresh for a subset of what the refresh_token was originally granted).
BASE_DIR = Path(__file__).parent
TOKEN_FILE = BASE_DIR / "token.json"


def get_credentials() -> Credentials:
    if not TOKEN_FILE.exists():
        raise FileNotFoundError(
            f"token.json not found at {TOKEN_FILE}. "
            "Run ./deploy.sh to re-vendor it from the shared token, or copy "
            "manually from mcp/google-shared/tokens/<email>.json."
        )
    # scopes=None → use whatever scopes the token file declares
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())
    return creds
