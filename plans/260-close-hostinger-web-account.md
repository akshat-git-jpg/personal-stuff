# Plan 260: Close the second Hostinger account (web hosting)

## Summary

- **Problem statement**: Two Hostinger logins exist. The second ("web") holds the
  `agrolloo.com` **registration**, a Premium Web Hosting plan (₹5,388/yr) running a
  WordPress, and the **mailboxes for @agrolloo.com** used to sign up to affiliate
  programmes. The owner wants one account, cleanly, without risking anything.
- **Goal**: retire the web account. Hosting first (the only real waste), domain second.
- **Non-goal**: moving Cloudflare Workers to the VPS. See "What must NOT move".

## The three things that block closing it

| # | Blocker | Evidence (2026-08-30) |
|---|---|---|
| 1 | **Mailboxes die with the hosting** — SETTLED 2026-08-30 | Hostinger's own tooltip: *"Free email plans renew along with your hosting plan."* Their agent: *"cancelling the hosting plan will also delete the free email accounts, **even if you keep paying for the domain**."* This **contradicts** the earlier inference from the expiry date — email follows the HOSTING, not the domain. The ₹5,388 buys nothing but 2 live mailboxes, and email must be rehomed before cancelling. |
| 2 | **5 live short links** hop through the WordPress on that hosting | `links` rows `5MyF/filmora`, `L2Is/lumen5`, `SB2g/hostinger`, `f5g4/d-id`, `zhaY/mailchimp` all target `https://agrolloo.com/<tool>`; each returns 302→WordPress→vendor today. |
| 3 | **`agrolloo.com` is registered in this account** | `--account web api GET /api/domains/v1/portfolio` returns it; the VPS account's token reports it as "not registered at Hostinger". Every app and the money path sit on this domain. |

`agrollo.com` (one fewer `o`) is a second vhost on the plan. `whois` says **No match** —
the domain does not exist. Dead weight; ignore it.

## What must NOT move

The owner's phrase was "move everything to the VPS". Most of it is already somewhere
better and moving it would be a downgrade:

- **13 of ~15 public apps are Cloudflare Workers**, not VPS containers. Workers are free
  at this volume, need no patching, and have no SSH surface. The VPS runs only
  `personal-dashboard`, `hyperframes-render`, `n8n`, `minio`, `traefik`.
- **A domain cannot live "on a VPS"** — registration is a registrar function. The honest
  target is **fewer providers**, not one: today Cloudflare + VPS + 2 Hostinger logins;
  after this plan, Cloudflare + VPS.

## Decisions confirmed

- Email → **not self-hosted on the VPS** (deliverability + maintenance; see Step 2 rationale).
- Domain → **Cloudflare Registrar**, at-cost, next to the DNS that already serves it.
- Timing → **hosting cancelled first, domain transferred later**. The two are separate
  subscriptions in one account; cancelling one does not touch the other.

---

## Phase 1 — kill the hosting (deadline: before 2026-10-27)

Saves ₹5,388/yr. Nothing here touches the domain.

### Step 1 — inventory the mailboxes  *(owner)* — **DONE 2026-08-30**
The Hostinger API has **no email endpoints at all** (nine paths probed, all 404): it covers
domains, VPS, hosting, DNS and billing only. Mailboxes exist solely in the panel, so this
step cannot be automated.

`@agrolloo.com`, Free Business Email, 3/100 mailboxes, auto-renew ON, expires 2026-11-10:
`khushibakliwal251@`, `khushibakliwal@`, `kushalbakliwal@` (~240 MB total).

A second plan, `@agrollo.com` (one fewer `o`), held `akshat.p@`, `jessica.p@` and
`seankerman@` — **on a domain that does not exist** (`whois` → No match), so none of them
could receive anything. Deleted by the owner 2026-08-30.

### Step 1b — fix DKIM  *(claude)* — **DONE 2026-08-30**
Hostinger's "some domain records are missing" warning was real, but not the missing-record
problem it looked like. Both DKIM CNAMEs (`hostingermail-a/b._domainkey`) **already existed
in Cloudflare and were set to `proxied: true`** — so they resolved to Cloudflare's proxy IPs
(104.21.68.2) instead of the signing key, and DKIM failed for every message sent. Flipped
both to DNS-only; both now return `v=DKIM1;k=rsa;p=…`. **Cost ₹0 and no provider change —
this, not the mail host, was the deliverability problem.** DMARC is still `p=none`; leave it
until DKIM has passed in the wild for ~2 weeks, then tighten.

