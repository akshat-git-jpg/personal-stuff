#!/usr/bin/env python3
"""agy PreToolUse guard: deny tool calls referencing secret material.

Compensating control for --dangerously-skip-permissions on headless agy runs
(a workspace-unbound agy roamed into ~/.gemini key files, 2026-07-06 — see
tooling/captain/references/antigravity-cli-findings.md). Contract: hook JSON
on stdin -> {"decision": "allow"|"deny", "reason": ...} on stdout.
"""
import json, re, sys

try:
    payload = json.load(sys.stdin)
except Exception:
    print(json.dumps({"decision": "allow"})); raise SystemExit

blob = json.dumps(payload.get("toolCall", {}))

DENY = [
    # Deny infra/secrets/<name> unless <name> ends in .example. The lookahead
    # is bounded to the matched path TOKEN (stops at quote/whitespace/backslash)
    # so a .example appearing elsewhere in the serialized payload cannot exempt
    # a real secret path. (Prior r"infra/secrets/(?!.*\.example)" scanned the
    # whole blob and let a stray .example anywhere allow a real secret through.)
    r"infra/secrets/(?![^\s\"'\\]*\.example(?:[\s\"'\\]|$))",
    r"credentials\.json",
    r"\.dev\.vars",
    r"google-shared/tokens",
    r"/\.gemini(?![a-zA-Z])",
    r"/\.ssh(?![a-zA-Z])",
    r"PlaintextKeyMaterial",
    r"/\.config/pp-",
    r"telegram\.env",
    r"hostinger-vps\.env",
]

for pat in DENY:
    if re.search(pat, blob):
        print(json.dumps({
            "decision": "deny",
            "reason": ("secrets-guard: tool call references protected secret "
                       f"material ({pat}). Secrets are owner-only; use *.example files instead."),
        }))
        raise SystemExit

print(json.dumps({"decision": "allow"}))
