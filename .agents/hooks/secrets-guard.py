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
    r"infra/secrets/(?!.*\.example)",
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
