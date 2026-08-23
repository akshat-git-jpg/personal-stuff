---
name: pp-testing
description: Use when a policy needs to be run end-to-end through the Zluri policy platform — a policy_id or policy JSON to execute, an execution that failed or produced 0 violations, a step stuck at validator/scope_resolver/rule_evaluator/violation_sink, or a request to test the trigger to violation flow across dashboard-api, backend-libs and Integration-queue-consumer. Triggers - "pp testing", "test this policy", "run this policy end to end", "why did this policy produce no violations", "policy execution failed", "test the policy platform flow".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# PP testing — end-to-end policy platform runs

## Overview

The policy platform spans three repos: a policy document in Mongo `rules`, a
trigger in dashboard-api that calls `@zluri/backend-libs`, and a 7-step Kafka
pipeline in Integration-queue-consumer (IQC) that writes violations back to
Mongo. This skill runs a real policy through all of it and reports which step
broke.

**Core principle: never conclude from the policy document what a run will do.
Trigger it, follow it, and read the trace.** The trace carries the executed
SQL, the per-rule match counts, and the scope size — a 0-violation run is
explained there, never by reading `conditions`.

The harness lives in the IQC repo at
`Integration-queue-consumer/src/policy-platform/test/pp-*.ts`. It publishes
directly to the validator topic, so it does NOT need dashboard-api to be
running or deployed.

## The flow being tested

| # | Where | What happens |
|---|---|---|
| 1 | Mongo `rules` | the policy document (written by the UI) |
| 2 | `ConcreteTriggerResolver` (backend-libs) | writes `policyexecutionstore` + `requestexecutionstore`, publishes to the validator topic |
| 3 | IQC `validator` | checks every attribute in scope + rules resolves |
| 4 | IQC `scope_resolver` | materializes `zluri_schema.s_<hash>` — the entities in scope |
| 5 | IQC `rule_evaluator` | per-rule `CREATE TABLE zluri_schema.re_<hash>`, then INTERSECT into `f_<hash>` |
| 6 | IQC `violation_sink` | writes `policyoutputrecords` |
| 7 | IQC `execution_done` → `trace_archive` → `cleanup` | archives to S3, drops temp tables |

Results land in Mongo: `policyexecutionstore`, `requestexecutionstore`,
`policyexecutiontraces`, `policyoutputrecords`, `policyviolations`. Postgres
holds only the temp tables and the source data.

## Two modes

Pick with `--mode`. `pp-preflight.ts` reports which are available.

| | `--mode feature` | `--mode local` |
|---|---|---|
| Runs the 7 steps | the feature-env IQC pod | IQC on this machine |
| Servers you must start | none | IQC (+ dashboard-api if testing its endpoints) |
| Topic | `<branch-slug>-policy.step.validator` | `pptest-policy.step.validator` |
| Iteration on a fix | needs a redeploy | hot reload |
| Use it for | does the deployed code work | why does it break, add logs |

`feature` is the default choice. Switch to `local` only once a step has
failed and the trace does not explain why.

Branch slug = the branch name with a leading `feature/` stripped. This is set
in `centralized-deployment/.github/workflows/deploy-feature-env.yaml`.

## The loop

Work through these as todos, in order.

1. **Preflight.** `pp-preflight.ts` — dev Mongo, dev Postgres, dev Kafka, and
   the per-mode topic. A FAIL here is almost always the VPN. Fix it before
   anything else; do not start diagnosing the policy.
2. **Confirm consumers exist for the mode.** A topic with no consumer group is
   the #1 cause of a run that times out with no execution doc. For `feature`,
   list groups matching the branch slug — the async chain needs
   `-policy-validator-group`, `-policy-scope-resolver-group`,
   `-policy-rule-evaluator-group`, `-policy-violation-sink-group`,
   `-policy-execution-done-group`, `-policy-trace-archive-group`,
   `-policy-cleanup-group`.
3. **Trigger.** `pp-trigger.ts --policy <id> --mode feature`. Record the
   `execution_id` and `request_id` from the `PP_TRIGGER_RESULT` line.
