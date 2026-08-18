---
executor: claude-p
model: sonnet
test_cmd: bash apps/amul-watch/test-amul-assist.sh
ui:
deploy:
needs: ["Owner must complete the cart capture in the 'Human precondition' section before this plan can be dispatched. No purchase is required for the capture."]
needs_prs: [208]
touches: [apps/amul-watch/amul_cart.py, apps/amul-watch/telegram.py, apps/amul-watch/har2session.py, apps/amul-watch/watch.py, apps/amul-watch/test-amul-assist.sh, apps/amul-watch/assist.example.json, apps/amul-watch/README.md, apps/amul-watch/CLAUDE.md]

mutation_apply: sed -i.bak 's/if not approved:/if False:/' apps/amul-watch/amul_cart.py && rm -f apps/amul-watch/amul_cart.py.bak
mutation_command: bash apps/amul-watch/test-amul-assist.sh
mutation_expect: FAIL: must not touch cart without approval
mutation_cwd:
mutation_timeout:
---

# Plan 209: amul-watch — approve-to-cart checkout assist

## Summary

- **Problem statement**: Plan 208 pings the owner on a restock, but by the time he opens the
  site, finds the product, adds it, and re-enters an address, the stock window has closed.
  Headless auto-ordering was considered and **rejected by the owner** — it stores payment
  intent and buys unattended. The wanted middle ground: the bot does the tedious part, the
  owner does the paying.
- **Goals**:
  - Restock alert carries the product photo, price, and quantity, plus two inline Telegram
    buttons: **Add to cart** / **Ignore**.
  - On approval, the job reuses a stored Amul session to add the SKU to the cart and apply
    the saved delivery address.
  - It then replies with a direct checkout link. The owner opens it, sees a filled cart, and
    pays. **No code in this plan may reach a payment or place-order endpoint.**
  - Approval is answered in seconds, not at the next cron tick — the run stays alive briefly
    and polls for the button press.
- **Executor proposed**: `claude-p` / Sonnet — the cart and address requests must be
  re-expressed from a captured session rather than copied from a spec, which is continuous
  judgment (`tooling/boss/data/rules.md`: "can't be fully inlined").
- **Done criteria** (terse — full list below): `test-amul-assist.sh` exits 0; the
  no-approval mutation fails the gate; a grep proves no payment/order endpoint is referenced;
  one supervised live run produces a checkout link with the right item and address.
- **Stop conditions** (terse — full list below): any request that could place an order or
  touch payment; any cart write without a recorded approval; any session value committed.
- **Test / verification for success**: `apps/amul-watch/test-amul-assist.sh` — stubbed-curl
  suite asserting approval-gating, allowlist, daily cap, timeout behaviour, and the
  no-payment-endpoint grep. Plus one owner-supervised live run.
- **Open points for plan readiness**: **NOT HANDOFF-READY.** Two unknowns block dispatch,
  both resolved by the capture below: the add-to-cart request shape and the set-address
  request shape. Do not `/secretary raise` until the "Human precondition" section is done
  and Steps 3–4 carry real request shapes instead of `TBD`.

> **Executor instructions**: Do not begin until the "Human precondition" section is marked
> complete and Steps 3–4 carry captured request shapes instead of `TBD`. If they still say
> `TBD`, stop and report.
>
> **Drift check (run first)**: `git diff --stat 17d3d58c..HEAD -- apps/amul-watch`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 208 (must land first — imports `amul_api` and hooks `transitions()`)
- **Category**: feature
- **Difficulty**: tricky
- **Planned at**: commit `17d3d58c`, 2026-08-18

## Why this matters

This is a deliberate de-scope from headless ordering, and the de-scope is the feature. The
worst possible outcome of a bug here is *an unwanted item sitting in a cart*. The worst
outcome of the version we dropped was *an unwanted purchase*. That single change removes
almost the entire risk surface while keeping nearly all of the speed benefit — the slow part
was never the payment tap, it was finding the product and re-entering the address while the
stock drained.

