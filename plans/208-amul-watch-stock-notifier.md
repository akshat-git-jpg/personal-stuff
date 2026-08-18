---
executor: agy
model:
test_cmd: bash apps/amul-watch/test-amul-watch.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [apps/amul-watch/amul_api.py, apps/amul-watch/watch.py, apps/amul-watch/test-amul-watch.sh, apps/amul-watch/config.example.json, apps/amul-watch/run.sh, apps/amul-watch/README.md, apps/amul-watch/CLAUDE.md, apps/amul-watch/.gitignore, apps/local-apps.md]

mutation_apply: sed -i.bak 's/if now and not was:/if now:/' apps/amul-watch/watch.py && rm -f apps/amul-watch/watch.py.bak
mutation_command: bash apps/amul-watch/test-amul-watch.sh
mutation_expect: FAIL: repeat poll must not re-notify
mutation_cwd:
mutation_timeout:
---

# Plan 208: amul-watch — self-hosted Amul stock notifier

## Summary

- **Problem statement**: Amul protein products (whey, high-protein milk, paneer) sell out
  within minutes on `shop.amul.com`. The public third-party bot
  (`github.com/SwapnilSoni1999/amul-notify`) works but is multi-tenant, stores the owner's
  pincode on someone else's server, and gates auto-ordering behind a paid closed-source
  proxy. The owner wants his own watcher on his own VPS.
- **Goals**:
  - A Python job, `apps/amul-watch/`, that polls Amul's storefront API for one pincode and
    a configured SKU list.
  - Telegram alert via the existing `tooling/cli/notify` CLI on the **edge** where a tracked
    SKU flips out-of-stock → in-stock (never a repeat ping while it stays in stock).
  - A stubbed test suite that can fail on this plan's own deliverable.
  - A `run.sh` wrapper ready for a Pattern-B VPS cron (wiring the cron itself is out of scope).
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every request recipe and the diff
  algorithm are inlined verbatim below and were verified live against the real API.
- **Done criteria** (terse — full list below): `test-amul-watch.sh` exits 0; a live
  `watch.py --once --dry-run` prints a stock table for pincode 400001; first run emits zero
  notifications.
- **Stop conditions** (terse — full list below): any Amul endpoint returns 403/429; a gate
  assertion is weakened rather than the code fixed; the executor is tempted to add ordering,
  login, or credential storage.
