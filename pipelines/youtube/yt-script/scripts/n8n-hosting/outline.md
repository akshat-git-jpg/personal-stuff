# Outline — n8n Self-Hosting (2026)

**Pass 1 of 2.** Review and reply "approved" (or send revisions) before I write the full script.

---

## Title options

1. **Best n8n Self-Hosting in 2026 — 15 Platforms Ranked (Honest Verdict)**
2. **I Tested Every Way to Host n8n — Don't Pay $80 for This**
3. **The Best Way to Self-Host n8n in 2026 (And the 7 to Avoid)**

Recommended: **#1**. Mirrors real search intent ("best n8n hosting"), signals breadth (15 platforms), and promises an opinion (honest verdict). Option #3 is the strongest click-driver but narrower on search coverage.

---

## Format

**Tier-list (4 tiers).** The KB has clear verdicts per tool, a definitive top pick, a tier list for the target audience, and enough volume (15 platforms) to justify sorting. Head-to-head would flatten the breadth; category-winner would fragment the clear "Hostinger for most people" verdict.

---

## Target viewer

A semi-technical or non-technical person who just searched "best n8n hosting" or "self-host n8n cheap." They already know what n8n is and want it running reliably for their own automations — YouTube posting, CRM updates, lead sorting, side-business ops. They're afraid of three things: getting stuck in a weekend setup, a surprise bill, and waking up to find their workflows wiped. They want one clear answer, with enough context to trust it.

---

## Tier placement (16 tools)

### 🔴 Eliminated (7)

| Tool | One-line reason |
|------|-----------------|
| **Heroku** | $50–90/mo for what costs under $10 elsewhere. No justification for n8n. |
| **Contabo** | Unbeatable specs on paper, but oversubscribed CPU stalls single-core-bound n8n at random. |
| **Oracle Cloud (Always Free)** | 24GB RAM free — until Oracle reclaims your instance without warning or bans the account. |
| **Google Cloud Free Tier (E2 micro)** | 1GB egress cap trips billing on trivial workflows. 2GB RAM makes n8n lag. |
| **AWS EC2** | 400+ instance types, IAM, VPC, hidden egress costs. Forklift for a trolley job. |
| **Fly.io** | CLI-only, region-locked volumes. Designed for edge workloads, not single n8n instances. |
| **Render** | Free plan wipes every workflow after 15 min idle. Paid plans have opaque "plus compute" billing. |

### 🟡 Situational (3)

| Tool | Who it fits |
|------|-------------|
| **Raspberry Pi 5** | You already own one + NVMe HAT, hobby projects only, comfortable with Cloudflare Tunnel. |
| **Synology NAS** | You already own a capable Synology and you're comfortable with SSH and permission fixes. |
| **AWS Lightsail** | You're already using Amazon services and want everything under one bill. |

### 🟢 Worth Considering (2)

| Tool | Why it's close but not a Winner |
|------|--------------------------------|
| **Netcup Root Servers** | Dedicated cores, ~$8–12/mo, zero noisy-neighbor jitter. Dated control panel, 6–12 mo lock-in. |
| **Hetzner Cloud** | Modern UI, ~$7–10/mo ARM pricing, excellent perf. Aggressive account-verification rejects many new users. |

### 🏆 Winners (4)

| # | Tool | Angle |
|---|------|-------|
| 1 | **Hostinger KVM 2** | The one I'd recommend to most people watching. One-click install, $8.99/mo, ~13ms response. |
| 2 | **Railway** | For the person who wants live in 5 minutes and hates infrastructure. Pay more, do nothing. |
| 3 | **Digital Ocean** | For the person building something serious that other people depend on. The professional's pick. |
| 4 | **Coolify + Hostinger** | The hidden-gem combo. Railway-grade UX on a $7 VPS. Highest music peak. |

---

## Hook angle

Two options, recommending **A**.

**A. The cost-gap tension.**
> "n8n is completely free to use. So why are so many people accidentally spending $80 a month to run it — when there's one platform that gives you double the power for under ten?"
>
> Follow with: "I went through all 15 of the most popular ways to host n8n — six of them will quietly cost you money or data, three only work in one narrow scenario, and four I'd actually recommend. By the end of this you'll know exactly which one fits you."

**B. The free-tier trap.**
> "The most expensive way to host n8n isn't the $80/month platform. It's the free one. Some of them quietly wipe every workflow you built while you sleep. Some charge you hundreds in overage fees the first time a real automation fires. And the ones that sound the safest are usually the worst traps."

A wins on search-intent match (most searches are cost-driven). B would win if the free-tier story is the video's hero finding.

---

## CTA strategy