4. **Follow.** `pp-follow.ts <execution_id>`. Exit 0 = completed, 1 = failed or
   timed out. Budget 3–5 minutes: the validator alone regularly takes 30–40s.
5. **Verify.** `pp-verify.ts <execution_id>` — per-step results, rule-engine
   match counts, output record count, and whether cleanup dropped the temp
   tables. This is where a run is judged, not step 4.
6. **Localize, if it failed.** Read the failing step's trace entry before
   forming a theory. See Reading a failure below.
7. **Clean up.** `pp-cleanup.ts` (dry run) then `--yes`. Only needed if the run
   inserted a policy from JSON, or left temp tables behind.

## Quick reference

Run everything from `/Users/kbtg/codebase/Integration-queue-consumer`.
Prefix each with `KAFKAJS_NO_PARTITIONER_WARNING=1` to silence a noisy warning.

```bash
R="npx ts-node -r dotenv/config src/policy-platform/test"

# what can run right now (add --create-topics before a first local run)
$R/pp-preflight.ts

# trigger an existing policy against the feature env
$R/pp-trigger.ts --policy <policy_id> --mode feature

# trigger a policy JSON that is not in Mongo yet
$R/pp-trigger.ts --file /path/policy.json --org <org_id> --mode feature

# watch it, then judge it
$R/pp-follow.ts <execution_id> --timeout 300
$R/pp-verify.ts <execution_id>

# remove only what this harness created
$R/pp-cleanup.ts            # dry run
$R/pp-cleanup.ts --yes
```

`pp-trigger.ts` flags: `--policy` | `--file`, `--org`, `--mode local|feature`,
`--exec-mode async|sync`, `--purpose violation_detection|simulate`,
`--branch <name>`.

Each script prints one machine-readable line — `PP_PREFLIGHT_RESULT`,
`PP_TRIGGER_RESULT`, `PP_FOLLOW_RESULT`, `PP_VERIFY_RESULT`,
`PP_CLEANUP_RESULT` — followed by single-line JSON. Parse those, not the prose.

## Testing a backend-libs fix

A local IQC still resolves `@zluri/backend-libs` from CodeArtifact, so a fresh
commit in the backend-libs repo is NOT in the code path until it is linked.
Check the installed version before drawing any conclusion — `package.json` can
pin a version that `node_modules` does not actually have.

```bash
cd /Users/kbtg/codebase/Integration-queue-consumer
python3 -c "import json;print(json.load(open('node_modules/@zluri/backend-libs/package.json'))['version'])"
```

Link the local build with the repo's own script, which builds and pushes to
every already-linked consumer:

```bash
cd /Users/kbtg/codebase/backend-libs && npm run yalc:bump
```

It publishes from `dist/`, which matters: the repo root ships `src/` only, so a
root-level yalc publish makes IQC's deep imports
(`@zluri/backend-libs/libs/...`) fail to resolve.

Then confirm the fix is in the COMPILED output, not just the source — grep the
built file for the change. A passing unit test in backend-libs proves the
source; only the grep proves what IQC will load.

**Linking rewrites the consumer's `package.json`** to
`"@zluri/backend-libs": "file:.yalc/@zluri/backend-libs"`. That must never be
committed. Restore the published pin before any commit —
`git checkout package.json` — and note that `yalc remove --all` restores a
possibly-stale pin from `yalc.lock` instead of the one on git HEAD.

## Running local mode

Two servers. Both need the VPN up.

**First run only:** dev Kafka does not auto-create the `pptest-` topics, and a
consumer subscribed to a topic that does not exist starts cleanly but never
receives an assignment. Create the 14 it needs:

```bash
npx ts-node -r dotenv/config src/policy-platform/test/pp-preflight.ts --create-topics
```

Idempotent, and it only ever creates the local prefix — feature-env topics
belong to the deployment.

