# amul-watch

Self-hosted Amul stock notifier that alerts via Telegram when protein products come back in stock.

## API Flow
The application fetches stock data using a 6-step flow against the StoreHippo Amul frontend:
1. Initialize session with a GET request to seed cookies.
2. Fetch the session info JSON to extract the `tid` hash.
3. Map the given pincode to the correct regional substore using the `tid`.
4. Bind the session to that substore's inventory.
5. Retrieve the current storefront API version from `storeinfo.js`.
6. Query the products API using the resolved `tid`, version, and literal brackets in the URL query string.

## Setup
1. Copy the configuration template:
   `cp config.example.json config.json`
2. Edit `config.json` to include your target `pincode` and track SKUs.
3. Ensure `infra/secrets` contains the telegram environment config, as it is required by the underlying `notify` CLI tool.

## Manual Run
To perform a single read-only manual run:
```bash
python3 watch.py --once --dry-run --pincode <YOUR_PINCODE>
```

## VPS Cron Wiring
The script is designed for a Pattern-B VPS cron orchestration, running once every five minutes. Add this exact line to the crontab:
```
*/5 * * * * /srv/projects/personal-stuff/apps/amul-watch/run.sh >> /var/log/amul-watch.log 2>&1
```

**Rate Limiting**: Do not lower the cron poll interval below 5 minutes. The script employs a random pre-poll jitter to spread out load.

## Approve-to-cart assist (plan 209)

An opt-in add-on to the plain-text watcher above: a restock alert for an
allowlisted SKU carries the product photo, price, and two Telegram buttons —
**Add to cart** / **Ignore**. Tapping **Add to cart** adds the item to your
real Amul cart and applies your saved address, then replies with a checkout
link. **The bot never pays and never places the order** — it stops at a
filled cart; you open the link and check out yourself. See
`decisions.md` for why this stops there.

### One-time setup

1. Copy the assist config template:
   ```bash
   cp assist.example.json assist.json
   ```
2. Edit `assist.json`: your 10-digit phone (no country code), the SKUs you
   want cart buttons for (`allowlist` — deliberately separate from
   `config.json`'s `track` list), a price cap, a daily cart cap, and your
   saved address's id (`address_id`; leave blank only if you have exactly
   one saved address).
3. `enabled` defaults to `false`. Set it to `true` only once you're ready —
   a missing or broken `assist.json` fails closed either way.
4. Log in once:
   ```bash
   python3 amul_login.py
   ```
   This sends an OTP by SMS to your phone and prompts you for it on the
   terminal. It writes `infra/secrets/amul-session.json` (gitignored) and
   prints a redacted summary — cookie names and lengths only, never a
   value, never your phone number.
5. Run `watch.py --once --assist --dry-run` to confirm nothing is sent or
   written, then drop `--assist` into your cron line (`run.sh` already
   passes `--once`; add `--assist` there once you're ready to go live).

### When the session expires — re-login

The login cookie is good for 7 days and does **not** renew just from being
used. Two things keep this from ever costing you a restock alert:

- If the session is missing or unusable when a restock fires, you still
  get the normal alert — the cart button is just replaced with a note that
  the session needs a fresh OTP, sent as a **separate** message so the
  alert itself stays readable.
- Once the session passes `relogin_after_days` (default 6, one day of
  margin), the very next quiet tick (no restock firing) proactively renews
  it: it messages you on Telegram asking for a fresh OTP, and completes the
  renewal once you reply — no terminal required.

You can also renew manually at any time:
```bash
python3 amul_login.py --via-telegram   # prompts for the OTP over Telegram
python3 amul_login.py                  # or, at a terminal, prompts on stdin
```

### What this deliberately does not do

- It never reaches a checkout-finalizing or order-placing request. Holding
  the request shape (captured, then deliberately unused) is not permission
  to call it — see `decisions.md`.
- It never stores a card, a saved billing method, or any account secret.
  Amul login is phone + OTP only.
- It never imports a session from an exported browser capture. Chrome
  strips cookies from saved HAR files, so that route cannot work even in
  principle — `amul_login.py` is the only session mechanism.
- It never runs a long-lived bot daemon or opens a port. The Telegram
  approval wait is a short foreground poll inside one cron tick.
