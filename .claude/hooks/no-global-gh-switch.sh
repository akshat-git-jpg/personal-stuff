#!/usr/bin/env bash
# The wall: no command may move the GLOBAL GitHub identity.
#
# Two files on this Mac are read by every concurrent shell, every Claude session and
# every crew worktree at once:
#
#   ~/.config/gh/hosts.yml   the active gh account   <- `gh auth switch` writes here
#   ~/.gitconfig             the commit author       <- `git config --global` writes here
#
# Writing either one mid-flight re-points a parallel session. That is how kushal-zluri
# (work) came to comment on the public akshat-git-jpg/personal-stuff repo on 2026-07-30
# and 2026-08-01, routing GitHub notification mail to kushal.b@zluri.com, and it is why
# a work session and a personal session could never safely run side by side.
#
# Both halves now resolve per-repo with zero shared state:
#   commit author -> `includeIf "hasconfig:remote.*.url:…"` in ~/.gitconfig
#   push / API    -> GH_TOKEN, which is process-local:  eval "$(gh-acct export)"
#
# This hook stops anything from putting the shared state back. Registered as a
# PreToolUse (matcher: Bash) hook in the USER settings of BOTH accounts, not in this
# repo's .claude/settings.json — the ZluriHQ work repos are exactly where it must fire,
# and they never load this repo's settings.
#
# Deliberate one-off override: prefix the command with GUARD_OK=1.
set -u

INPUT="$(cat)"

# A JSON runtime, resolved once. macOS ships python3; Git Bash on Windows may ship
# neither python3 nor python, but every Claude Code install carries node.
JSON_RT=""; JSON_KIND=""
for c in python3 python py; do
  command -v "$c" >/dev/null 2>&1 && { JSON_RT="$c"; JSON_KIND=py; break; }
done
if [ -z "$JSON_RT" ] && command -v node >/dev/null 2>&1; then
  JSON_RT=node; JSON_KIND=node
fi

# Fail CLOSED, same as the other walls: a silently-absent guard is the failure it exists
# to prevent. One loud refusal beats a cross-account leak nobody sees.
if [ -z "$JSON_RT" ]; then
  echo "no-global-gh-switch: no JSON runtime on PATH (need python3, python, py or node)." >&2
  echo "  Refusing the command rather than passing it unchecked." >&2
  echo "  Deliberate one-off override: prefix the command with GUARD_OK=1" >&2
  exit 2
fi

json_field() {
  if [ "$JSON_KIND" = py ]; then
    printf '%s' "$INPUT" | "$JSON_RT" -c "
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d
for k in sys.argv[1].split('.'):
    v = v.get(k, {}) if isinstance(v, dict) else {}
print(v if isinstance(v, str) else '')
" "$1" 2>/dev/null
  else
    printf '%s' "$INPUT" | "$JSON_RT" -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  let v; try { v = JSON.parse(s); } catch (e) { return; }
  for (const k of process.argv[1].split(".")) {
    v = (v && typeof v === "object") ? v[k] : undefined;
  }
  console.log(typeof v === "string" ? v : "");
});' "$1" 2>/dev/null
  fi
}

CMD="$(json_field tool_input.command)"
[ -n "$CMD" ] || exit 0

# Deliberate human override, checked before anything else.
printf '%s' "$CMD" | grep -q 'GUARD_OK=1' && exit 0

# `rtk` proxies the command, so `rtk gh auth switch` must match too.
PFX='(^|[;&|(`]|[[:space:]])(rtk[[:space:]]+)?'

# --- 1. gh auth switch --------------------------------------------------------------
if printf '%s' "$CMD" | grep -qE "${PFX}gh[[:space:]]+auth[[:space:]]+switch([[:space:]]|$)"; then
  cat >&2 <<'EOF'
BLOCKED: `gh auth switch` moves the GLOBAL active account.

It rewrites ~/.config/gh/hosts.yml, which every other shell and Claude session on this
Mac reads. A parallel ZluriHQ session would start authenticating as the personal
account mid-push. Switch-and-restore does not fix it either — it only narrows the window.

Pin the account for THIS process instead:

    eval "$(gh-acct export)"          # resolves from the repo's remote
    gh-acct who                       # which account should this repo use?
    gh-acct check                     # does git user.email already match?

GH_TOKEN is process-local, so two sessions can push as two accounts at the same instant.
See tooling/cli/gh-acct/README.md. Override once with: GUARD_OK=1 <command>
EOF
  exit 2
fi

# --- 2. gh auth login ---------------------------------------------------------------
# Legitimate, but it needs a browser and it also rewrites the active account, so it is
# the owner's command to run in their own terminal — never a tool call.
if printf '%s' "$CMD" | grep -qE "${PFX}gh[[:space:]]+auth[[:space:]]+login([[:space:]]|$)"; then
  cat >&2 <<'EOF'
BLOCKED: `gh auth login` needs a browser and rewrites the global active account.

Ask the owner to run it in their own terminal:

    gh auth login -h github.com -p https -w

Then retry. Override once with: GUARD_OK=1 <command>
EOF
  exit 2
fi

# --- 3. git config --global / --system user.email|user.name -------------------------
# Matches either flag order: `--global user.email x` and `user.email --global x`.
if printf '%s' "$CMD" | grep -qE "${PFX}(rtk[[:space:]]+)?git([[:space:]]+-{1,2}[^[:space:]]+)*[[:space:]]+config([[:space:]]+[^[:space:]]+)*[[:space:]]+--(global|system)([[:space:]]|$)" \
   && printf '%s' "$CMD" | grep -qE "user\.(email|name)"; then
  # A read is harmless; only a write moves the identity.
  if printf '%s' "$CMD" | grep -qE -- "--(get|get-all|list|show-origin|unset)([[:space:]]|$)"; then
    exit 0
  fi
  cat >&2 <<'EOF'
BLOCKED: `git config --global user.email/user.name` moves the identity for EVERY repo.

~/.gitconfig already routes the author by the repo's remote:

    github.com/ZluriHQ/*        -> kushal.b@zluri.com
    github.com/akshat-git-jpg/* -> akshatparty17@gmail.com
    github.com/koala25/*        -> kushalbakliwal25@gmail.com

Git evaluates that per repo, at commit time, writing nothing — which is what lets two
sessions commit as two accounts at once. A --global write destroys that.

  Wrong author in one repo?   gh-acct check          (says exactly what to run)
  Repo with a new remote?     add an includeIf block to ~/.gitconfig
  Genuinely repo-specific?    git config user.email "…"   (no --global)

Override once with: GUARD_OK=1 <command>
EOF
  exit 2
fi

exit 0
