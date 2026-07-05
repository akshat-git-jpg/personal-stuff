#!/usr/bin/env bash
# DEPLOYS TO PRODUCTION; dry-run first; the per-app quirks (patch-routes etc.)
# live in each app's own `deploy` script on purpose — never inline app-specific logic here.

set -uo pipefail

DRY_RUN=0
SKIP_CHECKS=0
ONLY=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=1 ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    --only) ONLY="$2"; shift ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

APPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps" && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$SKIP_CHECKS" -eq 0 ]; then
  if ! "$SCRIPTS_DIR/check-apps.sh"; then
    echo "gate FAILED — no deploys"
    exit 1
  fi
fi

has_script() {
  local app_dir="$1" script="$2"
  node -e '
    try {
      const pkg = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      process.exit((pkg.scripts && pkg.scripts[process.argv[2]]) ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$app_dir/package.json" "$script"
}

get_script() {
  local app_dir="$1" script="$2"
  node -e '
    try {
      const pkg = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      console.log(pkg.scripts[process.argv[2]] || "");
    } catch {
      console.log("");
    }
  ' "$app_dir/package.json" "$script"
}

IFS=',' read -ra ONLY_APPS <<< "$ONLY"

if [ ${#ONLY_APPS[@]} -gt 0 ]; then
  for only_app in "${ONLY_APPS[@]}"; do
    if [ ! -d "$APPS_DIR/$only_app" ]; then
      echo "Error: Unknown app $only_app"
      exit 1
    fi
  done
fi

declare -a RESULTS
FAILED=0

for dir in "$APPS_DIR"/*; do
  [ -d "$dir" ] || continue
  app_name="$(basename "$dir")"
  
  if [ -f "$dir/package.json" ] && has_script "$dir" "deploy"; then
    skip=0
    if [ ${#ONLY_APPS[@]} -gt 0 ]; then
      skip=1
      for only_app in "${ONLY_APPS[@]}"; do
        if [ "$app_name" = "$only_app" ]; then
          skip=0
          break
        fi
      done
    fi
    [ "$skip" -eq 1 ] && continue

    echo "==> $app_name"
    if [ "$DRY_RUN" -eq 1 ]; then
      script_text=$(get_script "$dir" "deploy")
      echo "DRY: $app_name :: $script_text"
      RESULTS+=("$app_name : deploy -> PASS (dry-run)")
    else
      if (cd "$dir" && npm run deploy); then
        RESULTS+=("$app_name : deploy -> PASS")
      else
        RESULTS+=("$app_name : deploy -> FAIL")
        FAILED=1
      fi
    fi
  fi
done

echo ""
echo "========================================"
echo "Deploy Summary:"
echo "========================================"
for res in "${RESULTS[@]}"; do
  echo "  $res"
done
echo "========================================"

if [ "$FAILED" -ne 0 ]; then
  exit 1
else
  exit 0
fi
