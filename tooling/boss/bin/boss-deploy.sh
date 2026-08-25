#!/bin/bash
# boss-deploy.sh <pr#> --yes — run the plan's deploy cmd on the main checkout.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
trap boss_gh_restore EXIT
boss_assert_gh || exit 1
pr="${1:?usage: boss-deploy.sh <pr#> --yes}"
[ "${2:-}" = "--yes" ] || { echo "refusing: pass --yes (owner-confirmed deploy)"; exit 2; }
slug=$(meta_get "$pr" slug)
plan="$REPO_ROOT/plans/$slug.md"   # landed on main with the merge
dcmd=$(fm_get deploy "$plan"); [ -n "$dcmd" ] || { echo "PR#$pr: no deploy — nothing to do"; exit 0; }
echo "PR#$pr deploying on main: $dcmd"
# Every Worker deploy in this repo shells out to wrangler, which refuses Node < 22 while
# the machine default is deliberately Node 20 (the owner's work repos need 20). Raise it
# here rather than in each plan's deploy: — a plan author cannot be expected to know.
# PR#211 lost a deploy cycle to exactly this. See scripts/node22-path.sh.
if ( cd "$REPO_ROOT" && . scripts/node22-path.sh && bash -c "$dcmd" ); then
  boss_notify "boss:deployed PR#$pr ($slug)"
else
  boss_notify "boss:deploy-FAILED PR#$pr ($slug) — code stays merged, no rollback"
  echo "deploy failed — merged code left in place (per spec)"; exit 1
fi