It also makes the one-time capture dramatically cheaper: the owner adds an item to a cart
and stops. **No purchase is needed to capture the flow**, unlike the rejected plan.

The load-bearing safety property is that nothing touches the cart without a recorded
approval. That is why it is a mutation gate rather than a comment.

## Human precondition — the owner does this once, before dispatch

1. Open Chrome, go to `https://shop.amul.com`, log in with your phone number + OTP.
2. DevTools → **Network** tab → tick **Preserve log** → Clear.
3. **Add any one in-stock item to your cart**, then open the cart and make sure your
   delivery address is selected. **Stop there. Do not pay.**
4. Right-click in the Network panel → **Save all as HAR with content**.
5. Save to `~/kb-scratch/amul/cart.har` — **outside the repo**. It holds your live session
   cookie and address. Never commit it.
6. Tell Claude it exists. Claude extracts the request chain and replaces every `TBD` below.

Claude will extract exactly: the add-to-cart endpoint + body, the set-address endpoint +
body, the checkout page URL, your `amulUserId`, `amulCartId`, address `_id`, and the session
cookie names. Nothing else.

## Current state

### Landed by plan 208 (reuse, do not rewrite)

- `apps/amul-watch/amul_api.py` — the verified six-step bootstrap and
  `fetch_products(pincode, jar_path) -> (substore, products)`.
- `apps/amul-watch/watch.py` — `transitions()` yields the restock edges this plan hooks.
- `apps/amul-watch/test-amul-watch.sh` — leave untouched; add a new gate file.

208 sends plain text through `tooling/cli/notify/notify send`. That CLI cannot send a photo
or an inline keyboard, and **must not be modified** — it is shared with `greenlight` and
`overnight`. This plan adds its own thin `telegram.py` that reads the same credentials from
`infra/secrets/telegram.env` and calls the Bot API directly. Reading that file is fine;
editing the notify CLI is not.

### Learned from `github.com/Nishu0/amul-backend` (checked 2026-08-18)

143 stars, TypeScript, notification-only, **last pushed 2025-06-11** — over a year stale. It
has no cart or ordering code, so it does not shortcut the capture. Four concrete findings,
all verified live during planning:

1. **Its stock fetch no longer works — do not copy it.** It GETs the product URL with a
   hardcoded `substore=66505ff0998183e1b1935c75` and *no cookies, no TID header, no
   `frontend: 1`*. Re-running that exact request today returns **HTTP 401 Unauthorized**.
   Amul added auth after that repo went quiet. 208's cookie+TID bootstrap is required, not
   optional. Do not "simplify" it.
2. **Its restock rule is wrong for our purposes.** It fires on `inventory_quantity > 0`
   alone, ignoring `available`. A live row observed during planning was
   `available=0, inventory_quantity=5` — that rule would false-fire. 208's
   `available == 1 and inventory_quantity > 0` stands.
3. **Its image-URL pattern is worth taking, but its implementation is buggy.** Images live
   at `https://shop.amul.com/s/<STORE_ID>/<path>` with
   `STORE_ID = 62fa94df8c13af2e242eba16`. Nishu0 blindly concatenates the prefix, but the
   API is inconsistent: some `images[i].image` values are bare
   (`66741c9a…/01-hero-image_….png`) and some **already include** `s/62fa94df8c13af2e242eba16/`.
   Blind concat on the second form returns **HTTP 406**. Verified: both correctly-formed
   URLs return `200 image/png`; the double-prefixed one returns `406`. Normalise:

   ```python
   def image_url(image_path: str) -> str:
       """Amul returns some paths already prefixed with s/<store>/ and some bare."""
       p = image_path.lstrip("/")
       if p.startswith("s/"):
           return f"https://shop.amul.com/{p}"
       return f"https://shop.amul.com/s/{STORE_ID}/{p}"
   ```

   Use `images[0]` — the observed convention is that index 0 is the hero image.
4. **Its Telegram approval pattern is the right one.** `telegramService.ts` uses
   `reply_markup.inline_keyboard` with `callback_data`, then `answerCallbackQuery` to
   acknowledge the tap. We use the same Bot API surface, but **without** its long-polling
   daemon (`node-telegram-bot-api`) — see "Approval transport" below.

