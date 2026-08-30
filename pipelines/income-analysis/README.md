# Income Analysis

One place to track income across all my platforms, plus the tools that pull the numbers automatically so I (or Claude) can check earnings without logging into each dashboard.

The plan: every income source gets its own CLI or MCP that reads its data, and this folder is where I keep notes on what's wired up, what each tool can pull, and what's still manual. Actual numbers from each pull go under `snapshots/`.

## What's wired up

### PayPal (Business)

- Account: PayPal Business, multi-currency (I get paid in both INR and USD).
- Tool: `paypal-txns-pp-cli`. Built with Printing Press from PayPal's official Transaction Search spec. The CLI lives in `~/printing-press/library/paypal-txns/` and the binary is on PATH at `~/go/bin/paypal-txns-pp-cli`. That folder is not a git repo, so the source is mirrored into this one at `../../tooling/press-clis/paypal-txns/`. Claude skill: `pp-paypal-txns`, source in `pipelines/.claude/skills/pp-paypal-txns/`, symlinked into `.claude/skills/`. It is repo-scoped on purpose, so it loads in personal-stuff sessions and never in a work repo. Its "Output contract" section is what keeps the month-by-program shape from drifting — read that before changing how income is reported.
- Reads: money received grouped by month and then by program/payer, net of PayPal fees, with the INR that actually settled into the bank per program (`income`); the full transaction list (`history`); and account balances. It handles PayPal's 31-day-per-call limit and pagination on its own, so a range like `--since 5mo` just works.
- Multi-currency gotcha: each USD payout also shows up as an INR conversion credit and an INR bank withdrawal. Those are the same money moving, not new income. `income` counts only the incoming payments (PayPal event-code family T00xx) and attributes the conversion/withdrawal legs back to the programs that funded them (oldest first, split pro-rata). A blank bank amount means that money is still sitting in PayPal.
- How to query: source the creds and run, e.g. `paypal-txns-pp-cli income --since 5mo`. Or just ask Claude.
- Output format gotcha: the month-by-program table only prints when stdout is a real terminal. Pipe it, redirect it, or let Claude run it, and you get JSON instead. Pass `--table` to force the table anyway. `--json` still wins if both are given.
- Notes: read-only reporting. OAuth2 client credentials, so it needs a Live app at developer.paypal.com with the Transaction Search feature switched on, otherwise the token comes back without the reporting scope and every call 403s. Creds sit in `~/.config/paypal-txns-pp-cli/creds.env` (chmod 600, outside any repo); I can rotate the secret from the PayPal dashboard anytime. Only the last 3 years are searchable, and a new transaction takes up to 3 hours to show up.

### impact.com (affiliate)

- Account: Agrollo (media-partner 4809503), currency INR.
- Tool: `impact-pp-cli` plus the `pp-impact` Claude skill. Built with Printing Press. The CLI lives in `~/printing-press/library/impact/` (binary at `~/go/bin/impact-pp-cli`); the skill is `pp-impact`, source in `pipelines/.claude/skills/pp-impact/`, symlinked into `.claude/skills/`. Repo-scoped on purpose, so it loads in personal-stuff sessions and never in a work repo. Its "Output contract" section pins the month-then-program shape and explains why the per-month loop is unavoidable — read it before changing how income is reported.
- Reads: earnings by program/software, earnings by day or month, programs I've joined, per-conversion commissions, invoices (payouts), and contracts.
- How to query: in Claude, just ask ("my impact.com income by program last month") and the pp-impact skill handles it. By hand: source the creds and run the CLI.
- Notes: local-only. The account id is baked into the URL so it can't be published. The token sits in `personal-stuff/infra/secrets/impact.env` (gitignored) and I can revoke it from impact.com settings anytime. Read-only reporting.

### Affiliate mailboxes (the source that names the tool)

- Mailboxes: `khushibakliwal` and `kushalbakliwal` at `agrolloo.com`. Hostinger mail,
  not Gmail, so `pp-gmail` cannot see them — the reader is plain `imaplib`.
- Tool: `mailbox.py` in this folder. `ingest.py` calls it on every online run and
  caches to `data/networks/mailbox.json`, so `--offline` keeps the leads.
