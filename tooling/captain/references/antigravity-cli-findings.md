# Antigravity CLI findings (gemini CLI replacement)

Dated 2026-07-06. Investigation triggered by the owner's `gemini` CLI throwing
`IneligibleTierError` on every call. Short version: the gemini CLI is dead for
individual accounts, and the Antigravity CLI (`agy`) is the working replacement,
already authenticated against the owner's Google AI Pro sub.

## What broke

The `gemini` CLI (v0.49.0, still installed at `~/.npm-global/bin/gemini`) fails
at auth setup before any prompt runs:

```
IneligibleTierError: This client is no longer supported for Gemini Code Assist
for individuals. To continue using Gemini, please migrate to the Antigravity
suite of products.
  tierId:  'free-tier'  reason: UNSUPPORTED_CLIENT
```

This is not a misconfiguration. On 2026-06-18 Google cut the gemini CLI off
from all individual accounts and pointed everyone at Antigravity. Per Google's
own announcement, the CLI stopped serving Google AI Pro, AI Ultra, and free-tier
individual accounts on that date. Only two paths still work with the old CLI:
an enterprise Gemini Code Assist license, or a `GEMINI_API_KEY` (which bills
separately from the AI Pro sub and does not draw on it).

So the owner's AI Pro subscription cannot revive the gemini CLI. It was never a
recognized auth path for that client, and Google closed the door the CLI did use.

## What works: `agy`

The Antigravity CLI is a terminal front-end on the same agent engine as the
Antigravity IDE. Both run the same core; the CLI is the headless, SSH-friendly,
scriptable face of it. It accepts the AI Pro sub directly, which is exactly the
migration Google set up.

Installed and verified on this machine:

- Binary: `agy` v1.0.16 at `~/.local/bin/agy` (installed via
  `curl -fsSL https://antigravity.google/cli/install.sh | bash`, which
  SHA512-verifies the download from a Google Cloud Run host).
- PATH: the installer appended `~/.local/bin` to `.zshrc` and `.zprofile`.
  A shell opened before the install needs a new session (or a manual
  `export PATH="$HOME/.local/bin:$PATH"`) to see `agy`.
- Auth: no login prompt. `agy` picked up the existing Google session from the
  system keyring (shared with the installed Antigravity IDE), so the AI Pro
  account drives it out of the box.
- Live test: `agy -p "Reply with exactly: pong"` returned `pong`, exit 0.

## Models available through the AI Pro sub

```
Gemini 3.5 Flash (Low / Medium / High)
Gemini 3.1 Pro (Low / High)
Claude Sonnet 4.6 (Thinking)
Claude Opus 4.6 (Thinking)
GPT-OSS 120B (Medium)
```

Worth noting: Claude Opus 4.6 and Sonnet 4.6 are reachable through the same
subscription. Pick a model per call with `--model`.

## Token / usage visibility

`agy -p` does not print per-call token counts. Usage meters against the AI Pro
plan quota, which the owner reads in the Antigravity app, not from the CLI. If
per-call token accounting is ever the actual requirement, that is the
`GEMINI_API_KEY` path (it reports usage, but bills separately from AI Pro).

## Command reference

```bash
agy                                              # interactive session
agy -p "prompt"                                  # one-shot, print, exit
agy --model "Gemini 3.1 Pro (High)" -p "prompt"  # choose model
agy --dangerously-skip-permissions -p "prompt"   # auto-approve tools (careful)
agy models                                       # list models
agy update                                        # self-update
```

## Captain implication (not yet adopted)

The current `antigravity` lane drives the IDE through `aglock`: one IDE, one
workspace, batches serialize. `agy` is headless and has no such lock, so an
`agy`-based lane could parallelize where aglock currently queues, and could run
Gemini or Claude models under the owner's sub with no per-call API bill. This is
a real routing decision for the owner, not something to switch on silently. Left
as a backlog note rather than a change.

## Sources

- Gemini CLI (official): transition to Antigravity CLI, individual accounts cut off
  https://x.com/geminicli/status/2067702889837953512
- GitHub Discussion #28017: gemini CLI stopped serving individual accounts
  https://github.com/google-gemini/gemini-cli/discussions/28017
- Google Developers Blog: transitioning Gemini CLI to Antigravity CLI
  https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/
- Gemini Code Assist consumer accounts deprecation docs
  https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals
- Antigravity CLI repo (install, commands)
  https://github.com/google-antigravity/antigravity-cli
