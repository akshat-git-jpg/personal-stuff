# cf-email — scalable per-niche email routing

Set up Cloudflare Email Routing (catch-all → one hub inbox) for any niche domain in **one command**.
Used by the Pinterest digital-products business so every new brand gets `hello@<brand>.com`
forwarding into the shared hub `jessicap123k@gmail.com` with no manual dashboard clicking.

## One-time setup
1. Create a scoped Cloudflare API token (My Profile → API Tokens → Create → Custom):
   - **Account → Email Routing Addresses → Edit**
   - **Zone → Email Routing Rules → Edit**
   - **Zone → DNS → Edit**
   - **Zone → Zone → Read**
   - Account Resources: your account · Zone Resources: **All zones**
2. `export CLOUDFLARE_API_TOKEN="..."` in `~/.zshrc`, then `source ~/.zshrc`.
3. The first run adds the hub address → **click the verify link Cloudflare emails to the hub once**.
   Every domain after that reuses the verified hub with zero clicks.

## Usage
```bash
node setup-routing.mjs <domain> [hub-email]
# e.g.
node setup-routing.mjs bridebestie.com            # defaults to jessicap123k@gmail.com
node setup-routing.mjs theketokitchen.com hub@... # another niche, same or different hub
```

It: resolves the zone, enables Email Routing (adds MX+SPF), ensures the hub destination exists,
and sets the catch-all rule. Idempotent — safe to re-run.

## Auth modes
- **Scoped token** (`CF_API_TOKEN`, default): can do everything EXCEPT *enable* Email Routing —
  Cloudflare blocks the enable/settings endpoints for scoped tokens (returns 10000). So with a token
  you click "Enable Email Routing" once per domain in the dashboard; the CLI does the rest.
- **Global API Key** (`CF_GLOBAL_API_KEY` + `CF_API_EMAIL`): full account access → the CLI can also
  enable routing, so each niche is **one command, zero dashboard**. The CLI auto-prefers it when set.
  ⚠️ Full unrestricted account access in a file — keep TY/.env gitignored; roll the key if it leaks.

## What no credential can skip
Verifying the hub address requires clicking a link in that inbox (Cloudflare security) — but only
**once per hub**, not per domain. Since all niches share one hub, that's a one-time click ever.
