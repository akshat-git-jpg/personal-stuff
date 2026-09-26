# pp-splitwise

Splitwise from the command line. Built to put flat expenses from the Kushal Money ledger
on Splitwise.

**Why a browser session, not an API key:** registering an app for an API key now needs
Splitwise Pro (paid). The Splitwise website itself calls the same `/api/v3.0/` endpoints
with its login cookie, so the CLI does that: it opens your saved login headless and makes
each call from inside the page (with the page's CSRF token). Same approach as
`tooling/cli/flipkart`. Uses Playwright's own Chromium (managed Chrome on a work Mac
refuses custom profiles).

## Log in once

```bash
tooling/cli/splitwise/pp-splitwise login
```

A browser window opens on the Splitwise login page. Log in (email and password is safest;
Google sign-in may refuse this browser). The window closes by itself once you are in.
The login is kept in `~/.pp-splitwise/chromium` and `~/.pp-splitwise/login.json` (mode 600),
never committed. If a call says "Not logged in", run `login` again.

## Commands

```bash
pp-splitwise me
pp-splitwise groups                                   # groups with member ids
pp-splitwise expenses --group Flat --since 2026-09-01
pp-splitwise add --group Flat --cost 746 --desc "Zepto groceries" --date 2026-09-16          # dry run
pp-splitwise add --group Flat --cost 746 --desc "Zepto groceries" --date 2026-09-16 --yes    # adds it
pp-splitwise add --group Flat --cost 300 --desc "Cook" --with Anusha --yes                   # only some people
pp-splitwise missing --payments pays.json --group Flat   # which payments are not on Splitwise yet
pp-splitwise delete 1234567 --yes
```

- `add` records that **you** paid and splits equally across the group (or you plus `--with`).
  Shares add up to the paisa. Without `--yes` it only prints what it would add.
- `missing` takes `[{date, amount, desc}]` and treats a payment as already on Splitwise
  when an expense in that group has the same cost (±₹1) within 3 days (`--days`). Each
  expense covers one payment.
- Splitwise returns validation errors with HTTP 200; the CLI turns them into a failure.

`npm test` runs the pure helpers in `lib.mjs`.
