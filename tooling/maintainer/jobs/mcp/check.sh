#!/bin/bash
# mcp - the mechanical half. Reports; changes nothing.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# MCP_JSON and MCP_REGEN let the test point this at fixtures.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

CFG="${MCP_JSON:-$REPO_ROOT/.mcp.json}"
REGEN="${MCP_REGEN:-$REPO_ROOT/scripts/regen-mcp-json.sh}"

found=0
note() { echo "- $1"; found=1; }

echo "# mcp findings - $(today)"
echo

[ -f "$CFG" ] || { echo "no .mcp.json at $CFG - nothing configured"; exit 0; }

echo "## 1. servers the generator would DROP"
echo "(.mcp.json is gitignored and regenerated from the script. A server in the live"
echo " file but not in the generator disappears the next time anyone regenerates.)"
live="$(python3 -c "import json,io,sys; d=json.load(io.open(sys.argv[1])); print('\n'.join((d.get('mcpServers') or d).keys()))" "$CFG" 2>/dev/null)" \
  || die "cannot parse $CFG as JSON"
for s in $live; do
  if [ -f "$REGEN" ] && ! "$GREP" -q "\"$s\"" "$REGEN"; then
    note "DROPPED-BY-REGEN $s (in .mcp.json, absent from $(basename "$REGEN"))"
  fi
done
echo

echo "## 2. server entry points that do not exist on disk"
python3 -c "
import json,io,sys,os
d=json.load(io.open(sys.argv[1])); srv=d.get('mcpServers') or d
for name,v in srv.items():
    for a in v.get('args',[]):
        if a.startswith('/') and not os.path.exists(a):
            print('- MISSING-ENTRYPOINT %s -> %s' % (name,a))
    c=v.get('command','')
    if c.startswith('/') and not os.path.exists(c):
        print('- MISSING-COMMAND %s -> %s' % (name,c))
" "$CFG" || die "cannot inspect server entry points in $CFG"
echo

echo "## 3. env files a server expects that are not there"
for py in "$REPO_ROOT"/tooling/mcp/*/server.py; do
  [ -f "$py" ] || continue
  "$GREP" -oE '[A-Za-z0-9_./-]+/\.env' "$py" 2>/dev/null | sort -u | while read -r envp; do
    case "$envp" in /*) abs="$envp" ;; *) abs="$REPO_ROOT/$envp" ;; esac
    [ -f "$abs" ] || echo "- MISSING-ENVFILE $(basename "$(dirname "$py")") expects $envp"
  done
done
echo

echo "## 4. documented vs configured - A CANDIDATE LIST, NEVER A VERDICT"
echo "(a server nobody has used lately is still not evidence it is unused. An unused"
echo " server is something to ASK about, never something to remove automatically.)"
for s in $live; do
  "$GREP" -q "$s" "$REPO_ROOT/tooling/mcp/README.md" 2>/dev/null \
    || echo "- configured but undocumented: $s"
done

exit $found
