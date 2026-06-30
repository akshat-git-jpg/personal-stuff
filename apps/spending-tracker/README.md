# spending-tracker (design notes, not built yet)

Goal: one place that shows what I spend each day, split into categories like food and
travel, pulling automatically from my credit cards and UPI instead of me logging every
payment by hand.

This file is the feasibility + design discussion so far. Nothing is built. There are two
open decisions at the bottom before the build plan gets written.

## Is it doable?

Yes, with one constraint worth stating plainly: in India there is no official consumer API
to pull your own transactions out of GPay / PhonePe / Paytm / a credit card. Nothing like
Plaid. So the data has to come from the alerts the banks already send you, by two channels:

- transaction **emails** the bank/card sends
- transaction **SMS** the bank sends on every debit

Account Aggregator (the RBI framework) is the clean official route but needs a licensed
financial entity, so it is out for a personal project.

## What the data sources actually cover

These numbers are from a real check of the inbox `kushalbakliwal25@gmail.com` on 2026-06-30,
not assumptions.

### Email covers cards well, and HDFC UPI too

Last 30 days: ~61 transaction alert emails, roughly 2 a day.

| Source | Email sender | Captures |
|---|---|---|
| ICICI credit card | `credit_cards@icici.bank.in` | every card txn |
| HDFC Bank | `HDFC Bank InstaAlerts` | card txns **and UPI txns**, plus refunds |
| SBI Card | `SBI Card Transaction Alert` | every card txn |

So credit-card spend is fully covered by email with zero effort, and HDFC's UPI is too.

### Email misses some UPI. The Rapido test proved it

I paid Rapido Rs 60 on the morning of 2026-06-30. There was no email for it. The only bank
emails that day were a Jio recharge and a declined Google Play subscription. The last
"Payment successful for Rapido" emails are from 2023 to March 2024, which were old Google Pay
receipts that Google Pay stopped sending.

HDFC does email its own UPI txns, so since this one did not email, it was paid from a
different rail (another bank's UPI, UPI-Lite, or a wallet) that only sends an SMS. Every one
of those debits still hits the phone as an SMS, because banks text every debit by RBI norm.

Conclusion: **email = cards + HDFC UPI, automatic. The blind spot is UPI from non-emailing
banks/wallets. SMS is the only source that catches 100%.**

## Capturing SMS on an iPhone

The phone is an iPhone, which rules out the easy paths. No iOS app can read or auto-forward
SMS in the background. Apple blocks it. SMS-forwarder apps, Tasker-style automations, and
"forward SMS to email" tricks all need Android.

The one path that works on iPhone uses the Mac:

1. iPhone: Settings > Messages > Text Message Forwarding > turn on the Mac. Every SMS now also
   lands in Messages on the Mac.
2. Messages stores everything in a local SQLite db at `~/Library/Messages/chat.db`.
3. A cron on the Mac reads that db, filters to bank senders only, parses the transaction, and
   pushes it to the same store as the email pipeline.

Verified on this Mac: `chat.db` exists (468 KB, updated 2026-06-29). Terminal needs Full Disk
Access granted once to read it (System Settings > Privacy & Security > Full Disk Access).

An iPad cannot do this. It receives the SMS fine, but iPadOS is sandboxed, so there is no way
to run a cron or reach the Messages db. A Mac is required as the host.

### Does the Mac need to be awake all the time? No

If "Messages in iCloud" is on (iPhone and Mac), every SMS is stored in iCloud. An SMS that
arrives at 9am while the Mac is asleep syncs down when the Mac is opened at 6pm and gets
captured then. Nothing is lost, just delayed. So the Mac only needs to be opened sometime
during the day, not running 24/7. The dashboard would show "SMS synced as of <last Mac wake>"
so the freshness is visible.

The only real loss case is the Mac staying off for weeks, and even that usually backfills from
iCloud on the next boot.

### How the sync is keyed: Apple ID, not inbox

Mac and iPhone sync because both are signed into iMessage with the **same Apple ID** (the
account, which happens to be an email). If the Mac and iPhone use different Apple IDs, none of
this syncs. Fix is to sign the Mac's Messages app into the iPhone's Apple ID (Messages only,
not the whole Mac login). Needs confirming before build.

## Proposed architecture

Two feeders, one pipeline.

```
EMAIL feeder (VPS cron)          SMS feeder (Mac cron)
 gmail CLI: ICICI/HDFC/SBI        read chat.db: bank-sender SMS
 transaction alerts                (Rapido-type UPI, all banks)
        \                                /
         → normalize → dedup → categorize → STORE → dashboard PWA
```

1. **Email feeder** runs on the VPS cron (~every 15 min), uses the existing `gmail` CLI to
   pull new alerts from the ICICI/HDFC/SBI senders, parses amount, merchant, card.
2. **SMS feeder** runs on the Mac (launchd), reads new bank-sender rows from `chat.db`, parses
   them, catches the UPI that email misses.
3. **Normalize** turns every txn into one shape: `{date, amount, debit/credit, merchant,
   source (which card/bank), category}`.
4. **Dedup** collapses the same HDFC UPI txn arriving by both email and SMS, by amount + time +
   merchant window.
5. **Categorize** uses a merchant-to-category rules table (swiggy/zomato -> Food,
   rapido/uber/irctc -> Travel, netflix/spotify -> Subscriptions). Unknowns go to
   Uncategorized. Re-tag a merchant once and it is remembered.
6. **Store + view** is a mobile dashboard PWA on the usual Vite + React + Hono + Cloudflare
   Worker stack, showing spend per day, per category, and per merchant, with date filters.

A note on the "which app" question (GPay vs PhonePe vs card): the bank/card a txn came from is
reliable. Which UPI app initiated it is not always recoverable from the alert text.

## One-time setup the user does (iPhone path)

- Turn on Text Message Forwarding to the Mac.
- Turn on Messages in iCloud on iPhone and Mac.
- Confirm Mac Messages and iPhone are on the same Apple ID.
- Grant Terminal (or the cron runner) Full Disk Access once.

After that the SMS side runs with no daily effort.

## Open decisions before the build plan

1. **Storage/view.**
   - A) Cloudflare D1 + dashboard PWA (like `analytics-app`): snappy queries, charts, edit
     categories in-app. Best for daily tracking.
   - B) Google Sheet + dashboard PWA (like `gym-app`): hand-edit categories in the sheet,
     dashboard reads it. More tinkerable, slightly less snappy.
2. **Same Apple ID** on Mac and iPhone confirmed, or willing to sign Mac's Messages into the
   iPhone's Apple ID.

## Prior art to reuse

- `tooling/cli/gmail` (`pp-gmail`): already reads this Gmail account. The email feeder is built
  on this.
- A `bank-statement-parser` existed and was moved to the TY repo. Worth checking for reusable
  parsing logic.
- `apps/analytics-app` and `apps/gym-app`: the dashboard PWA pattern (D1 vs Sheet backends).