Also verified live: the product page `https://shop.amul.com/en/product/<alias>` returns
`200`, so 208's message link is correct.

### Approval transport — the design decision, already made

The cron runs every five minutes. Waiting for the next tick to notice a button press would
routinely blow the stock window, and a persistent bot daemon is exactly the machinery this
project exists to avoid.

**Therefore**: when a restock edge fires for an assist-enabled SKU, the *same* cron process
sends the message and then blocks, polling `getUpdates` every 2 seconds for up to
`approval_timeout_seconds` (default 240), looking for a `callback_query` whose
`callback_data` matches the token it just issued. On timeout it edits the message to
"expired", writes state, and exits 0.

This is a short-lived foreground wait inside a normal cron run — no daemon, no webhook, no
open port. Two consequences to handle:

- Overlap: a run holding a 4-minute wait can still be alive when the next 5-minute tick
  starts. Take a lockfile at `apps/amul-watch/.lock` (O_CREAT|O_EXCL, PID inside, stale
  after 10 minutes) and exit 0 quietly if held.
- `getUpdates` offset: always acknowledge consumed updates by passing
  `offset = last_update_id + 1`, or the same press replays on the next run.

### To be filled from the capture — currently unknown

| Unknown | Why it matters | Status |
|---|---|---|
| Add-to-cart request (method, path, body) | The core action | `TBD` |
| Set-address request | Whether address must be re-applied per cart | `TBD` |
| Checkout page URL to hand back | The deliverable link | `TBD` |
| Session lifetime | How often the owner re-captures | `TBD` |

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the new gate | `bash apps/amul-watch/test-amul-assist.sh` | exit 0, `ALL TESTS PASSED` |
| 208's gate must stay green | `bash apps/amul-watch/test-amul-watch.sh` | exit 0 |
| Import the capture | `python3 apps/amul-watch/har2session.py ~/kb-scratch/amul/cart.har` | writes `infra/secrets/amul-session.json`, prints a redacted summary |
| Dry run the assist path | `python3 apps/amul-watch/watch.py --once --assist --dry-run` | prints the intended chain, sends nothing, writes nothing |
| No-payment proof | `grep -rniE '(place.?order\|processPayment\|razorpay\|payment)' apps/amul-watch/*.py` | no matches |

## Scope

**In scope**:
- `apps/amul-watch/telegram.py` — thin Bot API client: `send_photo_with_buttons`,
  `wait_for_callback`, `answer_callback`, `edit_message`
- `apps/amul-watch/amul_cart.py` — approval gate, add-to-cart, set-address, checkout link
- `apps/amul-watch/har2session.py` — capture → `infra/secrets/amul-session.json`
- `apps/amul-watch/assist.example.json` — config template
- `--assist` flag on `watch.py`, off by default
- `apps/amul-watch/test-amul-assist.sh`
- README / CLAUDE.md updates

**Out of scope**:
- **Any payment or order-placement request.** This is the point of the plan.
- Editing `tooling/cli/notify/*` — read its env file, never change the CLI.
- Storing a password. Amul uses phone OTP; there is no password to store.
- Automating OTP retrieval (SMS/email bridges). Capture stays manual.
- Quantity above 1.
- A long-running bot daemon or a webhook listener.

## Git workflow

- Branch: `advisor/209-amul-watch-approve-to-cart`
- Commit: `feat(amul-watch): approve-to-cart checkout assist` — no AI footers. Do NOT push.

## Steps

*(Steps 3–4 finalise only after the capture lands. Steps 1, 2, 5, 6, 7 are fixed now.)*

### Step 1: Session storage and config

`har2session.py` parses the HAR, extracts session cookies + `amulUserId` + `amulCartId` +
address id, and writes `infra/secrets/amul-session.json`. Confirm the path is ignored before
writing: `git check-ignore -q infra/secrets/amul-session.json`. Print a **redacted** summary
only — cookie names and value lengths, never values.

