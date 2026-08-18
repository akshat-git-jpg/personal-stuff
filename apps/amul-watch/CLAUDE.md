# Instructions for Claude

- **Bracket Rule**: The product URL must contain literal `[` and `]` characters. They must not be percent-encoded (`%5B` or `%5D`), otherwise the StoreHippo backend returns incorrect inventory.
- **Edge-Trigger Rule**: Notifications only fire on state transitions (when a SKU flips from out-of-stock to in-stock). A first run (empty state), added SKUs, or wiped state files default to being treated as already in-stock to prevent backlog notification spam.
- **TID Header**: The `tid` header must be recomputed using the specific SHA256 algorithm for **every single request** that needs it. Do not cache or reuse the output string across multiple requests.
- **The cart is opt-in, not the default.** `watch.py --assist` (plan 209) adds photo alerts with **Add to cart** / **Ignore** buttons for SKUs on `assist.json`'s `allowlist`. Without `--assist`, behaviour is identical to plan 208's plain-text watcher — do not let that change.
- **The approval gate is the whole safety property.** `amul_cart.prepare_cart()` must return early on `if not approved:` before any other check. Never weaken, bypass, or reorder that check. No code anywhere in this directory may call a checkout-finalizing or order-placing endpoint — see the README's "What this deliberately does not do" section.
- **No stored account credential.** Amul login is phone + OTP only; there is nothing account-secret-shaped to store, ever — see `decisions.md`.
- **No HAR import.** Chrome strips cookies from saved HARs, so a session can never be lifted from one. `amul_login.py` is the only session mechanism — do not reintroduce a HAR-based path.
- **One bot, one poller.** `telegram.py`'s `getUpdates` polling assumes it is the only consumer of this bot token — a second poller would steal its updates. If a second polling consumer is ever added to this bot, give it a dedicated token instead of sharing this one.
