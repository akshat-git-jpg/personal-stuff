# Brand setup — domain + email for a new niche

How to stand up a new niche brand (name → domain → branded email) the way we did for **Bride Bestie**.
Repeatable for any niche (Pinterest, YouTube, Twitter — one brand domain serves them all).
Worked example throughout: `bridebestie.com` / `@bridebestie` / `hello@bridebestie.com` → hub
`jessicap123k@gmail.com`.

> TL;DR for a new niche is at the bottom. The sections explain the *why* so the choices stay sound.

---

## 0. The goal (what we're optimizing for)
- **One brand per niche, one domain per brand** — reused across every platform (Pinterest handle,
  landing page, email, Gumroad). Never one domain per platform.
- **The name must be free everywhere we'll use it:** `.com` **and** the Pinterest handle **and**
  Instagram (and ideally X). A taken handle on any of those kills the name — you can't build a
  coherent business on a split identity.
- **Intuitive to the niche** — the name should read as what it is (wedding, keto, …), and be
  brandable (memorable, not a generic keyword string).
- **Buy only what we'll commit to.** A domain is ~$10/yr; buy it when the niche is committed/validated.
  Speculative niches can start free on a `<niche>.agrolloo.com` subdomain and graduate later.

## 1. Domain + handle research (Claude runs this)
Goal: find a niche-obvious, brandable name whose **.com + Pinterest + Instagram** are all free.
We batch-check many candidates because catchy `.com`s are mostly taken — expect a low hit rate.

**a) `.com` availability** (pp-hostinger CLI — rate limit 10/min, so batch ≤10):
```
"/Users/kbtg/codebase/personal-stuff/tooling/cli/hostinger/pp-hostinger" domains check thebridehandbook --tlds com
```
Keep only `.com` (or `.net`). **Avoid:** `.xyz/.online/.site/.club/.info/.top` (spammy, hurt
deliverability) and `.co/.shop/.io/.ai` (cheap year 1, expensive renewal).

**b) Pinterest handle** (curl from the Mac — reliable; empty `<title>` = available):
```bash
curl -sL -A "Mozilla/5.0 (Macintosh…Safari/605.1.15)" "https://www.pinterest.com/<handle>/" \
  | grep -o '<title>[^<]*</title>'
# real account -> "<Name> (handle) | Pinterest"   ·   available -> <title></title>  (empty)
```

**c) Instagram handle** (curl the profile API with the public app id; 404 = available):
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "x-ig-app-id: 936619743392459" \
  "https://www.instagram.com/api/v1/users/web_profile_info/?username=<handle>"
# 404 = AVAILABLE   ·   200 = TAKEN   (verify with controls: @instagram=200, a junk string=404)
```

**d) X / Twitter** — no reliable unauthenticated check from here (endpoints are blocked/JS-only).
Check manually by visiting `x.com/<handle>` while logged in, or just claim it at signup. X is the
*tertiary* platform for a Pinterest business, so don't block on it.

Present the survivors (name + which platforms are confirmed free) and let the user pick. Also sanity-
check the name isn't an existing small brand (search Pinterest/Google) — that's how `thebridalbinder`
got rejected (an existing Pinterest + IG account already used it).

## 2. Buy the domain (user does this — ~2 min)
Register at **`domains.cloudflare.com`** (Cloudflare Registrar). Why Cloudflare:
- **At-cost, flat pricing** — `.com` ≈ **$10.44/yr at registration AND renewal**, no markup, no
  first-year gimmick, free WHOIS privacy + DNSSEC.
- Buying here means the domain is **automatically a Cloudflare zone** → email routing + Workers just work.
- Claude **can't** buy it (no registrar API + needs your card) — this one step is always yours.

Use a **dedicated brand email** to register platform accounts (not personal) — e.g. a fresh Gmail
that also becomes the routing **hub**. (We use one shared hub for all niches: `jessicap123k@gmail.com`.)

## 3. Branded email (Claude runs one command)
We use **Cloudflare Email Routing**: a free **catch-all** that forwards every `*@<brand>.com` into the
shared hub Gmail. No paid mailbox. (Sending marketing later = an ESP like MailerLite with SPF/DKIM;
1:1 replies = Gmail "Send as". Both reuse the same `hello@<brand>.com` address.)

**The tool:** `personal-stuff/tooling/cli/cf-email/setup-routing.mjs` (see its README).
```bash
node "/Users/kbtg/codebase/personal-stuff/tooling/cli/cf-email/setup-routing.mjs" <brand>.com
# defaults the hub to jessicap123k@gmail.com; pass a 2nd arg to override
```
It resolves the zone, **enables** Email Routing, provisions MX + SPF, registers the hub destination,
and sets the catch-all `*@<brand>.com → hub`.

**Credentials (in `TY/.env`, gitignored):**
- `CF_API_TOKEN` — scoped token (DNS:Edit, Email Routing Rules:Edit [zone], Email Routing
  Addresses:Edit [account], all zones). Does everything **except enable** routing.
- `CF_GLOBAL_API_KEY` + `CF_API_EMAIL` — the Global API Key. **Required to enable routing** (Cloudflare
  blocks the enable/settings endpoints for scoped tokens — error 10000). The CLI auto-prefers it.
  ⚠️ Full account access — keep `TY/.env` gitignored; roll the key if it ever leaks.

**The one human step (once ever):** the first time, Cloudflare emails the hub a **verification link** —
click it in the hub Gmail. Because the hub is verified **account-wide**, every later niche skips this.

**Verify it worked:** the CLI prints `enabled / ready` + the catch-all; then email `hello@<brand>.com`
from anywhere and confirm it lands in the hub.

---

## TL;DR — new niche, start to finish
1. **Research** (Claude): batch-check candidate names for free **.com + Pinterest + Instagram**
   (§1). Pick a niche-obvious, brandable survivor.
2. **Buy** (you): register the `.com` at `domains.cloudflare.com` (~$10.44, flat).
3. **Email** (Claude): `node cli/cf-email/setup-routing.mjs <brand>.com`. First niche only: click the
   hub verification link once.
4. **Done.** `hello@<brand>.com` forwards to the hub. Brand is ready for the Pinterest account,
   landing page, and Gumroad. → continue with `WORKFLOW.md` Phase 1.

Per-niche cost: **~$10/yr domain + $0 email.** Per-niche effort after the first: **one command + zero clicks.**