- **Test / verification for success**: `apps/amul-watch/test-amul-watch.sh` — a bash suite
  that stubs `curl` and `notify` and asserts the TID format, the bracket-literal query, the
  edge-trigger diff, and the first-run silence rule. Plus one live read-only smoke run.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17d3d58c..HEAD -- apps/amul-watch apps/local-apps.md tooling/cli/notify`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `17d3d58c`, 2026-08-18

## Why this matters

Stock windows are minutes long, so a five-minute poll with an instant phone ping is the
whole product. Everything else in the reference bot (MongoDB, Redis, Bull queues, Telegraf,
a multi-tenant session pool) exists because it serves thousands of users. This serves one.
Dropping that machinery is not a shortcut — it is the correct design for a single-tenant
job, and it is why this fits in two Python files plus a cron.

The **edge-trigger** rule is the part that decides whether the tool is usable or gets muted
within a day. A level-trigger ("alert while available") fires every five minutes for hours
after a restock. That is why the diff logic carries a mutation gate: a watcher that spams is
functionally broken even though every request succeeded.

Auto-ordering is deliberately **not** in this plan. It needs stored credentials and a
reverse-engineered checkout, which is plan 209. This plan must ship and be useful alone.

## Current state

### The repo pieces this builds on

| Path | Role |
|---|---|
| `tooling/cli/notify/notify` | Telegram-first phone ping. `notify send "<msg>"` → exit 0 sent, 3 undeliverable, 2 usage error. Never crashes the caller. Creds in `infra/secrets/telegram.env` (gitignored). |
| `apps/telegram-my-planner/tools/daily-digest/` | **The exemplar to imitate.** Python job driven by a VPS cron: flat module layout, `config.py`, `requirements.txt`, `deploy.sh`, no framework. Read `notifier.py` for the house style before writing code. |
| `VPS-CRONS.md` | Pattern B — project code lives in `personal-stuff` (VPS clone at `/srv/projects/personal-stuff/`), cron orchestration in the `vps-crons` repo. Wrappers `git pull` on every run. |
| `apps/local-apps.md` | Index of apps; add a one-liner row for `amul-watch`. |

`apps/amul-watch/` does not exist yet. Create it.

### The Amul API — verified live on 2026-08-18

This is not from documentation. Every step below was executed against the live
`shop.amul.com` during planning and returned the stated result for pincode `400001`.
The storefront is **StoreHippo**; the product endpoint is a generic entity query.

Constants:

```
SHOP     = "https://shop.amul.com"
STORE_ID = "62fa94df8c13af2e242eba16"     # Amul's StoreHippo store id, used in the TID hash
```

Every request carries these headers. `frontend: 1` and the `base_url` / `referer` pair are
load-bearing — the API returns a different (empty) payload without them.

```python
BASE_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "base_url": "https://shop.amul.com/en/browse/protein",
    "frontend": "1",
    "referer": "https://shop.amul.com/en/browse/protein",
    "user-agent": ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"),
}
```

The six-step bootstrap, in order. Steps 1–5 run once per process; step 6 is the poll.

| # | Request | Purpose | Verified result |
|---|---|---|---|
| 1 | `GET /en/browse/protein` | Seeds `jsessionid`, `__cf_bm`, `_cfuvid` cookies | 200, 4376 bytes |
| 2 | `GET /user/info.js?_v=<epoch_ms>` | Session id. Body is `session = {…json…}` — strip the `session = ` prefix, then parse. Field `tid`. | 200, `tid: h7unrowcevb` |
| 3 | `GET /entity/pincode?limit=50&filters[0][field]=pincode&filters[0][value]=<PIN>&filters[0][operator]=regex&cf_cache=1h` + `tid` header | Pincode → substore | 200, `records[0].substore == "mumbai-br"` |
| 4 | `PUT /entity/ms.settings/_/setPreferences` + `tid` header, body `{"data":{"store":"<substore>"}}` | Binds the session to that substore's inventory | 200, `Updated successfully` |
| 5 | `GET /ms/store/amul/auto/EN/storeinfo.js` | Store version, regex `req\.query\.v\s*=\s*['"]?([^'";\s]+)` | 200, version `6` |
| 6 | `GET /api/1/entity/ms.products?<query>` + `tid` header | The stock read | 200, 23 protein SKUs |

**The TID header.** Recomputed per request; a stale one is rejected. Exact algorithm —
write it verbatim:

```python
def tid_header(session_tid: str) -> str:
    """Amul's anti-scrape header: ts:rand:sha256(store:ts:rand:session)."""
    ts = str(int(time.time() * 1000))
    rnd = str(int(1000 * random.random()))
    digest = hashlib.sha256(f"{STORE_ID}:{ts}:{rnd}:{session_tid}".encode()).hexdigest()
    return f"{ts}:{rnd}:{digest}"
```

**The bracket rule — do not skip this.** StoreHippo serves *different, wrong* inventory when
the nested query brackets are percent-encoded. After `urlencode`, `%5B` and `%5D` must be
turned back into literal `[` and `]`, and `curl` must be invoked with `--globoff` so it does
not interpret them. Verbatim:

```python
query = urlencode(params).replace("%5B", "[").replace("%5D", "]")
```

**The product query params**, in this order:

```python
params = [
    ("fields[name]", "1"), ("fields[sku]", "1"), ("fields[alias]", "1"),
    ("fields[price]", "1"), ("fields[available]", "1"),
    ("fields[inventory_quantity]", "1"), ("fields[categories]", "1"),
    ("filters[0][field]", "categories"),
    ("filters[0][value][0]", "protein"),
    ("filters[0][operator]", "in"),
    ("filters[0][original]", "1"),
    ("limit", "100"), ("total", "1"), ("start", "0"),
    ("v", store_version), ("device_type", "other"),
]
```

**Sample response rows** (real, from the verification run):

```
avail=1 qty=569  DBDCP41_30  Amul High Protein Blueberry Shake, 200 mL | Pack of 30
avail=1 qty=117  HPMCP01_08  Amul High Protein Milk, 250 mL | Pack of 8
avail=0 qty=0    HPPCP01_02  Amul High Protein Paneer, 400 g | Pack of 2
avail=0 qty=5    DBDCP45_02  Amul Kool Protein Milkshake | Vanilla, 180 mL | Pack of 8
```

Note the last row: `available == 0` while `inventory_quantity == 5`. Amul's own flag is the
authority; quantity alone is not. **Availability is defined as `available == 1 and
inventory_quantity > 0`** and nothing else. Do not invent a looser rule.

### Transport: curl subprocess, not `requests`

Use a `curl` subprocess with a cookie jar file, not Python `requests`. This mirrors the
reference implementation (`src/libs/curl.lib.ts` shells out to `curl` for the same reason)
and is what was verified live. It also keeps the dependency list empty — stdlib only.

Required curl flags: `-s -S -L --globoff --compressed --connect-timeout 10 --max-time 30
-c <jar> -b <jar>`. `--globoff` is mandatory (bracket rule above).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the gate | `bash apps/amul-watch/test-amul-watch.sh` | exit 0, prints `ALL TESTS PASSED` |
| Live read-only smoke | `python3 apps/amul-watch/watch.py --once --dry-run --pincode 400001` | exit 0, prints a table of SKUs with `avail`/`qty`, sends nothing |
| Syntax check | `python3 -m py_compile apps/amul-watch/watch.py apps/amul-watch/amul_api.py` | exit 0, no output |
| Confirm notify exists | `tooling/cli/notify/notify` | exit 2 (usage error) — proves the CLI is present |

## Scope

**In scope**:
- `apps/amul-watch/amul_api.py` — session bootstrap + product fetch
- `apps/amul-watch/watch.py` — CLI entrypoint, state diff, notification
- `apps/amul-watch/config.example.json` — committed template
- `apps/amul-watch/test-amul-watch.sh` — the merge gate
- `apps/amul-watch/run.sh` — VPS cron wrapper
- `apps/amul-watch/README.md`, `apps/amul-watch/CLAUDE.md`, `apps/amul-watch/.gitignore`
- One row appended to `apps/local-apps.md`

**Out of scope** (looks related — do not touch):
- **Any login, OTP, cart, address, payment, or order code.** That is plan 209. If you find
  yourself writing a function with `order`, `cart`, `otp`, or `password` in its name, STOP.
- `tooling/cli/notify/*` — call it, never edit it.
- `VPS-CRONS.md` and the `vps-crons` repo — cron wiring is a separate SSH step the owner
  performs; this plan only ships `run.sh`.
- `INFRA.md`, `my-hosted-sites.md` — nothing here is a public URL.
- Any interactive Telegram bot process. Config is a JSON file, alerts are one-way.

## Git workflow

- Branch: `advisor/208-amul-watch-stock-notifier`
- Commit: `feat(amul-watch): self-hosted Amul stock notifier with Telegram alerts` — no AI
  footers. Do NOT push.

## Steps

### Step 1: Scaffold the folder and config

Create `apps/amul-watch/`.

`apps/amul-watch/.gitignore`:

```
config.json
state.json
cookies.txt
__pycache__/
*.pyc
```

`apps/amul-watch/config.example.json` — the committed template. The owner copies it to
`config.json` (gitignored) and edits it:

```json
{
  "pincode": "400001",
  "poll_jitter_seconds": 30,
  "track": [
    "HPMCP01_08",
    "HPPCP01_02",
    "DBDCP41_30"
  ],
  "track_all_available": false
}
```

Field meanings — implement exactly these, no others:

- `pincode` — string, the delivery pincode.
- `poll_jitter_seconds` — int; sleep a random 0..N seconds before the poll so repeated cron
  runs do not hit Amul on the exact same second. `0` disables.
- `track` — list of SKU strings to watch.
- `track_all_available` — bool. When `true`, `track` is ignored and every SKU in the protein
  category is watched.

**Verify**: `python3 -c "import json;d=json.load(open('apps/amul-watch/config.example.json'));assert set(d)=={'pincode','poll_jitter_seconds','track','track_all_available'};print('OK')"`
→ prints `OK`

### Step 2: Write `amul_api.py`

Stdlib only. It exposes exactly one public entry point:

```python
def fetch_products(pincode: str, jar_path: str) -> tuple[str, list[dict]]:
    """Run the 6-step bootstrap and return (substore, products).

    Each product dict carries at least: sku, name, price, available,
    inventory_quantity.
    Raises AmulError on any non-2xx or unparseable response.
    """
```

Internals, following the "Current state" section verbatim:

- `class AmulError(RuntimeError)` — carries `.status` when the failure was HTTP.
- `_curl(url, method="GET", extra_headers=None, body=None, jar_path=...)` → `(body_text,
  status_int)`. Build the argv exactly as listed under "Transport" above. Append
  `-w "\n__STATUS__%{http_code}"` and split the trailing marker off stdout to recover the
  status code. Raise `AmulError` when status >= 400.
- `tid_header(session_tid)` — the verbatim snippet above.
- `_session_tid(jar_path)` — steps 1 and 2. Strip the leading `session = ` before
  `json.loads`. Raise `AmulError("no tid in session info")` when `tid` is missing.
- `_resolve_substore(pincode, tid, jar_path)` — step 3. Raise
  `AmulError(f"no pincode record for {pincode}")` when `records` is empty.
- `_set_store(substore, tid, jar_path)` — step 4.
- `_store_version(jar_path)` — step 5. On no regex match, return `"6"` and print a warning
  to stderr — do not raise. (The reference implementation falls back the same way.)
- `fetch_products(...)` — step 6, then `json.loads(body)["data"]`. Raise `AmulError` when
  `data` is not a list.

Compute a **fresh** `tid_header()` for every request that needs one (steps 3, 4, 6). Do not
reuse one value across requests.

**Verify**: `python3 -m py_compile apps/amul-watch/amul_api.py` → exit 0, no output

### Step 3: Write `watch.py` — including the exact diff function

CLI flags: `--once` (single poll, the cron mode — this is the only mode; there is no daemon
loop), `--dry-run` (print, never notify, never write state), `--pincode PIN` (override
config), `--config PATH` (default `apps/amul-watch/config.json`, resolved relative to the
script's own directory), `--state PATH` (default `state.json`, same resolution).

State file shape — one JSON object keyed by substore, so changing pincode cannot leak a
stale diff across stores:

```json
{ "mumbai-br": { "HPMCP01_08": true, "HPPCP01_02": false } }
```

**Availability, verbatim:**

```python
def is_available(product: dict) -> bool:
    """Amul's own flag is authoritative; quantity alone is not enough."""
    return bool(product.get("available") == 1 and (product.get("inventory_quantity") or 0) > 0)
```

**The edge-trigger diff — write this function exactly as written. It is the gate.**

```python
def transitions(prev: dict, curr: dict, tracked: list) -> list:
    """SKUs that flipped unavailable -> available since the previous poll.

    An SKU absent from `prev` defaults to True (treated as already-available), so a
    first run, a newly added SKU, and a wiped state file all stay silent instead of
    firing a backlog of alerts.
    """
    fired = []
    for sku in tracked:
        was = prev.get(sku, True)
        now = curr.get(sku, False)
        if now and not was:
            fired.append(sku)
    return fired
```

Main flow for `--once`:

1. Load config; `--pincode` overrides `config["pincode"]`.
2. If `poll_jitter_seconds > 0` and not `--dry-run`: `time.sleep(random.uniform(0, N))`.
3. `substore, products = amul_api.fetch_products(pincode, jar_path)`.
4. Build `curr = {p["sku"]: is_available(p) for p in products}`.
5. `tracked = list(curr) if config["track_all_available"] else config["track"]`.
6. Load `prev = state.get(substore, {})`. A missing state file means `{}`.
7. `fired = transitions(prev, curr, tracked)`.
8. `--dry-run`: print one line per tracked SKU as
   `avail={0|1} qty=<n>  <sku>  <name>`, print `would notify: <skus>`, exit 0 **without
   writing state**.
9. Otherwise, for each fired SKU, send one notification (Step 4), then write
   `state[substore] = curr` back to the state file and exit 0.

Notifications are **one message per fired SKU**, not a digest — the owner acts on a single
product and a digest buries the one that matters. Message body:

```
🥛 IN STOCK — {name}
₹{price}  ·  qty {inventory_quantity}
https://shop.amul.com/en/product/{alias}
```

**Verify**: `python3 -m py_compile apps/amul-watch/watch.py` → exit 0, no output

### Step 4: Wire the notifier

Shell out to the existing CLI — resolve it relative to the repo root, four levels up from
`watch.py`:

```python
NOTIFY = os.path.join(REPO_ROOT, "tooling", "cli", "notify", "notify")
```

Allow `AMUL_WATCH_NOTIFY` in the environment to override that path — the test suite uses it
to inject a stub.

Call `subprocess.run([NOTIFY, "send", message])`. Exit 0 is sent. **Exit 3 (undeliverable)
must print a `WARN` line to stderr and continue** — a Telegram outage must not crash the
cron or lose the state write. Any other non-zero exit: print `WARN` and continue too. Never
raise out of the notify path.

**Verify**: `grep -c 'AMUL_WATCH_NOTIFY' apps/amul-watch/watch.py` → `1` or more

### Step 5: Write `test-amul-watch.sh` — the merge gate

Bash, `set -e`, a `fail()` helper that prints `FAIL: <msg>` to stderr and exits 1, exactly
like `tooling/cli/notify/test-notify.sh` (read it first and match its idiom). Build a temp
dir, stub `curl` and the notify binary on `PATH`, `trap` cleanup on EXIT. Assert, at minimum:

1. **TID format** — `tid_header("abc")` matches `^[0-9]{13}:[0-9]{1,3}:[0-9a-f]{64}$`, and
   two consecutive calls differ.
2. **Bracket rule** — the product URL the code builds contains a literal `filters[0][field]`
   and contains **no** `%5B`. Fail message must mention `bracket`.
3. **Availability rule** — `is_available({"available":0,"inventory_quantity":5})` is
   `False`; `is_available({"available":1,"inventory_quantity":1})` is `True`.
4. **First-run silence** — `transitions({}, {"A": True}, ["A"])` returns `[]`. Fail message:
   `FAIL: first run must not notify`.
5. **Edge fires once** — `transitions({"A": False}, {"A": True}, ["A"])` returns `["A"]`.
6. **Repeat poll is silent** — `transitions({"A": True}, {"A": True}, ["A"])` returns `[]`.
   Fail message **must be exactly**: `FAIL: repeat poll must not re-notify`
   (the mutation gate greps for this string — do not reword it).
7. **Untracked SKU ignored** — `transitions({"B": False}, {"B": True}, ["A"])` returns `[]`.
8. **End-to-end with stubs** — stubbed `curl` returns canned fixtures for all six steps;
   run `watch.py --once` twice against the same state file; assert the stub notifier was
   invoked exactly once across both runs. Fail message must mention `re-notify`.
9. **Notify failure is survivable** — stub notifier exits 3; `watch.py --once` still exits
   0 and still writes state.

Last line on success: `echo "ALL TESTS PASSED"`.

**Verify**: `bash apps/amul-watch/test-amul-watch.sh` → exit 0, last line `ALL TESTS PASSED`

### Step 6: Prove the gate can actually fail

Run the mutation by hand before committing:

```bash
sed -i.bak 's/if now and not was:/if now:/' apps/amul-watch/watch.py && rm -f apps/amul-watch/watch.py.bak
bash apps/amul-watch/test-amul-watch.sh   # MUST fail, printing: FAIL: repeat poll must not re-notify
git checkout apps/amul-watch/watch.py
bash apps/amul-watch/test-amul-watch.sh   # MUST pass again
```

If the mutated run passes, the gate is decorative — fix the test, not the assertion.

**Verify**: the mutated run exits non-zero and its output contains
`FAIL: repeat poll must not re-notify`; the reverted run exits 0.

### Step 7: `run.sh` for the VPS cron

Pattern-B wrapper, mirroring `apps/telegram-my-planner/tools/daily-digest/deploy.sh` in
spirit (read it first). It must:

1. `set -euo pipefail`
2. `cd` to the repo root derived from `${BASH_SOURCE[0]}`
3. `git pull --ff-only` (Pattern B: the VPS picks up new code every run)
4. `exec python3 apps/amul-watch/watch.py --once`

Do **not** add it to any crontab and do not SSH anywhere. Wiring is the owner's one-time
manual step, documented in the README.

**Verify**: `bash -n apps/amul-watch/run.sh` → exit 0

### Step 8: Docs

`apps/amul-watch/README.md` — what it does, the six-step API flow in three sentences, setup
(`cp config.example.json config.json`, edit, ensure `infra/secrets/telegram.env` exists),
how to run once by hand, and the exact one-time VPS cron wiring the owner must do:

```
*/5 * * * * /srv/projects/personal-stuff/apps/amul-watch/run.sh >> /var/log/amul-watch.log 2>&1
```

State the rate-limit posture plainly: one poll per five minutes, jittered, single pincode.
Do not lower the interval below five minutes.

`apps/amul-watch/CLAUDE.md` — how Claude should operate here: the bracket rule, the
edge-trigger rule, the fact that the TID must be recomputed per request, and the standing
boundary that ordering/credentials live in plan 209 and never leak into this folder.

Append one row to `apps/local-apps.md` matching the existing row format.

**Verify**: `test -s apps/amul-watch/README.md && test -s apps/amul-watch/CLAUDE.md && grep -q 'amul-watch' apps/local-apps.md && echo OK` → `OK`

### Step 9: Live smoke on a clean tree

```bash
git clean -xdn apps/amul-watch          # review, then -xdf if anything stray is listed
python3 apps/amul-watch/watch.py --once --dry-run --pincode 400001
```

Must print a table of ~23 protein SKUs with a mix of `avail=0` and `avail=1`, print
`would notify: ...`, exit 0, and leave **no** `state.json` behind.

If this returns zero products, the bracket rule or the `frontend: 1` header is wrong — that
is the failure mode, check there first.

**Verify**: the command exits 0, prints more than 10 SKU lines, and
`test ! -f apps/amul-watch/state.json` succeeds.

## Test plan

`apps/amul-watch/test-amul-watch.sh` is the whole gate and runs with no network: `curl` and
the notify CLI are both stubbed on `PATH`. It covers the TID format, the bracket-literal
query, the availability rule, all four diff cases (first run / edge / repeat / untracked),
the two-run end-to-end single-notification property, and notify-failure survival.

The live smoke in Step 9 is a manual read-only confirmation that the real API still answers;
it is deliberately **not** in `test_cmd`, because a network flake must not block a merge.

## Done criteria

- [ ] `bash apps/amul-watch/test-amul-watch.sh` exits 0 and prints `ALL TESTS PASSED`
- [ ] `python3 -m py_compile apps/amul-watch/watch.py apps/amul-watch/amul_api.py` exits 0
- [ ] The Step 6 mutation makes the gate fail with `FAIL: repeat poll must not re-notify`, and reverting makes it pass
- [ ] `python3 apps/amul-watch/watch.py --once --dry-run --pincode 400001` exits 0 and prints more than 10 SKU rows
- [ ] A dry run leaves no `state.json`; two consecutive real runs against an unchanged catalogue produce exactly one notification total for a SKU that flipped once
- [ ] `bash -n apps/amul-watch/run.sh` exits 0
- [ ] `git status --porcelain` lists no `config.json`, `state.json`, `cookies.txt`, or `__pycache__`
- [ ] `grep -rniE '(place.?order|add.?to.?cart|send.?otp|verify.?otp|password|razorpay)' apps/amul-watch/` returns nothing

## STOP conditions

- **Any Amul endpoint returns 403, 429, or a Cloudflare challenge page.** Do not add
  retries, proxies, rotating user-agents, or a lower poll interval. Stop and report — this
  is a signal to change the approach, not to evade a block.
- **Gate integrity**: if an assertion in `test-amul-watch.sh` fails, fix the code or the
  fixture. Weakening, swapping, skipping, or deleting an assertion is a STOP.
- **The live smoke returns zero products.** Stop and report the exact URL used. Do not
  "fix" it by removing filters or widening the category — a silently-empty result is how a
  watcher becomes permanently silent.
- **Any temptation to implement login, cart, checkout, payment, or credential storage.**
  That is plan 209 and it is gated on a manual capture the owner has not done yet.
- **Any need to store a secret in this folder.** Telegram creds already live in
  `infra/secrets/telegram.env` and are reached through the `notify` CLI. Nothing else
  belongs here.
- Poll interval below five minutes, or removal of the jitter.

## Maintenance notes

- **Do not "simplify" the bootstrap away.** A second reference implementation,
  `github.com/Nishu0/amul-backend`, fetches the same product URL with *no cookies, no TID
  header, and no `frontend: 1`*, using a hardcoded `substore=66505ff0998183e1b1935c75`. That
  looks like a much shorter path to the same data. It is dead: re-running that exact request
  on 2026-08-18 returned **HTTP 401 Unauthorized**. Amul added auth after that repo went
  quiet (last push 2025-06-11). The six steps are all load-bearing.
- That same repo fires restocks on `inventory_quantity > 0` alone. A live row observed during
  planning was `available=0, inventory_quantity=5`, which that rule would false-fire on.
  `is_available()` here keeps both clauses for that reason.
- **The likeliest breakage is silent, not loud**: Amul bumps the storefront version or
  renames the category and the product query returns `[]` with a 200. `fetch_products`
  raising only on non-2xx will not catch that. A future hardening pass should alert when a
  poll returns zero products for N consecutive runs.
- The `v=<store_version>` value is fetched per process from `storeinfo.js`; the hardcoded
  `6` fallback will rot. If results go strange, check that regex first.
- `substoreList` (alias → `_id`) exists in the reference repo at `src/utils/substores.ts`
  and is **not** needed here — the `substore` param is optional on the product query and was
  verified working without it. If Amul ever makes it mandatory, that file is where the
  mapping lives.
- A reviewer should scrutinise exactly two things: that `transitions()` still has both
  clauses of `if now and not was`, and that the product URL still contains literal brackets.
  Everything else is replaceable.
- Plan 209 (auto-order) will import `amul_api.fetch_products` and reuse the cookie jar.
  Keep `amul_api.py` free of any watcher-specific state so it stays reusable.
