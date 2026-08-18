# Instructions for Claude

- **Bracket Rule**: The product URL must contain literal `[` and `]` characters. They must not be percent-encoded (`%5B` or `%5D`), otherwise the StoreHippo backend returns incorrect inventory.
- **Edge-Trigger Rule**: Notifications only fire on state transitions (when a SKU flips from out-of-stock to in-stock). A first run (empty state), added SKUs, or wiped state files default to being treated as already in-stock to prevent backlog notification spam.
- **TID Header**: The `tid` header must be recomputed using the specific SHA256 algorithm for **every single request** that needs it. Do not cache or reuse the output string across multiple requests.
- **Out of Scope Boundary**: Any code related to cart checkout, OTP, login, credentials storage, or placing orders **does not belong in this directory**. That is strictly reserved for plan 209. Do not leak order automation into this watcher.