`assist.example.json` (copied to `assist.json`, gitignored):

```json
{
  "enabled": false,
  "allowlist": ["HPMCP01_08"],
  "max_price_inr": 900,
  "max_carts_per_day": 3,
  "approval_timeout_seconds": 240,
  "address_id": ""
}
```

`allowlist` is deliberately **separate** from 208's `track` list — watching must never imply
carting. `enabled` defaults `false`; a missing or malformed config fails **closed**.

**Verify**: `git check-ignore -q infra/secrets/amul-session.json && echo OK` → `OK`

### Step 2: `telegram.py`

Read `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `infra/secrets/telegram.env` (same
file `notify` uses; parse `KEY=value` lines, ignore comments). Allow
`AMUL_WATCH_TG_BASE` to override the API base URL — the test suite points it at a stub.

Four functions:

- `send_photo_with_buttons(photo_url, caption, token) -> message_id` — `sendPhoto` with
  `reply_markup={"inline_keyboard": [[{"text": "🛒 Add to cart", "callback_data": f"add:{token}"},
  {"text": "✕ Ignore", "callback_data": f"skip:{token}"}]]}`. If `sendPhoto` fails (bad image
  URL), fall back to `sendMessage` with the same keyboard — a broken image must not lose the
  alert.
- `wait_for_callback(token, timeout_s) -> "add" | "skip" | None` — poll `getUpdates` every
  2s, always advancing `offset = last_update_id + 1`. Return `None` on timeout.
- `answer_callback(callback_query_id, text)` — acknowledge so Telegram stops the spinner.
- `edit_message(message_id, caption)` — used to strike the buttons after a decision or a
  timeout, so a stale message cannot be tapped later.

`token` is a short random hex string minted per alert. A `callback_data` whose token does not
match the current one is ignored — this is what stops an old message from carting something
days later.

**Verify**: `python3 -m py_compile apps/amul-watch/telegram.py` → exit 0

### Step 3: Add to cart — `TBD, from capture`

### Step 4: Set address and build the checkout link — `TBD, from capture`

### Step 5: The approval gate — write this exactly

Every path that mutates the cart goes through this. The `approved` flag must be derived from
an actual button press, never defaulted:

```python
def prepare_cart(sku, price, cfg, approved, carts_today, client):
    """Nothing may touch the cart without a recorded approval. This is the safety property."""
    if not approved:
        return None, "not approved"
    if not cfg.get("enabled", False):
        return None, "assist disabled"
    if sku not in cfg.get("allowlist", []):
        return None, f"{sku} not in allowlist"
    if price > cfg.get("max_price_inr", 0):
        return None, f"price {price} over cap {cfg.get('max_price_inr')}"
    cap = cfg.get("max_carts_per_day", 0)
    if carts_today >= cap:
        return None, f"daily cart cap {cap} reached"
    return client.add_and_address(sku), "ok"
