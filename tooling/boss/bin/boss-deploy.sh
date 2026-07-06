#!/bin/bash
# boss-deploy.sh <pr#> --yes — run the plan's deploy cmd on the main checkout.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-deploy.sh <pr#> --yes}"
[ "${2:-}" = "--yes" ] || { echo "refusing: pass --yes (owner-confirmed deploy)"; exit 2; }
slug=$(meta_get "$pr" slug)
plan="$REPO_ROOT/plans/$slug.md"   # landed on main with the merge
dcmd=$(fm_get deploy "$plan"); [ -n "$dcmd" ] || { echo "PR#$pr: no deploy — nothing to do"; exit 0; }
echo "PR#$pr deploying on main: $dcmd"
if ( cd "$REPO_ROOT" && bash -c "$dcmd" ); then
  boss_notify "boss:deployed PR#$pr ($slug)"
else
  boss_notify "boss:deploy-FAILED PR#$pr ($slug) — code stays merged, no rollback"
  echo "deploy failed — merged code left in place (per spec)"; exit 1
fi
