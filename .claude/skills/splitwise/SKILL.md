---
name: splitwise
description: Splitwise through the pp-splitwise CLI (saved web login, no API key). List groups and expenses, add an equal split you paid, find payments not yet on Splitwise, delete an expense. Triggers on "add to splitwise", "split this", "put this on splitwise", "splitwise expenses", "what's on splitwise", "what's missing from splitwise", "flat expenses".
---

# Splitwise via pp-splitwise

```
CLI: tooling/cli/splitwise/pp-splitwise      (README: tooling/cli/splitwise/README.md)
```

## Commands

```bash
pp-splitwise me
pp-splitwise groups                                        # groups with member ids
pp-splitwise expenses --group Flat --since 2026-09-01
pp-splitwise add --group Flat --cost 746 --desc "Zepto" --date 2026-09-16        # dry run
pp-splitwise add --group Flat --cost 746 --desc "Zepto" --date 2026-09-16 --yes  # adds it
pp-splitwise add --group Flat --cost 300 --desc "Cook" --with Anusha --yes      # only some people
pp-splitwise missing --payments pays.json --group Flat     # [{date, amount, desc}]
pp-splitwise delete <expense-id> --yes
```

## Rules

- **Always dry-run first.** Show the owner the dry-run output; add `--yes` only after a yes in the same turn. Same for `delete`.
- `add` means the owner paid and the split is equal. Currency is INR.
- "Not logged in" = the owner runs `tooling/cli/splitwise/pp-splitwise login` (a browser window opens).
- Flat expenses usually come from the Kushal Money ledger: see the `my-income` skill.