```bash
# terminal 1 — IQC, policy consumers only, isolated topic prefix
cd /Users/kbtg/codebase/Integration-queue-consumer
ENABLED_CONSUMERS=policy-validator,policy-scope-resolver,policy-rule-evaluator,policy-violation-sink,policy-execution-done,policy-violation-release,policy-request-completed,policy-trace-archive,policy-cleanup,policy-violation-consumer \
POLICY_TOPIC_PREFIX=pptest- \
POLICY_VIOLATIONS_TOPIC=pptest-policy.event.violations npm run dev

# terminal 2 — dashboard-api, only if testing its HTTP trigger or read APIs
cd /Users/kbtg/codebase/dashboard-api/postgres
POLICY_ASYNC_TOPIC=pptest-policy.step.validator npm run dev
```

The `pptest-` prefix is what keeps a local IQC and the feature-env IQC from
consuming each other's messages off the shared dev Kafka cluster. Never run
local IQC on the feature slug prefix.

`POLICY_VIOLATIONS_TOPIC` is NOT optional and NOT covered by the prefix.
`policy-violation-consumer` resolves its topic as
`process.env.POLICY_VIOLATIONS_TOPIC ?? "policy.event.violations"` and never
consults `POLICY_TOPIC_PREFIX`, so omitting it points a local consumer at the
shared dev topic and it starts eating real dev traffic. `policy-violation-consumer`
is also absent from the older command line — without it the pipeline completes
and publishes, and `policyviolations` stays empty forever.

Local runs are for correctness only. Every query crosses the VPN, so
wall-clock inflates several times over in-cluster timings — never quote a
local duration as a performance number.

## Reading a failure

Match the failing step to what to read. Read it before theorising.

| Step | Read this | Common cause |
|---|---|---|
| never appeared | `PP_FOLLOW_RESULT.reason` | trigger topic has no consumer — wrong mode or prefix |
| `validator` failed | `missing_scope_attributes`, `missing_rule_attributes` in the trace | an attribute id in the policy is not registered in `automationruleattributes`, or is registered for the other namespace (`sod_scope` vs `sod_rule`) |
| `scope_resolver` empty | `scope_result.total_count`, `entities_from_scope` | scope predicate matches nothing for that org |
| `rule_evaluator` failed | `error_message` — it carries the FULL executed SQL | type mismatch on the scope join, missing seed table, bad cast |
| `rule_evaluator` matched 0 | `rule_engine.rules[].records_matched`, `final_intersection_size` | a join column is NULL for every row, so the INTERSECT is empty |
| `violation_sink` ran, 0 records | `output_record_count` vs `final_intersection_size` | violation keying / NHI gating dropped the rows |

When `error_message` holds SQL, replay it against dev Postgres and correct it
by hand until it returns the right rows. Only then map the correction back to
code. Do not reason about what the query builder "would" emit.

For a fix that needs instrumentation inside `@zluri/backend-libs`, hand over to
the `debug-from-backendlib` skill — it owns the yalc link, the boundary
logging, and the commit-cleanliness gate.

## Environment facts (verified 2026-08-20)

- **IQC does not boot on Node 22+.** `buffer-equal-constant-time` (via
  `jsonwebtoken` → `jws` → `jwa`) reads `require('buffer').SlowBuffer.prototype`,
  and `SlowBuffer` was removed. The crash is
  `TypeError: Cannot read properties of undefined (reading 'prototype')` at
  `buffer-equal-constant-time/index.js:37`. Node 18 is the supported runtime; if
  the machine has no Node 18, patch line 4 of that file locally to
  `require('buffer').SlowBuffer || require('buffer').Buffer`. It lives in
  node_modules, so it is untracked and `npm ci` reverts it. The pp-* scripts
  themselves run fine on new Node — only `server.ts` pulls jsonwebtoken in.
- **The dev connection string carries `readPreference=secondary`.** Reading a
  secondary right after the pipeline wrote is a lost race: `pp-verify.ts`
  reported `not_found` for an execution that had completed. `connectMongo()`
  now rewrites the preference to `primary`. Never verify against a secondary —
  a healthy run reads as one that never started.