- Why it earns its place: the bank says *how much* arrived, every API knows only its
  own programs, and the mail is the only thing that sees **all** of them — including
  programs with no API at all (Rewardful, Tolt, FirstPromoter, Book Bolt's notifier).
- Credentials: `infra/secrets/hostinger-mail.env` (gitignored, chmod 600), an escrow
  copy of the VPS gmail-digest `.env`. Rotate in Hostinger webmail and update both.
- **What it is allowed to do:** supply *leads* on untraced rows, never an
  attribution. The one exception is a payout mail stating an exact rupee figure that
  equals the bank credit to the paisa. impact.com is the only sender that states
  rupees, so it is the only one that can settle a row from mail alone.
- **Accruals are not income.** "You earned $4.80" is money promised, not money
  received — Lovable and EverBee have been accruing since Feb 2026 behind a blocked
  Tipalti verification. `mailbox.py` marks these `accrual` and they never become
  leads.
- Adding a program: write a strict parser in `mailbox.py` (match the sender **and** a
  distinctive phrase) and add it to `PARSERS`. A parser that fires on marketing mail
  is worse than none — `outreach.impact.com` sends "earn up to $150" from the same
  domain as the real payment notice.

### Bank passbook (the half that cannot be automated)

- Account: the owner's mother's PNB account. PayPal settles here by NEFT, and some
  affiliate networks pay it directly, so the passbook is the only complete view of
  income actually received.
- Tool: `ingest.py` in this folder, driven by the `yt-income` skill. It reads
  password-protected PNB PDF statements with `pypdf` (no poppler, so it works on
  Windows too), classifies every credit using `rules.json`, and writes
  `summary.json`.
- Trigger: manual. The owner exports a statement from PNB ONE and says
  "here's the passbook". There is no API and no schedule.
- The PDF password is the account number. It lives in the gitignored
  `data/config.json`, or `$PASSBOOK_PASSWORD`.

```bash
cp ~/Downloads/PNBONE_STMT_*.pdf data/raw/
python3 ingest.py --with-paypal
```

## Privacy — read before touching data/

**This repo is public.** A passbook carries the account number, the address,
family names and UPI handles.

- `data/` is gitignored in full (`data/.gitignore` allows only itself). Raw PDFs
  and per-transaction JSON never leave the machine.
- `summary.json` **is** committed. It holds only month totals per rail plus PayPal
  program names — no counterparties, no account numbers. Anything added to it has
  to clear that same bar.

## What counts as income

`rules.json` decides. Patterns are case-insensitive substrings of a transaction's
remarks; first match wins.

- **Income rails** — `paypal` (NEFT from Citi, `PAYPAL PAYMENTS`) and `airwallex`
  (IMPS, `AIRWALLE`).
- **Not income, but tracked** — `self_transfer` (the owner topping up his mother's
  account) and `interest`.
- **Everything else** falls through to `personal` and is excluded. That is the safe
  default, but it hides a new payout rail, so `yt-income` step 4 lists the large
  unclassified credits every run.

Reconciliation is the trust check: bank NEFT credits from PayPal must equal what
`paypal-txns-pp-cli` says it settled. For 1 Jan – 30 Aug 2026 the difference is
**INR 0.00**.

**Open question:** the `airwallex` rail is real but unattributed. impact.com
earnings over Jan–Aug 2026 were ~INR 29,017 against ~INR 88,347 of Airwallex
credits, so it is not (only) impact.com.

## The dashboard

The numbers surface as the **Income** tab of `yt-analytics.agrolloo.com`
(`apps/analytics-app`), behind the app's existing password.
`apps/analytics-app/scripts/sync-income.mjs` copies `summary.json` into the Worker
bundle as part of `npm run build`, so a deploy cannot ship stale figures.

Two views of the same money, and they are not interchangeable:

- **Landed** — by the date money hit the bank. Complete; includes Airwallex.
- **PayPal earned** — by the month a program paid. PayPal only.

Same PayPal total, different months.

## Snapshots

Dated pulls live in `snapshots/`. Most recent: [2026-06-20](snapshots/2026-06-20.md).

## To add

**The second passbook.** impact.com settles into a different bank account (owner-confirmed 2026-08-30), so its income sits outside this tally entirely. Getting that statement is the single biggest gap here.

More sources over time: other affiliate networks, payment platforms, marketplaces. Each one as a CLI or MCP so the whole picture is one quick query instead of a dashboard crawl. Gumroad and Skool already have CLIs (`gumroad-pp-cli`, `skool-pp-cli`); wire them in here when they're worth tracking.

## Why this exists

So "how much did I make everywhere last month" is one question to Claude, not ten logins.