```

Note the defaults: `enabled` defaults `False`, `max_price_inr` defaults `0`,
`max_carts_per_day` defaults `0`. A truncated or corrupt config blocks everything.

`carts_today` counts entries dated today (`Asia/Kolkata`) in `apps/amul-watch/carts.json`
(gitignored). Append to that log **before** sending the checkout link, so a crash mid-send
cannot lose the count.

**Verify**: `bash apps/amul-watch/test-amul-assist.sh` → exit 0

### Step 6: Prove the approval gate fires

```bash
sed -i.bak 's/if not approved:/if False:/' apps/amul-watch/amul_cart.py && rm -f apps/amul-watch/amul_cart.py.bak
bash apps/amul-watch/test-amul-assist.sh   # MUST fail with: FAIL: must not touch cart without approval
git checkout apps/amul-watch/amul_cart.py
bash apps/amul-watch/test-amul-assist.sh   # MUST pass
```

If the mutated run passes, the gate is decorative — fix the test, not the assertion.

### Step 7: Owner-supervised first live run

Owner sets `enabled: true` with one cheap SKU on the allowlist, waits for a real restock (or
temporarily allowlists something already in stock and wipes `state.json` to force an edge),
taps **Add to cart**, and confirms the returned link opens a cart holding exactly that item
with the right address. Nothing is paid.

## Test plan

`test-amul-assist.sh`, stubbed `curl` and a stubbed Telegram base URL, no network. Assert:

1. **No approval → no cart request.** `wait_for_callback` returns `None` (timeout); the stub
   records zero cart-mutating requests. Fail message **exactly**:
   `FAIL: must not touch cart without approval`
2. **"skip" tap → no cart request**, and the message is edited to remove the buttons.
3. `enabled: false` blocks even with an approval.
4. An SKU on 208's `track` list but absent from `allowlist` is blocked.
5. `price > max_price_inr` blocks.
6. `carts_today >= max_carts_per_day` blocks.
7. A missing / empty / malformed `assist.json` fails closed.
8. A stale token in `callback_data` is ignored.
9. `getUpdates` offset advances — the same press is not consumed twice across two runs.
10. The lockfile prevents a second concurrent run; the second exits 0 silently.
11. **No-payment grep**: `grep -rniE '(place.?order|processPayment|razorpay|payment)'` over
    `apps/amul-watch/*.py` returns nothing. Fail message must mention `payment`.
12. A 401 / `AMUL_SESSION_UNAUTHENTICATED` sends a "session expired, re-capture" message and
    does **not** retry.
13. 208's gate still passes unchanged.

## Done criteria

- [ ] `bash apps/amul-watch/test-amul-assist.sh` exits 0 and prints `ALL TESTS PASSED`
- [ ] `bash apps/amul-watch/test-amul-watch.sh` still exits 0
- [ ] The Step 6 mutation fails the gate with `FAIL: must not touch cart without approval`
- [ ] `grep -rniE '(place.?order|processPayment|razorpay|payment)' apps/amul-watch/*.py` returns nothing
- [ ] `python3 apps/amul-watch/watch.py --once --assist --dry-run` issues zero POSTs and writes no state
- [ ] `git status --porcelain` shows no `assist.json`, `carts.json`, `amul-session.json`, `.lock`, or `*.har`
- [ ] `grep -rn 'password' apps/amul-watch/` returns nothing
- [ ] README documents the re-capture procedure for when the session expires
- [ ] Running with `--assist` absent behaves exactly as 208 did (a diff of notification
      behaviour shows no change)

## STOP conditions

- **Any request to a payment or order-placement endpoint**, in code or in a test fixture.
  This plan's entire justification is that it stops at the cart.
- **Any cart mutation reached without a recorded approval** during development. Stop and
  report; the safety property is broken.
- **A HAR, cookie, or session value written anywhere inside the repo**, including fixtures.
  Fixtures use synthetic values only.
- **The capture shows the cart cannot be pre-filled server-side** (e.g. the cart is
  client-side only until checkout). Stop and report; the fallback is a deep link to the
  product page with the address pre-selected, which is still a win but is a different plan.
- **Gate integrity**: weakening, skipping, or deleting any assertion is a STOP. Fix the code.
- Any retry loop around a 401. Session death is a human event.
- Any change that makes 208's watcher depend on this module. The notifier must keep working
  with the assist code entirely absent.
- Any modification to `tooling/cli/notify/*`.

## Maintenance notes

- Session lifetime is the operational cost. If re-capture turns out to be needed weekly, the
  honest verdict may be that the notifier alone is the product — record either outcome in
  `decisions.md`.
- The `getUpdates` approach conflicts with any *other* consumer of the same bot token: two
  pollers steal each other's updates. `notify` only ever *sends*, so today there is no
  conflict — but if a second polling consumer is ever added to this bot, this design breaks
  and needs a dedicated bot token. Note this in CLAUDE.md.
- Amul's cart flow will change without notice; the captured request shapes are a snapshot.
  The README's re-capture procedure is the maintenance path, not a rewrite.
- A reviewer should scrutinise exactly two things: that `prepare_cart` still returns early on
  `not approved`, and that no payment endpoint has crept in. Everything else is replaceable.
