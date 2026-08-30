# Email Preferences — agrolloo (kushalbakliwal@agrolloo.com)

Free-form rules. The assistant reads this file before composing anything and
applies it. Add new rules anytime by saying "remember that ..." — they get
appended here.

This is a **Hostinger** mailbox, not Gmail. The daily digest reads it over IMAP
(`fetch-imap.py`), so `pp-gmail`-only actions (send, reply, draft, archive) do
not work against this address. The digest is read-only.

## Reply tone & voice

- Warm but concise. Get to the point; no filler.
- Match the formality of the incoming email — casual with creators and
  community contacts, professional with brands, networks, and support desks.
- Plain, natural language. Avoid corporate-speak and over-formality.

## Greeting & sign-off

- Greeting: "Hi <first name>," for known contacts; "Hello," when the name is unknown.
- Sign-off: "Thanks," or "Best," followed by the signature below.

## Signature

Kushal Bakliwal

## Digest focus areas

Read by `digest.sh` to drive Part 2 of the daily digest. Add or remove lines
freely — each top-level item below becomes a 📌 section in the digest, and the
digest tool will report which emails (if any) matched in the time window.

If this section is empty, Part 2 of the digest will say so.

- **Affiliate networks** — Impact (`app.impact.com`), PartnerStack, ShareASale,
  CJ, Awin: approvals, rejections, new offers, terms changes
- **Money** — payout confirmations, invoices, "payment due", commission
  statements, tax or PAN/GST paperwork
- **Brand / sponsorship outreach** — anyone proposing a paid placement,
  a review, or a partnership
- **Account safety** — password resets, login alerts, verification codes,
  suspension or policy warnings from any platform
- **Hosting & domain** — Hostinger, Cloudflare: renewals, expiry warnings,
  billing failures, DNS or deliverability notices. `agrolloo.com` renews
  2026-11-10, so flag anything about it early.

## Digest noise rules

Push these down, never into Part 2, unless a focus area above clearly applies:

- Newsletters and "weekly roundup" mail
- Generic network promos with no offer specific to us
- Social notification digests

<!-- Edit the signature above and add any extra rules below as you go. -->
