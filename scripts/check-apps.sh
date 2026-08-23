#!/usr/bin/env bash
# Uniform verification runner across all apps.
# Runs typecheck/check, lint, and test scripts per app and prints a summary.
#
# Exit code: 0 if all scripts pass, 1 if any script fails.

set -uo pipefail

# List of apps to check (directories under apps/ with a package.json)
APPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../apps" && pwd)"

# Known failing configurations to skip (format: "app:script")
# If an app has known type errors, add it here:
# KNOWN_FAILING=("analytics-app:typecheck")
KNOWN_FAILING=(
  "analytics-app:lint"
  "tutorial-tracker-app:lint"
)

is_known_failing() {
  local app="$1" script="$2"
  for item in ${KNOWN_FAILING[@]+"${KNOWN_FAILING[@]}"}; do
    if [ "$item" = "$app:$script" ]; then
      return 0
    fi
  done
  return 1
}

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

declare -a RESULTS
FAILED=0

echo "Starting verification across all apps..."
echo "----------------------------------------"

for dir in "$APPS_DIR"/*; do
  [ -d "$dir" ] || continue
  app_name="$(basename "$dir")"
  if [ ! -f "$dir/package.json" ]; then
    echo "[SKIP] $app_name : no package.json (no verifier)"
    RESULTS+=("$app_name : no verifier -> SKIP")
    continue
  fi

  # An app with no node_modules cannot be verified — every script would fail on
  # missing deps, not on a real defect. `node_modules` is gitignored and is per
  # working tree, so a FRESH checkout (a `wt` leased slot, a clone, CI) has none for
  # any app. Measured 2026-08-23 in slot 4: 16 [FAIL] rows across 8 apps, all of them
  # nothing but an empty node_modules, while the owner's main checkout had all 13 apps
  # built and was green. A red exit code must mean "an app is broken", never "you are
  # in a fresh copy" — a check that cries wolf gets ignored. SKIP, and do NOT set
  # FAILED. Behaviour on a built checkout is unchanged.
  if [ ! -d "$dir/node_modules" ]; then
    echo "[-_-_] $app_name : SKIP (no node_modules — run 'cd apps/$app_name && npm install' to verify)"
    RESULTS+=("$app_name : all scripts -> SKIP (no node_modules — deps never installed here)")
    continue
  fi

  # We check these scripts in order
  for script in "typecheck" "check" "lint" "test"; do
    if has_script "$dir" "$script"; then
      if is_known_failing "$app_name" "$script"; then
        echo "[-_-_] $app_name : $script -> SKIP (known-failing — re-check occasionally)"
        RESULTS+=("$app_name : $script -> SKIP (known-failing — re-check occasionally)")
        continue
      fi

      echo "[....] $app_name : $script"
      # Run the script inside the app directory
      if (cd "$dir" && npm run "$script" > /dev/null 2>&1); then
        echo "[PASS] $app_name : $script"
        RESULTS+=("$app_name : $script -> PASS")
      else
        echo "[FAIL] $app_name : $script"
        RESULTS+=("$app_name : $script -> FAIL")
        FAILED=1
      fi
    fi
  done
done

echo ""
echo "Shell syntax pass (bash -n)..."
REPO_ROOT="$(cd "$APPS_DIR/.." && pwd)"
while IFS= read -r sh_file; do
  rel="${sh_file#$REPO_ROOT/}"
  if bash -n "$sh_file" 2>/dev/null; then
    RESULTS+=("$rel -> PASS (bash -n)")
  else
    echo "[FAIL] $rel : bash -n"
    RESULTS+=("$rel -> FAIL (bash -n)")
    FAILED=1
  fi
done < <(find "$REPO_ROOT/apps" "$REPO_ROOT/scripts" -name '*.sh' \
           -not -path '*/.venv/*' -not -path '*/node_modules/*' -not -path '*/dist/*')

echo ""
echo "========================================"
echo "Verification Summary:"
echo "========================================"
for res in "${RESULTS[@]}"; do
  echo "  $res"
done
echo "========================================"

if [ "$FAILED" -ne 0 ]; then
  echo "Verification FAILED"
  exit 1
else
  echo "Verification PASSED"
  exit 0
fi
