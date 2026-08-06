#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# The step registry gates everything below it: run.sh's verb list and step
# folders, lib/run-log.mjs's valid ledger keys and PIPELINE.md's table all
# derive from steps/*/step.json. A malformed declaration must fail here (E-REG)
# rather than at dispatch, and --check also fails a registry edit that never
# regenerated the doc. It costs milliseconds, so it runs before the npm work.
node scripts/gen-pipeline-table.mjs --check
# board-ui FIRST: board.test.mjs's cutover tests fetch `/`, which serves
# board-ui/dist — on a fresh checkout (dist is gitignored) the suite fails
# without this build, so it must precede `node --test` (found 2026-07-31).
( cd board-ui && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npx vitest run && npm run build )
# card-library's deps too: lib/frame-gate.mjs imports card-library's
# overflow-probe.mjs, which needs puppeteer-core. On a checkout where those
# deps are absent the suite fails with ERR_MODULE_NOT_FOUND on ONE file while
# everything else passes — it reads as a flaky test rather than a missing
# install, and cost three gate runs to pin down (2026-08-03).
( cd ../card-library && { [ -d node_modules/puppeteer-core ] || npm ci --no-audit --no-fund; } )
# Every test under lib/, FOUND rather than enumerated. The hand-typed list this
# replaces had drifted to 39 of 50 lib/ files: segments, plan-skeleton,
# cue-rules, side-mode, versions, motif, transcript-beats, post-status,
# regression-cards and both rulebook checkers were on disk, passing, and never
# run by the gate (found 2026-08-06). regression-cards is the one that stings —
# it asserts the intro:"cards" default path is untouched, which is exactly the
# guard you want running on every change.
# A new test file now joins the gate by existing. Do not reintroduce a list.
# -not -path .test-tmp: test working dirs are gitignored scratch, not sources.
find lib -name '*.test.mjs' -not -path '*/.test-tmp/*' -print0 | sort -z | xargs -0 node --test
node lib/check-rulebook.mjs
node lib/check-shot-rulebook.mjs
node lib/check-zone-rulebook.mjs
node lib/intro-film/check-taste-intro.mjs
bash scripts/test-run-sh.sh
node scripts/board-ui-smoke.mjs
echo "visuals-flow check OK"
