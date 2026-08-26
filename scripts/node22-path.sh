#!/usr/bin/env bash
# SOURCE this (do not execute) to put Node >=22 on PATH for the current shell.
#
# Why: every Worker in this repo (the 10 apps in apps/ that carry wrangler in
# devDependencies, plus infra/vps-watchdog) ships wrangler >=4, and wrangler HARD-REFUSES
# to run on Node < 22 ("Wrangler requires at least Node.js v22.0.0"). The Mac default is
# deliberately Node 20, because the owner's Zluri work repos need 20. Nothing INSIDE
# personal-stuff needs 20 — the split is repo-shaped — so this raises Node only for the
# commands that need it and never touches the machine default.
#
# Do NOT "fix" this with .nvmrc / volta / .node-version: those pin a whole project, while
# the Node-20 requirement lives in OTHER repos where such a pin has no reach. And do not
# rely on a shell hook keyed on $PWD: boss crews run in ~/kb-scratch/worktrees, outside
# this repo's path, so a cwd-based trick silently misses every automated deploy.
#
# Usage:
#   . scripts/node22-path.sh            # before any wrangler call
#   . scripts/node22-path.sh || exit 1  # when the caller must abort if unavailable
#
# Idempotent, and a no-op when the current node is already >=22.

node22_path() {
  local want=22 cur=0

  # Already good? leave PATH alone.
  if command -v node >/dev/null 2>&1; then
    cur=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
    case "$cur" in ''|*[!0-9]*) cur=0 ;; esac
    [ "$cur" -ge "$want" ] && return 0
  fi

  # Candidate homes, cheapest first; brew --prefix is authoritative but slow, so the
  # well-known symlink is tried before shelling out to brew.
  local c dir="" brewdir=""
  command -v brew >/dev/null 2>&1 && brewdir=$(brew --prefix "node@${want}" 2>/dev/null)
  for c in "/opt/homebrew/opt/node@${want}/bin" "/usr/local/opt/node@${want}/bin" "${brewdir:+$brewdir/bin}"; do
    [ -n "$c" ] && [ -x "$c/node" ] && { dir="$c"; break; }
  done

  # Linux and WSL2 have no Homebrew. nvm, fnm and volta each keep every version under its
  # own prefix, so there is no "node@22" symlink to probe: enumerate the installed
  # versions newest-first and take the first one that is actually >= $want. Only runs
  # when the Homebrew probes above found nothing, so macOS pays nothing for it.
  if [ -z "$dir" ]; then
    local cand v
    for cand in $(ls -d "${NVM_DIR:-$HOME/.nvm}"/versions/node/v* \
                        "$HOME/.local/share/fnm/node-versions"/*/installation \
                        "$HOME/.volta/tools/image/node"/* 2>/dev/null | sort -r); do
      [ -x "$cand/bin/node" ] || continue
      v=$("$cand/bin/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
      case "$v" in ''|*[!0-9]*) v=0 ;; esac
      [ "$v" -ge "$want" ] && { dir="$cand/bin"; break; }
    done
  fi

  if [ -z "$dir" ]; then
    echo "FATAL: Node >=${want} not found, and wrangler refuses to run on Node ${cur}." >&2
    echo "       Install it — this does NOT change your default node:" >&2
    case "$(uname -s)" in
      Darwin) echo "         brew install node@${want}" >&2 ;;
      *)      echo "         nvm install ${want}      (or: fnm install ${want})" >&2 ;;
    esac
    return 1
  fi

  # Prepend, stripping any prior copy so repeated sourcing cannot grow PATH.
  case ":$PATH:" in
    *":$dir:"*) PATH=$(printf '%s' "$PATH" | tr ':' '\n' | grep -vxF "$dir" | paste -sd: -) ;;
  esac
  PATH="$dir:$PATH"
  export PATH
  hash -r 2>/dev/null || true
  return 0
}

node22_path
