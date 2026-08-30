# Plan 260: Close the second Hostinger account (web hosting)

> **STATUS: PARKED — 2026-08-30, owner's call.** The investigation is finished and three
> cleanup steps already shipped; only the migration itself is parked. Reason: the annual
> saving lands at **~₹4,300**, which the owner judged too small for the work and the
> deadline pressure. Nothing here is blocked or broken — the account can stay as it is
> indefinitely. **Read this file before re-opening the topic; everything below is
> already-verified fact, so nothing needs re-investigating, only re-pricing.**

## Read this first (context for a fresh session)

The owner has **two Hostinger logins**. He dislikes maintaining both and asked whether the
second could be closed. The answer is yes, but not for free, and the arithmetic is thin.

**A Hostinger API token only sees its own account.** A domain in the sibling account comes
back as *"Domain is not registered at Hostinger"*, which reads exactly like "you don't own
this". `pp-hostinger` takes `--account vps|web`; if a domain you know exists looks missing,
you are asking the wrong account.

```bash
pp-hostinger --account web api GET /api/domains/v1/portfolio       # domains + expiry
pp-hostinger --account web api GET /api/billing/v1/subscriptions   # what renews, when, price
pp-hostinger --account web api GET /api/billing/v1/payment-methods # the card/UPI on file
pp-hostinger --account web dns list agrolloo.com                   # Hostinger's INTENDED zone
```

That last one is the useful trick: it returns the zone Hostinger *wants*, even though DNS is
delegated to Cloudflare. It is how the DKIM targets were recovered without opening the panel.

**The Hostinger API has no email endpoints at all** (nine paths probed, all 404 — it covers
domains, VPS, hosting, DNS, billing). Mailbox questions genuinely require the panel or a
screenshot from the owner. Do not promise to look them up.

## What is in each account (verified 2026-08-30)

| Account | Contents | Cost/yr | Renews |
|---|---|---|---|
| **vps** (default) | KVM 2 VPS. Card: Visa, valid to 2032 | ₹16,788 | 2027-01-31 |
| **web** | Premium Web Hosting (`m_68705591`) | ₹5,388 | **10-27, yearly** |
| **web** | `.COM Domain` = `agrolloo.com` (`m_68705617`) | ₹1,516 | **10-14, yearly** |

`agrolloo.com` expires **2026-11-10**; auto-renew is **ON**; payment is UPI
`khushibakliwal125@okicici`, valid to 2028. Domain is `is_locked: true` (normal).

## Why the account cannot simply be closed

Two independent blockers. Solving one does not help with the other.

### Blocker 1 — the mailboxes die with the hosting  *(SETTLED, do not re-litigate)*

`@agrolloo.com` runs on **Free Business Email**, which is *not* what the ₹5,388 buys —
except that it is. Hostinger's own tooltip: *"Free email plans renew along with your hosting
plan."* Their support agent: *"cancelling the hosting plan will also delete the free email
accounts, **even if you keep paying for the domain**."*

An earlier inference said the opposite, reasoning from the email plan's expiry date matching
the *domain* date (2026-11-10) rather than the hosting date. **That inference was wrong.**
Email follows the HOSTING.

Two live mailboxes, both real and in use:

| Mailbox | Size | Role |
|---|---|---|
| `khushibakliwal@agrolloo.com` | 160 MB | primary |
| `kushalbakliwal@agrolloo.com` | 81 MB | secondary |
| `khushibakliwal251@agrolloo.com` | 232 KB | unused (0%) |

These are the addresses used to sign up to affiliate programmes, so they hold approval
mails, payout notices and password-reset paths. **Any migration must export them first —
that is the only irreversible step in the whole plan.**

A second plan on `@agrollo.com` (one fewer `o`) held three mailboxes on a domain that does
not exist (`whois` → No match), so none could receive anything. **Deleted by the owner
2026-08-30.** Do not go looking for it.

### Blocker 2 — the domain is registered in this account

`agrolloo.com` carries every app and the `go.agrolloo.com` affiliate money path. Closing the
account without transferring it loses all of that. **Email and domain are separate problems;
fixing email alone does not close the account.**

## Already done (do not redo)

