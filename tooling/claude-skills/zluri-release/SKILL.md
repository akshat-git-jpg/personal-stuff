---
name: zluri-release
description: Fetch release PR status across all 21 ZluriHQ service repos for branch release/<date>, classify each as "In progress" / "Not required" (empty diff) / "To Do" (no PR), print the two markdown lists, and update the Release order database on the Notion release-deployment-checklist page (a fresh Notion URL is required input each run). Triggers on "zluri release", "/zluri-release", "release PR status", "update release notion", "check release PRs", or a notion.so URL titled "Release Deployment Checklist".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# zluri-release

Read GitHub release PR status for the 21 Zluri backend services and mirror it into the day's Notion Release Deployment Checklist.

## Required inputs

1. **Notion page URL** — REQUIRED, the user passes a fresh one every release. It looks like `https://www.notion.so/zluri/Release-Deployment-Checklist-<DD-MMM-YYYY>-<hash>`. Never guess or search — if the user didn't paste a URL, ask for it explicitly before doing anything.
2. **Release date** — optional, defaults to today as `YYYY-MM-DD` (use the runtime's current date in IST/UTC, whichever the user has been using; default to today's date as it appears in the harness `currentDate`).

## Preflight

1. Confirm `gh auth status` shows the active account is `kushal-zluri`. If not, abort and tell the user to switch.
2. Confirm `jq` is installed (`command -v jq`). If missing, abort.

## Step 1 — Fetch GitHub PR status for all 21 services

For each service repo, look up the PR with head branch `release/<DATE>` in the `ZluriHQ` org. Run in parallel via `xargs -P 10`.

### Service list (with repo-name overrides baked in)

The image-listed service name may differ from the actual repo. Use these exact repo names:

| Order | Image label (Service Name in Notion) | Actual repo under ZluriHQ |
|---:|---|---|
| 1 | backend-triggers-v2 | `backend-triggers-v2` |
| 2 | backend-libs | `backend-libs` |
| 3 | zluri-triggers-consumer | `zluri_triggers_consumer` |
| 4 | dashboard-api | `dashboard-api` |
| 5 | workflow-service | `workflow-service` |
| 6 | integrations-v1 | `integrations-v1` |
| 7 | rules-engine | `rules-engine` |
| 8 | zluri-n8n | `zluri-n8n` |
| 9 | integration-queue-consumer | `Integration-queue-consumer` |
| 10 | backend-scripts | `backend-scripts` |
| 11 | bull-scheduler | `bull-scheduler` |
| 12 | agenda | `agenda-project` |
| 13 | v1-dashboard | `v1-dashboard` |
| 14 | integration-webhook-processor | `integration-webhook-processor` |
| 15 | kafka-microservice | `kafka-microservice` |
| 16 | superset | `superset-poc` |
| 17 | Zluri Webhook listener | `zluri-webhook-listener` |
| 18 | prefect-poc | `prefect-poc` |
| 19 | bg-jobs-v1 | `bg-jobs-v1` |
| 20 | integration-argo-scripts | `integration-argo-scripts` |
| 21 | de-etl-pipeline | `de-etl-pipeline` |

**Order is load-bearing** — the Notion `Release order` rows are titled by order number 1–21. Use order to map service ↔ Notion page.

### Fetch script

Drop the script into `$CLAUDE_JOB_DIR` (or `/tmp` if not set) and run it. Don't keep it under the skill folder.

```bash
RELEASE=YYYY-MM-DD   # e.g. 2026-05-27

cat > /tmp/zluri-release-fetch.sh <<'BASH'
#!/usr/bin/env bash
set -u
RELEASE_BRANCH="release/${RELEASE}"
SERVICE="$1"
RESULT=$(gh pr list -R "ZluriHQ/${SERVICE}" --head "${RELEASE_BRANCH}" --state all \
  --json number,title,state,url,changedFiles 2>&1)
EXIT=$?
if [ $EXIT -ne 0 ]; then
  printf "%s\trepo-error\t-\t-\t%s\n" "$SERVICE" "$(echo "$RESULT" | head -1 | tr '\t\n' '  ')"
  exit 0
fi
COUNT=$(echo "$RESULT" | jq 'length')
if [ "$COUNT" = "0" ]; then
  printf "%s\tno-pr\t-\t-\t-\n" "$SERVICE"; exit 0
fi
echo "$RESULT" | jq -r --arg svc "$SERVICE" '
  .[0] as $pr |
  [ $svc,
    (if $pr.changedFiles == 0 then "empty-diff" else "with-changes" end),
    $pr.url,
    ($pr.changedFiles | tostring),
    $pr.state
  ] | @tsv'
BASH
chmod +x /tmp/zluri-release-fetch.sh
export RELEASE

# Service list in ORDER 1..21 (use actual repo names from the table above)
SERVICES=(
  backend-triggers-v2 backend-libs zluri_triggers_consumer dashboard-api
  workflow-service integrations-v1 rules-engine zluri-n8n
  Integration-queue-consumer backend-scripts bull-scheduler agenda-project
  v1-dashboard integration-webhook-processor kafka-microservice superset-poc
  zluri-webhook-listener prefect-poc bg-jobs-v1 integration-argo-scripts
  de-etl-pipeline
)
printf "%s\n" "${SERVICES[@]}" | xargs -P 10 -I {} /tmp/zluri-release-fetch.sh {}
```