- **The temp-table archiver needs real AWS credentials.** Locally it fails every
  table with `Missing credentials in config, if using AWS_CONFIG_FILE, set
  AWS_SDK_LOAD_CONFIG=1`, and because the archive is what precedes the drop, the
  scope/rule/final tables all leak. In-cluster IRSA covers this. After a local
  run, expect `temp_table_leaked: true` and drop the tables yourself — this is
  the mechanism behind the ~38k orphaned `zluri_schema` tables on dev.
- **`policy-request-completed` does not register** from `ENABLED_CONSUMERS`; 8 of
  the 9 names start. The run still reaches `completed` — that consumer only
  finalizes the request doc, so `request_outcome` stays null on a local run.
- **The violation sink topic is a THIRD env var: `POLICY_VIOLATIONS_TOPIC`.**
  `ConcreteTriggerResolver` fills `sink_configs.kafka_topic` from it, defaulting
  to a bare `policy.event.violations`. As of centralized-deployment PR #41 each
  feature env sets it to `<branch_slug>-policy.event.violations` on both
  dashboard-api and IQC, so `pp-trigger.ts` sets it per mode too. A trigger that
  leaves it unset publishes to the bare topic that the env no longer consumes,
  and `policyviolations` stays empty while every pipeline step reports success.
  `PP_TRIGGER_RESULT.violations_topic` shows which topic was used.
- **`policyviolations` is written by `policy-violation-consumer`, not by the
  pipeline.** It consumes the sink topic, so it is a separate hop after
  `violation_sink` completes. A run can be fully `completed` with
  `output_record_count: 1` and still have zero `policyviolations` rows. Judge
  the pipeline on `policyoutputrecords`; judge the violation write separately.
- **An App Governance run can complete green and still write no violation.**
  All 4 steps pass, `policyoutputrecords` is 1, the event is published AND
  consumed, and `policyviolations` stays empty with nothing in any DLQ. The AG
  handler reads `ruleexecutions` on `{ org_id, policy_run_request_id }` and
  throws when it is absent; the AG natural key is that document's `_id`, so
  there is no fallback. dashboard-api writes it BEFORE triggering and passes its
  own request id in. `pp-trigger.ts` now does the same. Judge an AG run by
  `violations_by_policy_id` — `violations_by_execution_id` is 0 by design,
  because the stored `execution_id` is the `ruleexecutions` `_id`, not the
  pipeline uuid. SoD keys on the pipeline uuid and is unaffected.
- **`POLICY_VIOLATIONS_TOPIC` is read at REQUIRE time**, into a module-level
  const at `concrete-trigger-resolver.js:17`. Setting `process.env` after the
  import never takes effect, and the run silently publishes to the bare
  `policy.event.violations` that a feature env no longer listens on. Pass
  `kafka_topic` explicitly in `sink_configs` instead, and confirm it by reading
  `policyexecutionstore.sink_configs`. The validator topic has no such trap.
- **A rollout can leave a wedged consumer holding a partition.** After a
  redeploy, a step group showed `Stable/members=3` on a 2-partition topic with
  one partition stuck at lag 1 and zero movement for ~10 minutes; no Postgres
  query was running and nothing was in the DLQ. It cleared itself once the old
  replica terminated. Before debugging the policy, check
  `describeGroups` member count against the partition count, and re-trigger —
  a fresh `execution_id` keys to a different partition and usually just runs.
- **The trigger reads `POLICY_ASYNC_TOPIC` / `POLICY_SYNC_TOPIC`, NOT
  `POLICY_TOPIC_PREFIX`.** `ConcreteTriggerResolver` defaults to an unprefixed
  `policy.step.validator`. `POLICY_TOPIC_PREFIX` is read only by IQC's
  `core/kafka-topics.ts`, for the consumer side. Setting only the prefix on the
  publisher sends the message to a topic nobody is listening on.