| Done | What |
|---|---|
| 2026-08-30 | **The 5 WordPress-hop links were repointed.** `5MyF/filmora`, `L2Is/lumen5`, `SB2g/hostinger`, `f5g4/d-id`, `zhaY/mailchimp` now go straight to their vendors in both `CLICKS_KV` and `links`. **Rows depending on `agrolloo.com`: 5 → 0.** No YouTube edit was needed. The hosting no longer serves any link. |
| 2026-08-30 | **DKIM was fixed.** Both `hostingermail-a/b._domainkey` CNAMEs existed in Cloudflare but were `proxied: true`, so they answered with Cloudflare's proxy IPs instead of the signing key and DKIM failed on every message. Flipped to DNS-only; both now return `v=DKIM1`. Cost ₹0. |
| 2026-08-30 | The dead `@agrollo.com` email plan was deleted. |

**Still open from that work:** DMARC is `p=none`. Tighten to `p=quarantine` only after DKIM
has demonstrably passed in the wild for ~2 weeks. Also, all five repointed links still carry
**no affiliate code and earn ₹0** — `filmora` is the one worth fixing (approved on Impact).

## The migration, if it is ever resumed

### Why it was parked — the arithmetic

| | Now | After migration |
|---|---|---|
| VPS (Hostinger #1) | ₹16,788 | ₹16,788 |
| Web hosting (Hostinger #2) | ₹5,388 | — |
| Domain (Hostinger #2) | ₹1,516 | — |
| Email (new provider) | — | ~₹1,700 |
| Domain (Cloudflare Registrar, at-cost) | — | ~₹900 |
| **Total** | **₹23,692** | **~₹19,388** |

**Saving ≈ ₹4,300/yr**, and the vendor count stays at **three** either way (a registrar, a
mail host, a VPS host — three is the floor; "everything on the VPS" is not reachable). The
only real gain is that the duplicate Hostinger login disappears. The owner judged that not
worth the migration risk. **If you re-open this, re-price it first — these are 2026 numbers.**

### The email options, as researched 2026-08-30

Requirement: the owner **must be able to reply as `@agrolloo.com`**. That rules out
Cloudflare Email Routing, which forwards but cannot send.

| Option | ₹/yr | IMAP/SMTP | Reply as @agrolloo | Notes |
|---|---|---|---|---|
| Stay on Hostinger hosting | 5,388 | ✅ | ✅ | Keeps the second account alive. The status quo. |
| Hostinger Business Email ×2 | ~3,300 | ✅ | ✅ | Priced **per mailbox** (~$1.59/mo each at renewal). Still keeps the second account. |
| Zoho Mail **free** | 0 | ❌ | webmail only | **Free tier excludes IMAP/POP/ActiveSync.** No phone app. Rejected. |
| Zoho Mail Lite ×2 | ~2,000–3,000 | ✅ | ✅ | Bigger brand, Indian company. **Exact INR price was never confirmed** — their pricing page does not expose it. |
| **Migadu Micro** | **~1,700** | ✅ | ✅ | Swiss, self-funded. Webmail + full IMAP/SMTP/POP3 on every plan. Free trial, no card. Limits: 20 outgoing/day, 200 incoming/day, **5 GB shared across all mailboxes** (currently using 241 MB). |
| Cloudflare Email Routing | 0 | n/a | ❌ | **Rejected** — cannot send. |

Leading candidate was **Migadu Micro**.

### The domain, if resumed

Transfer `agrolloo.com` to **Cloudflare Registrar** — at-cost with no markup, and it lands
beside the DNS that already serves the zone. **A registrar transfer does not touch DNS, so
nothing goes down.** Needs: unlock the domain in hPanel, copy the EPP/auth code, paste it
into Cloudflare, approve the email, wait 5–7 days.

### Sequence that would be safe

1. Migadu trial → add domain → create the 2 mailboxes.
2. **Export both mailboxes from Hostinger** (the irreversible step).
3. Repoint MX / SPF / DKIM to the new provider; test send and receive both ways.
4. Run both in parallel for 7 days.
5. Transfer the domain to Cloudflare — **before 10-14**, to skip Hostinger's renewal.
6. Cancel Premium Web Hosting — **before 10-27**.
7. Close the second Hostinger account.

Steps 5 and 6 are the annual deadlines and they recur every year, so any future attempt
should start by **early September** to keep six weeks of margin.

## Unverified, if this is resumed

1. Zoho Mail Lite's exact INR price.
2. Cloudflare Registrar's exact `.com` price (at-cost model confirmed; the figure is not on their page).
3. Whether transferring the domain out *early* also ends the Hostinger free email. Their
   stated rule is hosting-based, so it should not — which is why the sequence above moves
   email first regardless.
