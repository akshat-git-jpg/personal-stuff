# pp-splitwise

Splitwise from the command line, through Splitwise's official API (v3.0). No browser, no
dependencies, Node 18+. Built to put flat expenses from the Kushal Money ledger on Splitwise.

## Log in once

1. Open https://secure.splitwise.com/apps and register an app (any name and URL).
2. Copy the **API key** shown on the app page.
3. `tooling/cli/splitwise/pp-splitwise login` and paste it.

The key is saved to `~/.pp-splitwise/key` (mode 600) and never committed.
`SPLITWISE_API_KEY` overrides it.

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