- **backend-libs bundles its own `mongodb` driver** under
  `node_modules/@zluri/backend-libs/node_modules/mongodb`. Over the VPN its
  pool-growth TLS handshake exceeds the driver defaults, which shows up as
  `MongoNetworkTimeoutError` or `ReplicaSetNoPrimary` on the first WRITE while
  reads keep working. `pp-lib.ts connectMongo()` sets
  `connectTimeoutMS: 60000`, `socketTimeoutMS: 120000` and `minPoolSize: 3` to
  pre-open the pool. Do not lower these.
- **IQC's Kafka producer path ignores the configured timeouts.**
  `registerProducer` calls `new Kafka(config)` without `connectionTimeout`, so
  it inherits kafkajs's 1s default and aborts on a ~2s VPN handshake. The
  pp-* scripts build their own producer instead of calling
  `initializeKafkaProducers`. Consumers are unaffected — they go through
  `kafkaInstances`, which does set timeouts.
- **Broker env vars are misspelled in the repo**: `KAKFA`, not `KAFKA`
  (`INTEGRATION_QUEUES_KAKFA_CONNECTION_URL_1/2`). The auth vars are spelled
  correctly. Copy from `src/kafka-core/config/kafka.config.ts`.
- **`policyviolations.execution_id` is an ObjectId** in the Mongoose schema,
  while the platform's `execution_id` is a uuid string. A direct match can
  legitimately return 0. `pp-verify.ts` counts by execution_id and by
  policy_id and reports both.
- **Cleanup failures are silent** — `Promise.allSettled` per table, no DLQ, and
  the stale-table sweep cron does not exist. A leftover temp table is only
  visible via the Postgres check in `pp-verify.ts`.
- **`statement_timeout = 0` on dev Aurora**: a runaway rule-eval query never
  auto-dies and blocks retries through deterministic temp-table-name locks.
  Terminate it with `pg_terminate_backend` before re-running the same policy.
- Timings on the feature env for a 5-entity scope: validator ~36s,
  scope_resolver ~4s, rule_evaluator ~1s. A 300s follow timeout is generous;
  a 60s one is not.

## Red flags — STOP, you are guessing

- Explaining a 0-violation run from the policy document instead of
  `rule_engine.rules[].records_matched`.
- Proposing a root cause before reading the failing step's trace entry.
- Reporting "the pipeline completed" from `pp-follow.ts` without running
  `pp-verify.ts`. Completed means the steps ran, not that the output is right.
- Running local IQC with the feature-env topic prefix — it silently steals the
  feature env's messages.
- Quoting a local-run duration as a performance measurement.
- Widening `pp-cleanup.ts`'s filter beyond the `pp_testing_inserted` marker.
  Policies created in the UI carry no marker and must never be deleted.
- Waiting out a 300s timeout when preflight already showed the mode's topic has
  no consumer group.
- Reporting an App Governance run as violation-free from `violations_by_execution_id`.
  That count is 0 for every AG run. Read `violations_by_policy_id`.
- Concluding the platform is broken when a green run wrote no violation. Check
  that a `ruleexecutions` doc exists for the run's `request_id` first.

| Excuse | Reality |
|---|---|
| "The policy looks correct, so the engine is wrong" | The trace names the step and carries the SQL. Read it. |
| "It timed out, so the pipeline is broken" | A timeout with no execution doc means nobody consumed the topic. Check the mode and prefix first. |
| "I'll test the feature env after redeploying dashboard-api" | The harness publishes to Kafka directly. dashboard-api being down blocks the UI, not the test. |
| "0 violations means the policy matched nothing" | It can also mean a join column was NULL for every row. `records_matched` distinguishes them. |
| "The event was consumed, so the violation was written" | Consumed only means the offset moved. The AG handler can throw after consuming and, with no DLQ topic, leave no trace at all. |
| "Same error, so it is the same bug" | `ReplicaSetNoPrimary` and `MongoNetworkTimeoutError` here were both VPN pool timeouts, not Atlas problems. Check the layer before the symptom. |