- **Winners** get the warm push. Hostinger line includes the discount code callout. Railway, DO, and Coolify+Hostinger all get specific reason-to-click lines.
- **Worth Considering + Situational** get a short "link's in the description" one-liner — no push.
- **Eliminated** get no spoken CTA. The whole point is "don't click this."
- Outro reinforces: "The Hostinger, Railway, and DigitalOcean links include discount codes — use those, not the homepage."
- The word *affiliate* does not appear in any spoken line.

---

## Section-by-section skeleton

Target total: **~15:30 runtime, ~2,290 words voiced**. At 140 wpm.

| # | Section | ⏱️ | Words | Key idea |
|---|---------|-----|-------|----------|
| 1 | Hook | 0:00–0:35 | ~85 | Cost-gap tension + promise of sorted verdict |
| 2 | Intro | 0:35–1:45 | ~165 | 4 tiers explained, who this is for, transition to Eliminated |
| 3 | 🔴 Heroku | 1:45–2:10 | ~60 | $50–90/mo for what costs under $10 elsewhere |
| 4 | 🔴 Contabo | 2:10–2:38 | ~70 | Stolen CPU cycles break n8n silently |
| 5 | 🔴 Oracle Cloud | 2:38–3:08 | ~75 | Instances reclaimed, accounts banned, no warning |
| 6 | 🔴 Google Cloud Free | 3:08–3:35 | ~68 | 1GB egress cap triggers surprise billing |
| 7 | 🔴 AWS EC2 | 3:35–4:00 | ~62 | 400+ types, IAM, egress gotchas |
| 8 | 🔴 Fly.io | 4:00–4:22 | ~55 | CLI-only, wrong tool for this job |
| 9 | 🔴 Render | 4:22–4:50 | ~70 | Free plan wipes workflows after 15 min idle |
| 10 | 🟡 Raspberry Pi 5 | 4:50–5:32 | ~100 | SD card failure is not optional — NVMe HAT mandatory |
| 11 | 🟡 Synology NAS | 5:32–6:08 | ~90 | Permission errors need SSH — not for the UI-only crowd |
| 12 | 🟡 AWS Lightsail | 6:08–6:40 | ~80 | Makes sense only if you're already in AWS |
| 13 | 🟢 Netcup | 6:40–7:20 | ~95 | Dedicated cores at VPS prices, dated UI, 6–12 mo lock-in |
| 14 | 🟢 Hetzner | 7:20–8:00 | ~95 | Best UI in the category, account-verification gate |
| 15 | Winners intro beat | 8:00–8:10 | ~25 | Music shift + "These are the four I'd actually recommend" |
| 16 | 🏆 Winner #1 — Hostinger | 8:10–10:10 | ~285 | Price + one-click template + Kodee + real performance + discount CTA |
| 17 | 🏆 Winner #2 — Railway | 10:10–11:40 | ~215 | 5-min deploy, auto-scale, higher cost is the honest tradeoff |
| 18 | 🏆 Winner #3 — Digital Ocean | 11:40–13:10 | ~215 | $24/mo Premium Droplet, best docs on the internet, scales with you |
| 19 | 🏆 Winner #4 — Coolify + Hostinger | 13:10–14:30 | ~190 | Railway-grade UX on a $7 VPS, ~1GB RAM overhead caveat |
| 20 | Final Summary | 14:30–15:20 | ~120 | One line per winner, one line for considering, one line for situational, name the eliminated |
| 21 | Outro + CTA | 15:20–15:55 | ~85 | Confidence close + link callout + comment hook + sign-off |

**Estimated runtime:** 15:55. **Estimated voiced word count:** ~2,290.

---

## Gaps / risks flagged

1. **Render tier placement.** The KB's "Not recommended" list puts Render alongside Heroku, but the free-tier-wipe concern doesn't apply to paid plans. I've placed it in Eliminated, following the KB verdict. If you want to surface paid Render as Worth Considering instead, flag it in revisions.
2. **AWS split.** KB bundles Lightsail + EC2 under "Amazon AWS." I've split them: EC2 to Eliminated (complexity), Lightsail to Situational (ecosystem fit). Matches how the example script handled it.
3. **Heroku confidence.** KB notes this profile was reconstructed from supplementary research ("Hiroku" in the brief). Script will keep claims generic and verdict-first rather than spec-deep.
4. **Pricing specificity.** Only Hostinger, Railway, and Render have authoritative pricing. All other prices in the script will use the KB's range language ("around $7–10/mo") rather than precise figures.
5. **No web research.** All numbers and verdicts come from the KB only. If anything in the KB is outdated at the time of recording, it will ship as-is.

---

## File

`scripts/n8n-hosting/outline.md`

Reply **"approved"** (or send revision notes) and I'll write the full script to `scripts/n8n-hosting/script.md`.
