# yt-income: if something looks wrong

- **PayPal reconciliation non-zero.** The windows differ (PayPal defaults to
  1 Jan 2026 → today), or a payout is genuinely in transit. Check before
  assuming a parser bug.
- **A whole month drops to near-zero traced.** The PayPal batch matcher failed.
  Look at `attribute.py`'s `_paypal_grouped`; a batch of more than six programs
  exceeds its search bound.
- **A new payer appears in the untraced credits.** Add a rail to `rules.json`
  and re-run. Match on a stable payer-name fragment, never a transaction id.
  Identify it first: it may be a tool already on the list under another name
  (see [attribution.md](attribution.md)).
- **PartnerStack returns 403.** Most likely the User-Agent, not the key. Their
  WAF rejects the default `Python-urllib/3.x`; `sources.py` sets a real one.
- **`CERTIFICATE_VERIFY_FAILED`.** A python.org install without its CA bundle.
  `sources.ssl_context()` falls back to certifi; verification is never disabled.
- **A source reads as not connected in a fresh workspace.** Symlink `impact.env`,
  `partnerstack.env` and `hostinger-mail.env` from the main checkout's
  `infra/secrets/`, and copy `data/` from the last workspace that ran the skill.
- **Mailbox returns zero mail.** See the IMAP gotchas in [mailbox.md](mailbox.md).