> Hostinger's *intended* zone (including the DKIM records) is readable even though DNS lives
> at Cloudflare: `pp-hostinger --account web dns list agrolloo.com`. Handy whenever a mail
> provider says records are missing but will not say which.

### Step 2 — stand up replacement email  *(claude + owner)*
Chosen: a **managed provider**, not the VPS.

> Why not the VPS: a fresh VPS IP has no sending reputation, so Gmail and Outlook
> spam-folder or reject it until it is warmed; it needs SPF, DKIM, DMARC, a correct PTR
> record, blocklist monitoring and ongoing patching of the mail stack; and Hostinger
> commonly blocks outbound port 25 on VPS plans. The failure mode is an affiliate
> password-reset landing in spam — losing access to a money account to save a few
> hundred rupees. This is the one place where self-hosting adds exactly the "future
> workload and risk" the owner said to avoid.

- If replies as `@agrolloo.com` are needed → **Zoho Mail free tier** (own domain, real
  IMAP/SMTP, up to 5 mailboxes, ₹0).
- If receiving only → **Cloudflare Email Routing** (₹0, zero maintenance, already used
  for `bridebestie.com`; `tooling/cli/cf-email/setup-routing.mjs` automates it).

Then: create matching addresses, repoint MX + SPF (+ DKIM) on the Cloudflare zone,
send a test both ways, and **leave the Hostinger mailboxes running in parallel for
7 days** before Step 4.

### Step 3 — take the 5 links off the WordPress  *(claude)* — **DONE 2026-08-30**
`CLICKS_KV` and the `links` rows were repointed straight at each vendor:
`5MyF/filmora`→filmora.wondershare.net, `L2Is/lumen5`→lumen5.com,
`SB2g/hostinger`→hostinger.com, `f5g4/d-id`→d-id.com, `zhaY/mailchimp`→mailchimp.com.
All five verified live (302 straight to the vendor). **`links` rows depending on
`agrolloo.com`: 5 → 0.** No YouTube edit was needed — descriptions already point at
`go.agrolloo.com`, which is exactly what that indirection is for.

Mailchimp's stored URL carried a **stranger's Google Ads `gclid`**, so that click was
crediting whoever ran the ad; it now goes to the plain homepage. All five still carry no
affiliate code and earn **₹0** — `filmora` is the one worth fixing (approved on Impact).

### Step 4 — cancel the hosting subscription  *(owner)*
hPanel → Billing → Subscriptions → **Premium Web Hosting** (`m_68705591`) → cancel /
turn off auto-renew. **Leave `.COM Domain` (`m_68705617`) alone with auto-renew ON.**
Download a WordPress backup first if any post content is worth keeping.

### Step 5 — verify  *(claude)*
`https://agrolloo.com/<tool>` may now 404 — expected. Re-probe all 107 links and confirm
none targets `agrolloo.com`; confirm mail to `@agrolloo.com` still arrives.

---

## Phase 2 — move the domain (no hard deadline)

Let the domain auto-renew once on **2026-10-14** (₹1,516). A transfer takes 5–7 days and
is riskiest near expiry; paying one more year buys a calm window, and the domain carries
every app plus the affiliate money path.

1. hPanel → Domains → `agrolloo.com` → **unlock** (`is_locked` is currently `true`) and
   copy the **EPP/auth code**.
2. Cloudflare dash → Domain Registration → **Transfer Domains** → `agrolloo.com` → paste
   the code. DNS is already on Cloudflare, so records do not change and **nothing goes down**.
3. Approve the transfer email. Wait 5–7 days. Confirm with
   `whois agrolloo.com | grep -i Registrar` → expect Cloudflare.
4. Set auto-renew ON at Cloudflare. Update the renewals table in `INFRA.md`.
5. Only now: close the Hostinger web account.

---

## Rollback

- Phase 1 is reversible up to Step 4; hosting cancellation is not, hence the backup.
- Phase 2 has no window where the domain is unreachable — a registrar transfer does not
  move DNS, and DNS is already at Cloudflare.

## Open questions for the owner

1. The mailbox list from Step 1 — how many, and which are used for affiliate logins?
2. Do you ever *reply* from `@agrolloo.com`, or only receive? (Decides Zoho vs Cloudflare.)
3. Is there anything on the WordPress at `agrolloo.com` worth keeping (posts, pages)?
