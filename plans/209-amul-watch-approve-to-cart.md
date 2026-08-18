---
executor: claude-p
model: sonnet
test_cmd: bash apps/amul-watch/test-amul-assist.sh
ui:
deploy:
needs: []
needs_prs: [208]
touches: [apps/amul-watch/amul_cart.py, apps/amul-watch/telegram.py, apps/amul-watch/amul_login.py, apps/amul-watch/watch.py, apps/amul-watch/test-amul-assist.sh, apps/amul-watch/assist.example.json, apps/amul-watch/README.md, apps/amul-watch/CLAUDE.md]

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
  wired against a real session and a real Telegram approval loop. Every request shape is
  inlined below, so this is placement plus careful sequencing, not open design.
- **Done criteria** (terse — full list below): `test-amul-assist.sh` exits 0; the
  no-approval mutation fails the gate; a grep proves no payment/order endpoint is referenced;
  one supervised live run produces a checkout link with the right item and address.
- **Stop conditions** (terse — full list below): any request that could place an order or
  touch payment; any cart write without a recorded approval; any session value committed.
- **Test / verification for success**: `apps/amul-watch/test-amul-assist.sh` — stubbed-curl
  suite asserting approval-gating, allowlist, daily cap, timeout behaviour, and the
  no-payment-endpoint grep. Plus one owner-supervised live run.
- **Open points for plan readiness**: none. The owner's browser capture was taken on
  2026-08-18 and every previously-unknown request shape (login, add-to-cart, set-address)
  is now inlined verbatim below and cross-checked against a live API call.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 17d3d58c..HEAD -- apps/amul-watch`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 208 (must land first — imports `amul_api` and hooks `transitions()`)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `17d3d58c`, 2026-08-18

## Why this matters

This is a deliberate de-scope from headless ordering, and the de-scope is the feature. The
worst possible outcome of a bug here is *an unwanted item sitting in a cart*. The worst
outcome of the version we dropped was *an unwanted purchase*. That single change removes
almost the entire risk surface while keeping nearly all of the speed benefit — the slow part
was never the payment tap, it was finding the product and re-entering the address while the
stock drained.

The owner's browser capture on 2026-08-18 also removed the last unknown: it exposed Amul's
OTP login endpoints, so the session no longer has to be smuggled out of a browser. The job
logs itself in and asks the owner for the six digits over Telegram.

The load-bearing safety property is that nothing touches the cart without a recorded
approval. That is why it is a mutation gate rather than a comment.

## No browser capture is needed — do not reintroduce one

An earlier draft of this plan asked the owner to export a HAR so the session could be lifted
out of Chrome. That is **no longer necessary and must not be reintroduced.** The 2026-08-18
capture proved two things: Chrome strips every `cookie` and `set-cookie` header from a saved
HAR (so a HAR cannot carry a session at all), and Amul's OTP login endpoints are
straightforward to call directly.

So the job logs itself in. The owner puts a phone number in config once; when the session
expires the job requests an OTP, Telegrams the owner "reply with the 6 digits", and completes
the login. Nothing is exported, nothing is pasted from DevTools, and no capture file exists
to leak.

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
has no cart or ordering code, so nothing here comes from it. Four concrete findings,
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

### The captured flow — from the owner's own session, 2026-08-18

Every request below came from the owner's real browser session and was cross-checked against
a live API call during planning. All are `PUT` (StoreHippo convention) and all carry the
headers 208 already builds: `content-type: application/json`, `frontend: 1`, a freshly
computed `tid`, plus `base_url`/`referer`.

**The `q=` query parameter.** Cart endpoints repeat the cart id in a JSON `q` param. The
browser percent-encodes braces and quotes but leaves the colon literal — e.g.
`?q=%7B%22_id%22:%2266cd...97%22%7D`. Reproduce exactly:

```python
from urllib.parse import quote
qparam = quote(json.dumps({"_id": cart_id}, separators=(",", ":")), safe=":")
```

**Login** — three calls; the OTP arrives as an SMS on the owner's phone:

| # | Request | Body |
|---|---|---|
| 1 | `PUT /entity/ms.users/_/isUserRegistered` | `{"data":{"phone":"<10-digit>"}}` |
| 2 | `PUT /api/1/entity/ms.users/_/sendOtp?new_otp_flow=1` | `{"data":{"phone":"<10-digit>"}}` |
| 3 | `PUT /api/1/entity/ms.users/_/login?new_login_flow=1` | `{"data":{"username":"+91<10-digit>","password":"<the 6-digit OTP>"}}` |

Note call 3: **the OTP travels in the `password` field**, and `username` is the phone with a
`+91` prefix. There is no account password — do not invent one, do not store one.

**Session → cart → address → handoff:**

| # | Request | Body / note |
|---|---|---|
| 4 | `PUT /entity/ms.carts/_/getUserCart` | `{"data":{"_id":null,"user_id":"<user_id>"}}` — returns the cart. **The cart id is discovered at runtime, never hardcoded.** |
| 5 | `PUT /entity/ms.carts/<cart_id>/_/addItem?q=<qparam>` | `{"data":{"product_id":"<product._id>","seller_id":"<product.seller>","selected_options":{},"variant_id":null,"quantity":1,"linked_product_id":"<product.linked_product_id>","sku":"<sku>"}}` |
| 6 | `GET /api/1/entity/ms.user_addresses?q=<quote of {"user_id": user_id}>` | returns the saved address objects |
| 7 | `PUT /entity/ms.carts/<cart_id>/_/updateAddresses?q=<qparam>` | `{"data":{"shipping_address":<the address object from call 6, verbatim>,"billing_address":<the same object>}}` |
| 8 | — | Reply to the owner with `https://shop.amul.com/en/checkout` |