Output is TSV: `repo \t status \t pr_url \t changed_files \t pr_state` where `status` is one of `with-changes` / `empty-diff` / `no-pr` / `repo-error`.

## Step 2 — Classify

| GH status | Notion `Statuss` value |
|---|---|
| `with-changes` (changedFiles > 0) | `In progress` |
| `empty-diff` (PR exists, changedFiles == 0) | `Not required` |
| `no-pr` (no PR with this head) | `To Do` |
| `repo-error` | **Halt and ask user** — repo name probably wrong |

## Step 3 — Print 2 markdown lists

Use this exact shape (sorted by file count desc within bucket 1):

```markdown
### 📦 PRs with changes (N)
| Service | PR | Files |
|---|---|---:|
| <repo> | [#<num>](<url>) | <count> |
...

### ⚪ No changes (M)
**Empty-diff PRs:**
- <repo> — [PR #<num>](<url>)
...
**No release PR found:**
- <repo>
...
```

## Step 4 — Resolve Notion page IDs

The Notion page contains an inline database called "Release order" with 21 rows, each titled by its order number (1–21). To update them:

1. **Fetch the user-supplied Notion page URL** using `notion-fetch`. Find the `<database url="...">` tag inside — that's the database URL.
2. **Fetch the database URL** with `notion-fetch`. Inside, find `<data-source url="collection://<ID>">` — that's the data source URL needed for search.
3. **Find each row's page ID** by searching the data source with the order number AS THE QUERY:

   ```
   notion-search(query="1", data_source_url="collection://<ID>", page_size=5)
   ```

   The first result is the row whose title is "1". Repeat for orders 1..21 in parallel. The 21 page IDs are the result. Cache this mapping in `/tmp` if running multiple times against the same release page.

   **Why search by order number, not service name:** Notion's search is fuzzy; "dashboard" matches both `dashboard-api` (order 4) and `v1-dashboard` (order 13). Order is unique, so searching for the digit returns the exact row first.

## Step 5 — Update Notion rows

For each row, call `notion-update-page` with:

```json
{
  "page_id": "<row_page_id>",
  "command": "update_properties",
  "properties": {
    "Statuss": "<In progress|Not required|To Do>",
    "PR": "<github pr url>"
  }
}
```

Rules:
- Always set `Statuss`.
- Set `PR` ONLY for rows where a PR exists (`with-changes` or `empty-diff`). For `no-pr` rows, omit the `PR` key entirely (don't overwrite a manual entry with empty).
- Property name is `Statuss` (double-s, sic). Allowed values: `To Do`, `To be Released`, `Release Env Created`, `In progress`, `Not required`, `Released`.
- The `PR` field is type `text`; a plain URL works — Notion will auto-format it as a markdown link.
- Run all 21 updates in parallel.

Do not touch any other field (`Owners`, `Backmerged`, `Backmerge PR`, `Comments`, `Order`, `Service Name`, `Release Cut`, `Dependency`).

## Step 6 — Verify and summarise

1. Fetch ONE row that you just set to `In progress` and confirm `Statuss` reads back correctly.
2. Print a final summary:
   - Counts per bucket (`X In progress / Y Not required / Z To Do`, must sum to 21).
   - Notion page link.
   - List of services in each bucket.

End with `result:` on its own line summarising what was pushed.

## Re-running

The skill is idempotent. Re-running with the same Notion URL and date overwrites `Statuss` + `PR` with fresh values. Use this to refresh the doc as PRs get opened/merged during the release window.

## What this skill DOES NOT do

- Does not infer success/failure from GitHub Actions checks. The classification is purely based on `changedFiles`.
- Does not auto-discover the Notion page — always uses the URL the user pasted.
- Does not auto-discover services. If a new service joins releases, edit the service table at the top of this skill.
- Does not write to Slack, comment on PRs, merge anything, or modify Backmerge fields.
- Does not change any Notion field other than `Statuss` and `PR`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `gh` returns "Could not resolve to a Repository" for service X | Repo name override is stale or new repo joined | `gh search repos --owner ZluriHQ "<keyword>"`, update the service table |
| All Notion updates succeed but UI shows old status | Stale browser tab | User must refresh the page; the API write happened |
| Order-search returns wrong page | The Release order DB on this release page was reordered | Fall back to searching by service-name match against the Service Name property, and ask the user to confirm |
| `notion-fetch` on the Notion URL returns 404 | URL has expired share token or user pasted wrong link | Ask the user to repaste from their browser |
