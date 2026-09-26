# pp-flipkart

Your own Flipkart order history, with every item, read-only. Flipkart sends no order
emails and has no public API, so this reads the same JSON the "My Orders" page loads,
through a login you make once.

## Commands

```
./pp-flipkart login                         # a browser window opens; log in with phone + OTP
./pp-flipkart orders --since 2026-09-01 --table
./pp-flipkart orders --since 2025-04-01 --out orders.json
./pp-flipkart status                        # is the saved login still good?
```

`orders` prints JSON by default: `id`, `time` (IST), `kind` (`minutes` for Flipkart
Minutes), `amount`, `pay` (payment modes), and `items` (`title`, `size`, `qty`, `price`,
`status`). Repeated units of one product are merged into one line.

The first run installs `playwright-core` into `node_modules/` (gitignored).

## How it works, and its traps

- **Browser:** Playwright's own Chromium, never your Chrome. A work Mac's managed Chrome
  refuses custom profiles ("Can't use this profile"). Override with `PP_FLIPKART_CHROME`.
- **Login:** kept in `~/.pp-flipkart/chromium` (the profile) plus `~/.pp-flipkart/login.json`
  (mode 600). Flipkart's login lives partly in session cookies that die when the browser
  closes, so `login` saves them and every run puts them back.
- **Headless:** the user agent is rewritten from `HeadlessChrome` to `Chrome`; without that
  Flipkart treats the run as logged out.
- **Paging:** `api/5/self-serve/orders/` returns about 7 orders a page and `nextCallParams`
  (`st`, `ot`) for the next one. Later pages are fetched from inside the page, with the
  headers the site itself sent.
- **Breaks when Flipkart changes the site.** `parse.mjs` throws on an unknown response
  shape rather than returning nothing.

## Used by

`pipelines/personal-finance` sync (`python3 -m ledger.run`) calls `orders --since` and
merges into `data/inbox/flipkart/orders.json`, then puts each order's items on the payment
row it matches. A lapsed login only skips that step.

Tests: `npm test` (synthetic fixtures, no real orders).