**Why the handoff works at all:** the cart is server-side and keyed to `user_id` (call 4).
When the owner opens the checkout URL on a phone where he is already logged in, he sees the
cart this job just filled. No token passing, no deep link, no shared browser state.

**Privacy consequence, and it is load-bearing:** the address object in call 7 is echoed back
verbatim from call 6, fetched live every run. So **no name, phone, or street address is ever
written to disk by this job.** Config holds a phone number (for login) and an address `_id`;
everything else is transient. Keep it that way.

**The `seller_id` / `linked_product_id` trap — verified, and it will bite.** These are not
stable constants. The same SKU `DBDCP41_30` returned `seller = 650006e7bad4464748be31d4` and
`linked_product_id = 67f5d9659e1a8f00323dc504` in the owner's authenticated session, but
`seller = 6500299751e16335cb316786` and `linked_product_id = 67f5d8b84a391300256d9c33` in an
anonymous session on the *same* pincode and substore. Therefore: read `product._id`,
`product.seller` and `product.linked_product_id` from a products fetch made with **the same
authenticated session that will call `addItem`**. Never reuse 208's anonymous watcher values
for the cart call; never hardcode them. Add `fields[seller]=1` and
`fields[linked_product_id]=1` to that authenticated fetch.

**Captured deliberately, and deliberately NOT implemented.** The capture also contains
`PUT /entity/ms.carts/<cart_id>/_/updatePaymentMethod` (gateways seen: `ccavenueMulti`,
`phonepe-v2`) and `PUT /api/1/entity/ms.carts/_/placeOrder?q=<qparam>`. **The owner ruled
headless ordering out on 2026-08-18.** Holding the recipe is not permission to use it.
Referencing either endpoint fails this plan's grep gate, and that is the intent.

### Session lifetime — measured, and why OTP is the only door

Measured against the live site on 2026-08-18, and this settles a question the owner asked
directly ("is there another way to log in?"). There is not. Four checks:

1. **The session cookie lasts 7 days.** A fresh `jsessionid` came back as
   `Expires=Tue, 25 Aug 2026 15:11:55 GMT`, issued at `15:11:55` — exactly 168 hours. The
   other two cookies are Cloudflare's: `__cf_bm` (30 min, auto-refreshed) and `_cfuvid`
   (browser-session). Only `jsessionid` carries identity.
2. **The expiry does not slide.** Re-requesting with an existing jar returned **no**
   `set-cookie` for `jsessionid` at all — the server accepts the old one without extending
   it. Keeping the session warm with traffic therefore does **not** buy more time.
3. **There is no second login method.** `storeinfo.js` reports `login_field: "phone"`,
   `login_with_otp: "1"`, `login_providers: []`, and an empty `password_page`. No email
   login, no social login, no account password. `login_using_firebase: 1` is set but the
   owner's real login made **zero** calls to any Firebase, identitytoolkit, or securetoken
   host — so there is no Firebase refresh token to ride either.
4. **There is no refresh, renew, keepalive, or remember-me endpoint** anywhere in the
   storefront bundle; the only `ms.users` method beyond login is `adminLogin`.

So: **one OTP per 7 days is the floor, and it is not reducible by anything this codebase can
do.** Design around it rather than fighting it — the next two subsections are how.

### Login expiry must never cost the owner an alert

**This is a hard requirement, not a nicety.** The Amul login exists only to prepare a cart.
Stock alerts do not need it and must never depend on it.

When the session is missing or expired at the moment a restock fires, the job must still:

- send the normal restock alert with photo, price and the product link (208's behaviour), and
- replace the **Add to cart** button with a disabled-style one whose caption says the session
  needs a fresh OTP, and
- send the re-login prompt as a **separate** message, so the alert itself stays readable.

It must **not** swallow the alert, block on the OTP before alerting, or delay the alert while
attempting a login. The owner can always fall back to tapping the product link. A test asserts
this: with `amul-session.json` absent, `--assist` still produces exactly one restock alert.

### Re-login proactively, never mid-restock

Being asked for an OTP while a product is draining is the worst possible moment. So the job
tracks the login timestamp in `amul-session.json` and, once the session is older than
`relogin_after_days` (default `6` — one day of margin under the observed 7), sends the
re-login prompt on an ordinary quiet tick, unrelated to any restock.

Add to `assist.example.json`: `"relogin_after_days": 6`.

Refreshing early is free: a new login simply issues a new 7-day cookie.

### OTP intake is a seam, not a hardcoded path

`amul_login.py` reads the OTP through one function, `get_otp(reason: str) -> str`, with two
implementations selected by config (`otp_source`): `"stdin"` and `"telegram"` (default).

Keep that indirection even though only two exist today. The owner may later wire a phone
automation (e.g. an iOS Shortcut on SMS receipt) that POSTs the code to a small endpoint,
making login fully hands-free; that would be a third implementation of `get_otp` and nothing
else. **Do not build that now** — just do not hardcode Telegram into the login flow.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the new gate | `bash apps/amul-watch/test-amul-assist.sh` | exit 0, `ALL TESTS PASSED` |
| 208's gate must stay green | `bash apps/amul-watch/test-amul-watch.sh` | exit 0 |
| Log in (one-time / on expiry) | `python3 apps/amul-watch/amul_login.py` | sends an OTP, prompts for it, writes `infra/secrets/amul-session.json`, prints a redacted summary |
| Dry run the assist path | `python3 apps/amul-watch/watch.py --once --assist --dry-run` | prints the intended chain, sends nothing, writes nothing |
| No-payment proof | `grep -rniE '(place.?order\|processPayment\|razorpay\|payment)' apps/amul-watch/*.py` | no matches |

## Scope

**In scope**:
- `apps/amul-watch/telegram.py` — thin Bot API client: `send_photo_with_buttons`,
  `wait_for_callback`, `answer_callback`, `edit_message`
- `apps/amul-watch/amul_cart.py` — approval gate, add-to-cart, set-address, checkout link
- `apps/amul-watch/amul_login.py` — OTP login → `infra/secrets/amul-session.json`
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

### Step 1: Login and session storage

`amul_login.py` performs the three captured login calls on a fresh cookie jar, then persists
the session. Two modes:

- **Interactive** (`python3 apps/amul-watch/amul_login.py`) — prompts on stdin for the OTP.
  This is how the owner does the first login.
- **Telegram** (`--via-telegram`) — sends "reply with your 6-digit Amul OTP" and reads the
  reply with the same `getUpdates` polling `telegram.py` uses. This is how an expired session
  is renewed without the owner touching a terminal.

It writes `infra/secrets/amul-session.json` holding **only**: the session cookies, `user_id`,
and the timestamp. Confirm the path is ignored *before* writing:
`git check-ignore -q infra/secrets/amul-session.json`. Print a **redacted** summary only —
cookie names and value lengths, never values, and never the phone number.

Reject an OTP that is not exactly 6 digits before sending it anywhere.

`assist.example.json` (copied to `assist.json`, gitignored):

```json
{
  "enabled": false,
  "phone": "",
  "otp_source": "telegram",
  "relogin_after_days": 6,
  "allowlist": ["HPMCP01_08"],
  "max_price_inr": 900,
  "max_carts_per_day": 3,
  "approval_timeout_seconds": 240,
  "address_id": ""
}
```

`phone` is the 10-digit number, no country code — `amul_login.py` adds the `+91` prefix for
the `username` field itself.

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

### Step 3: Add to cart

In `amul_cart.py`, build an authenticated client that loads the cookies from
`infra/secrets/amul-session.json` into the same curl cookie jar `amul_api.py` already uses,
then:

1. **Re-fetch the product authenticated.** Run 208's product query again on *this* session,
   with `fields[seller]=1` and `fields[linked_product_id]=1` added, and pick the row whose
   `sku` matches. Do **not** reuse the watcher's anonymous product dict — see the
   `seller_id` trap in Current state. If the SKU is missing from the authenticated fetch, or
   is no longer available, abort and tell the owner "sold out before I could add it".
2. `PUT /entity/ms.carts/_/getUserCart` with `{"data":{"_id":null,"user_id":<user_id>}}` to
   discover the cart id.
3. `PUT /entity/ms.carts/<cart_id>/_/addItem?q=<qparam>` with the body from the Current-state
   table, `quantity` hardcoded to `1`.

Treat HTTP 401 or a body containing `AMUL_SESSION_UNAUTHENTICATED` as session death: message
the owner to re-login and stop. No retry loop.

**Verify**: `python3 -m py_compile apps/amul-watch/amul_cart.py` → exit 0

### Step 4: Set address and hand off the checkout link

1. `GET /api/1/entity/ms.user_addresses?q=<quote of {"user_id": user_id}>`.
2. Select the record whose `_id` equals `assist.json`'s `address_id`. If `address_id` is
   empty and exactly one address exists, use it and log which one. If it is empty and
   several exist, **abort** and message the owner with the available ids — never guess an
   address.
3. `PUT /entity/ms.carts/<cart_id>/_/updateAddresses?q=<qparam>` sending that object verbatim
   as **both** `shipping_address` and `billing_address`.
4. Reply on Telegram: the product name, price, and the link
   `https://shop.amul.com/en/checkout`, with a line stating plainly that payment has **not**
   been made and the cart will not be ordered by the bot.

Never write the fetched address object to disk or into a log line.

**Verify**: `grep -c 'en/checkout' apps/amul-watch/amul_cart.py` → `1` or more

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
12. A 401 / `AMUL_SESSION_UNAUTHENTICATED` sends a "session expired, reply with a fresh OTP"
    message and does **not** retry.
16. **Alerts survive a dead session.** With `amul-session.json` absent and `enabled: true`,
    a restock edge still produces exactly one restock alert, and the cart button is replaced
    rather than the alert suppressed. Fail message **must be exactly**:
    `FAIL: alert must survive a dead session`
17. A session older than `relogin_after_days` triggers the re-login prompt on a tick with
    **no** restock edge, and does not trigger it when the session is younger.
18. `get_otp` is selected by `otp_source`; an unknown value fails closed rather than
    defaulting to a live prompt.
14. An OTP that is not exactly 6 digits is rejected before any request is sent.
15. `amul_login.py` never prints a cookie value or the phone number, even at its most
    verbose. Fail message must mention `redact`.
13. 208's gate still passes unchanged.

## Done criteria

- [ ] `bash apps/amul-watch/test-amul-assist.sh` exits 0 and prints `ALL TESTS PASSED`
- [ ] `bash apps/amul-watch/test-amul-watch.sh` still exits 0
- [ ] The Step 6 mutation fails the gate with `FAIL: must not touch cart without approval`
- [ ] `grep -rniE '(place.?order|processPayment|razorpay|payment)' apps/amul-watch/*.py` returns nothing
- [ ] `python3 apps/amul-watch/watch.py --once --assist --dry-run` issues zero POSTs and writes no state
- [ ] `git status --porcelain` shows no `assist.json`, `carts.json`, `amul-session.json`, `.lock`, or `*.har`
- [ ] `grep -rn 'password' apps/amul-watch/` returns nothing
- [ ] README documents the re-login procedure for when the session expires
- [ ] `grep -rn 'har\|HAR' apps/amul-watch/*.py` returns nothing — the HAR route is dead and
      must not reappear
- [ ] Running with `--assist` absent behaves exactly as 208 did (a diff of notification
      behaviour shows no change)
- [ ] With no session file at all, `--assist` still emits the restock alert — the gate's
      `FAIL: alert must survive a dead session` assertion covers this

## STOP conditions

- **Any request to a payment or order-placement endpoint**, in code or in a test fixture.
  This plan's entire justification is that it stops at the cart.
- **Any cart mutation reached without a recorded approval** during development. Stop and
  report; the safety property is broken.
- **A cookie, phone number, address, or session value written anywhere inside the repo**,
  including fixtures and log lines. Fixtures use synthetic values only.
- **Any reintroduction of a HAR-import path.** Chrome strips cookies from saved HARs, so it
  cannot work; `amul_login.py` is the only session mechanism.
- **`getUserCart` returns no cart, or `addItem` succeeds but the cart stays empty** — i.e.
  the cart turns out not to be server-side after all. Stop and report; the fallback is a deep
  link to the product page, which is still a win but is a different plan.
- **More than one saved address exists and `address_id` is unset.** Never guess an address.
- **Gate integrity**: weakening, skipping, or deleting any assertion is a STOP. Fix the code.
- Any retry loop around a 401. Session death is a human event.
- Any change that makes 208's watcher depend on this module. The notifier must keep working
  with the assist code entirely absent.
- Any modification to `tooling/cli/notify/*`.

## Maintenance notes

- Session lifetime is the operational cost. If re-login turns out to be needed weekly, the
  honest verdict may be that the notifier alone is the product — record either outcome in
  `decisions.md`.
- The `getUpdates` approach conflicts with any *other* consumer of the same bot token: two
  pollers steal each other's updates. `notify` only ever *sends*, so today there is no
  conflict — but if a second polling consumer is ever added to this bot, this design breaks
  and needs a dedicated bot token. Note this in CLAUDE.md.
- Amul's cart flow will change without notice; the captured request shapes are a snapshot.
  The README's re-login procedure is the maintenance path, not a rewrite.
- A reviewer should scrutinise exactly two things: that `prepare_cart` still returns early on
  `not approved`, and that no payment endpoint has crept in. Everything else is replaceable.
