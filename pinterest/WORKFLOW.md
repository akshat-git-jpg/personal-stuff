# Pinterest Business — Workflow (human guide)

The repeatable playbook for any niche. Wedding is the first worked example.
Rules live in `PINTEREST-PRINCIPLES.md`; research method in `NICHE-RESEARCH.md`.

## Phase 0 — Pick the niche (before committing)
Ask Claude to **find a niche**: it runs `niche-scan` across candidates → scorecard
(demand · do-they-buy · how-open) → recommends. Then **deep-research** the winner (multi-keyword)
to confirm and get the product + first pin ideas.

## Phase 1 — Set up the niche (once)
0. **Brand = name + domain + email.** Pick a niche-obvious, brandable name whose `.com` + Pinterest +
   Instagram are all free, buy the `.com` at Cloudflare, and set up catch-all email to the hub.
   Full repeatable playbook (research methods, goals, the one-command email setup): **`BRAND-SETUP.md`**.
1. Create a **Pinterest business account** for the niche (one per niche).
2. With Claude, SEO the **profile** — keyworded name, bio, and ~5 keyword boards (per principles §5).
3. Create the **product** (the PDF), list on **Gumroad**, grab the offer URL.
4. Claude creates `<niche>/config.json` (handle, offerUrl, boards, brand) + `playbook.md` (voice + locked theme).

## Phase 2 — Weekly factory (Claude, Sunday)
`pinterest-research` (fresh outliers + briefs) → `pinterest-make-post` (image + copy) →
**independent critic gate** (SHIP/FIX/REGEN) → only SHIP pins land in the board, each with `notes.md`.
Result: a week of validated pins.

## Phase 3 — Daily posting (you, manual)
Open the board (`localhost:4000`) → post **2–3/day** across boards → tap **Mark posted**.

## Phase 4 — Sunday analysis (`pinterest-analyze` — to build)
Review all posted pins: performance vs competitors → verdict: **stay the course / tweak / pivot**.
Append the result to a weekly **`<niche>/ANALYSIS-LOG.md`** (changelog style).

**Data sources (account-safe by design):**
- *Your* pin numbers → **Pinterest Analytics export** you download weekly (normal user action; drop the
  file in `<niche>/analytics/`). Zero risk — we never scrape/automate the posting account.
- *Competitor* benchmarks → the **research-account bot** (public search only; never your posting account).
- *Optional later:* official **Pinterest API** for hands-off own-account analytics (needs a dev app).

## Weekly rhythm
- **Sunday:** analyse last week (P4) → research + build next week's batch (P2)
- **Mon–Sat:** post 2–3/day (P3)

## Skills (the tooling)
- `pinterest-research` — pick a niche (niche-scan) + find winning pin ideas (scrapes live saves → velocity, ranks outliers, writes briefs).
- `pinterest-make-post` — turn one idea into a finished pin (on-theme image + human copy), gated by an independent critic before it ships.
- `pinterest-board` — local web cockpit (`localhost:4000`) to copy each field + mark pins posted.
- `pinterest-analyze` — neutral weekly review of your posted pins vs live competitors → ranked fixes + `ANALYSIS-LOG.md`.

(Criteria live in `PINTEREST-PRINCIPLES.md`; `CRITIC.md` is the critic's rubric inside make-post.)

## File map
`<niche>/` → `config.json`, `playbook.md`, `posts/<slug>/{image.png, post.md, post.json, notes.md}`,
`research/`, `ANALYSIS-LOG.md`
Shared → `PINTEREST-PRINCIPLES.md`, `NICHE-RESEARCH.md`, `WORKFLOW.md`, `BRAND-SETUP.md` (domain+email)

## Status
- **Built:** `pinterest-research`, `pinterest-make-post` (+ critic), `pinterest-board`.
- **To build:** `pinterest-analyze` (Phase 4) + the per-niche analysis log.
- **Wedding:** researched, theme locked, pin 1 made. Pending: real handle + Gumroad URL.

## 💡 Ideas / backlog (NOT building now — keep in mind)
- **Viral "swing" pins (high-variance lane).** Now and then, take a risk *outside* the reliable
  factory: a motion/video pin or an extra-bold curiosity/contrarian caption. Barbell it — mostly safe
  pins, the odd big swing; measure each swing with `pinterest-analyze` and keep only what hits.
  - Reuse existing tooling for motion: `remotion-best-practices` / `hyperframes-helper` (no new infra).
  - Likely a **"swing mode" inside `make-post`** (bolder template + brief), not a new skill — only if it scales.
  - ⚠️ **Avoid "offensive"** for a trust/wedding brand — it risks the account and the brand. Go
    bold / curiosity / contrarian, not offensive (same attention, none of the downside).
