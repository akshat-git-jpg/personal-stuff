---
name: yt-income
description: "Refresh yt-income.agrolloo.com — the Revenue dashboard. Ingests a password-protected PNB passbook, pulls PayPal, impact.com and PartnerStack, ties every bank credit back to the tool that earned it, reports what it cannot trace, and redeploys. Trigger phrases: `yt-income`, `update my revenue`, `here's the passbook`, `new passbook`, `refresh the revenue dashboard`, `how much did I earn`, `revenue by tool`, `ingest passbook`."
author: "akshat-git-jpg"
license: "Apache-2.0"
argument-hint: "[path to passbook PDF] | status | reconcile"
allowed-tools: "Read Bash Edit Write Glob Grep"
---

# yt-income — refresh the Revenue dashboard

Turns a bank passbook plus the affiliate networks into the numbers behind
**yt-income.agrolloo.com**.

## The one idea everything follows

**The bank is the truth.** Network reports exist to *explain* bank credits, never
to add to them. So the output always satisfies:

    sum(tool amounts) + untraced == bank total, for every month

**Untraced money is normal, not a bug.** Roughly a fifth of income cannot currently
be tied to a tool. That gets reported loudly, in the terminal and on the dashboard,
and never hidden, rounded away, or guessed at. A wrong attribution silently corrupts
a source of truth; an honest gap does not.

## How money reaches the bank

```
Tool ──► PayPal ─────────────► Bank      HeyGen, Pictory, EverBee, TradingView…
Tool ──► PartnerStack ──► Airwallex ──► Bank   ElevenLabs, n8n, Jungle Scout
Tool ──► impact.com  ──► (another account)     Base44, InVideo, Kittl
Tool ──► PayKickstart ──► ???              NOT CONNECTED — shows as untraced
```

Bank is always the last hop. That is why bank credits anchor everything.

## Where things live

| Thing | Path |
|---|---|
| Passbook parser + orchestrator | `pipelines/income-analysis/ingest.py` |
| Network fetchers | `pipelines/income-analysis/sources.py` |
| Mail lead parsers | `pipelines/income-analysis/mailbox.py` |
| Attribution engine | `pipelines/income-analysis/attribute.py` |
| Tests | `pipelines/income-analysis/test_income.py` |
| Classification rules, aliases, manual attribution | `pipelines/income-analysis/rules.json` |
| Raw everything (**gitignored**) | `pipelines/income-analysis/data/` |
| Committed aggregates | `pipelines/income-analysis/summary.json` |
| Dashboard | `apps/yt-income/` → `yt-income.agrolloo.com` |

Open questions and the untraced-money lead: read data/OPEN-QUESTIONS.md if present (gitignored).

<EXTREMELY-IMPORTANT>
**This repo is PUBLIC** (`github.com/akshat-git-jpg/personal-stuff`).

The passbook carries the mother's account number, address, family names and UPI
handles. The PartnerStack payouts API also returns her **full street address and
account last-4**; `sources.strip_pii()` removes it before anything is written, and
`test_income.py` asserts that.

- `data/` is gitignored in full. Never `git add -f` anything under it.
- Never paste a transaction line, bank reference, account number or per-credit
  amount into a commit message, PR body, or any committed file (this skill included).
- Only `summary.json` is committed: month totals, tool names, routes. If you add a
  field to it, check it against that bar first. `apps/yt-income/scripts/sync-summary.mjs`
  refuses to bundle a summary matching any forbidden pattern.
</EXTREMELY-IMPORTANT>

## The run

Copy this checklist and tick it off:

```
- [ ] 0. Claim a workspace: cd "$(pp-work claim --kind code --slug yt-income)"
- [ ] 1. Passbook copied into data/raw/; data/ and secrets present
- [ ] 2. python3 ingest.py ran; preflight shows every source ok (or named)
- [ ] 3. Tally read: PayPal difference INR 0.00, untraced credits listed
- [ ] 4. Tests green; dashboard checked; deployed
- [ ] 5. Committed with nothing under data/ staged
```

If step 3 shows a regression or a non-zero PayPal difference, go back to step 2
after fixing the cause (see [troubleshooting](references/troubleshooting.md)).

### 1. Get the passbook

If the owner named a file, use it. Otherwise list recent PDFs/XLS in `~/Downloads`
and look for `PNBONE_STMT_*`. **Ask before ingesting anything you are unsure
about**: an SBI password-reset form has been mistaken for a passbook before.

