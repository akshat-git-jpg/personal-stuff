# yt-income: the mailboxes

Every affiliate program emails the owner when it accrues a commission and when it
pays one out. Those mails name the tool, the amount and the date, which the bank
statement does not. **Read them before guessing at anything.** What a mail may and
may not prove is in [attribution.md](attribution.md#what-the-mail-may-do).

## Access

Already wired; no new credential needed. The two Hostinger mailboxes on the
agrolloo.com domain are IMAP, not Gmail, so `pp-gmail` cannot see them. The daily
Telegram digest already reads them:

- Config: `apps/telegram-email-assistant/imap-accounts.json` (committed, no secrets)
- Passwords: `IMAP_PASS_KHUSHIBAKLIWAL` / `IMAP_PASS_KUSHALBAKLIWAL` in
  `/srv/crons/gmail-digest/.env` **on the VPS**, escrowed locally at
  `infra/secrets/hostinger-mail.env` (gitignored, chmod 600)
- Reader: `apps/telegram-email-assistant/fetch-imap.py` (stdlib `imaplib`)

Rotate in Hostinger webmail and update **both** the local file and the VPS `.env`.

## How the run uses it

You do not run it by hand. `ingest.py` calls `mailbox.fetch_events()` on every
online run, caches to `data/networks/mailbox.json` so `--offline` keeps the leads,
and hands the events to `attribute.attribute(mail_events=...)`. Stdlib `imaplib`, no
SSH, no extra install, so it works on either operator's machine.

For an ad-hoc scan that must keep the passwords on the VPS (host and key in
`INFRA.md`):

```bash
scp -i ~/.ssh/hostinger_vps scan.py root@<vps-host>:/tmp/
ssh -i ~/.ssh/hostinger_vps root@<vps-host> \
  'set -a; . /srv/crons/gmail-digest/.env; set +a; python3 /tmp/scan.py'
```

## IMAP gotchas

- Hostinger's `LIST` reply quotes the *delimiter*, not the mailbox name
  (`(\HasChildren) "." INBOX.Sent`). Split on the last quote and take what follows;
  a parser that grabs the quoted field selects `.` and silently returns zero mail.
- The folders are `INBOX`, `INBOX.Sent`, `INBOX.Junk`, `INBOX.Drafts`,
  `INBOX.Trash`. Real payout notices do land in Junk, so scan it.

## Adding a program

Write a parser in `mailbox.py` that returns `(kind, tool, amount, currency)` or
`None`, and add it to `PARSERS`. Keep it strict: match the sender **and** a
distinctive phrase. A parser that fires on marketing mail is worse than no parser,
because everything downstream trusts it. `outreach.impact.com` sends "earn up to
$150" mail from the same domain as the real payment notice, which is why
`_p_impact` also requires the exact subject.

Programs seen in the mail but not yet wired: Rewardful, Tipalti, Tolt (OpenArt,
Glitching), FirstPromoter (JoggAI), UpPromote, Partnerize, Book Bolt's own notifier.