Any date range, any format (PDF, or PNB's `.xls`, which is a locked `.xlsx` needing
`pip3 install msoffcrypto-tool openpyxl`), any overlap. Keep every earlier passbook
in `data/raw/`: each run rebuilds from all of them, so only ask for days **not**
covered yet.

```bash
cp "<passbook>" pipelines/income-analysis/data/raw/
```

- **Each day comes from exactly one passbook** (`merge_passbooks`): the one with
  more rows that day wins; ties go to the earlier file. Identical rows inside one
  file are real and kept.
- **Missing days are called out, never guessed** (`coverage_gaps`): `!! NO PASSBOOK
  for …`, `summary.json` → `coverage.gaps`, and a red banner on the dashboard. Ask
  the owner for exactly those days.

The password is the account number, kept in the gitignored `data/config.json`. If
missing, ask the owner; never guess, never commit it.

A fresh workspace has an empty `data/` and no secrets. Copy `data/` from the last
workspace that ran this skill, and symlink `impact.env`, `partnerstack.env` and
`hostinger-mail.env` from the main checkout's `infra/secrets/`.

### 2. Ingest, attribute and tally — one command

```bash
cd pipelines/income-analysis && python3 ingest.py      # --offline reuses data/networks/
```

**This skill owns the whole chain.** Do not invoke `pp-paypal-txns` or `pp-impact`
separately during a refresh: `ingest.py` drives both CLIs, PartnerStack, the per-tool
CLIs (`pp-tolt`, `pp-bookbolt`) and the mailboxes, then tallies against the passbook.
Those skills stay right for a standalone question like "what did PayPal pay me in June".

**Read the preflight.** A missing CLI or unset credential is otherwise invisible: its
money lands in Untraced. The run names it up front (`!! impact.com unavailable — money
from it will show as UNTRACED, not as zero`). Fix the source before trusting the split.

### 3. Read the tally — this is the point

Per month: bank total vs traced vs untraced, and **every untraced credit with its
date**. It exits non-zero **only** when PayPal and the bank disagree, which is a real
bug signal. Untraced money never blocks.

To name untraced money, or when an unfamiliar payer shows up, follow
[attribution.md](references/attribution.md). Mail evidence and the IMAP wiring:
[mailbox.md](references/mailbox.md).

### 4. Test, then publish

```bash
python3 pipelines/income-analysis/test_income.py    # must be green
cd apps/yt-income && npm run deploy                 # sync + typecheck + build + deploy
```

`npm run build` copies `summary.json` into the Worker bundle, so a deploy cannot ship
stale figures. The Worker holds no network credential, by design. To look first:

```bash
cd apps/yt-income
npx wrangler dev --port 8793 --local          # needs .dev.vars
node scripts/shoot.mjs http://localhost:8793 .shots/rev.png --month=2026-03
```

`shoot.mjs` exits non-zero on a page error, so a blank chart cannot pass.

### 5. Commit

Stageable: `summary.json`, `apps/yt-income/src/worker/summary.json`, any `rules.json`
change, and code. Run `git status --short` and confirm NOTHING under `data/` is
staged, then run `commit-now`.

## Reporting back

In this order, kept short; the owner reads this tired:

1. **Total revenue** for the window, month by month.
2. **The reconciliation number**: say "difference INR 0.00", never "it reconciles".
3. **What could not be traced**, with the share and the credit dates.
4. **Anything still in PayPal**, with its as-of time. Zero is good news; say it.
5. **Anything new**: an unmatched payer, a month with no income.

## Related

- [references/attribution.md](references/attribution.md): manual attribution, aliases, agency payers, what mail may prove.
- [references/mailbox.md](references/mailbox.md): IMAP access, wiring, gotchas, adding a parser.
- [references/troubleshooting.md](references/troubleshooting.md): when a number looks wrong.
- `pp-paypal-txns`, `pp-impact`, `pp-tolt`, `pp-bookbolt`: the CLIs this skill drives.
- `docs/superpowers/specs/2026-08-30-yt-income-revenue-design.md`: why it is built this way.
- `pipelines/income-analysis/README.md`: the wider income-source inventory.
- A future `personal-dashboard` will reuse `data/parsed/`, including debits and the
  `self_transfer` rail; keep the parsed output transaction-complete.
