# Knowledge Base: n8n Self-Hosting Platforms (Compact)

## Key Findings & Surprises

1. **"Free tier" is the biggest trap in this niche.** Render's free plan spins down after 15 minutes of inactivity and wipes every workflow. Oracle Cloud's "Always Free" 24GB RAM box is reclaimed if CPU/RAM usage drops below a threshold, and accounts are banned without warning. Google Cloud's Always Free E2 micro has a 1GB monthly egress cap that trips billing on the first real workflow. "Free" costs more than $8.99/mo in lost automations for non-technical users.

2. **Hostinger KVM 2 gives you double the production RAM at less than half the cost of PaaS.** Production n8n needs 4GB RAM minimum. Hostinger KVM 2 ships 8GB RAM + 2 vCPU + 100GB NVMe for $8.99/mo (24-mo) or $9.99/mo (12-mo). A matching 4GB / 2 vCPU load on Railway runs $40–60/mo, on Heroku $50–90/mo — a 4–10x cost gap.

3. **Self-hosting unlocks n8n's paid Cloud features for free.** Railway's official n8n template and Hostinger's one-click install both deliver advanced debugging, execution search and tagging, folders, and unlimited concurrent executions — features otherwise gated behind n8n Cloud paid tiers.

4. **Raspberry Pi is not $0/month.** Micro-SD cards fail under n8n's write-intensive DB load. A stable Pi 5 requires NVMe SSD + PCIe HAT (~$100 upfront) plus Cloudflare Tunnel or Tailscale for public webhook access. The hardware is cheap; the setup is expert-tier.

5. **Contabo wins RAM-per-dollar and loses n8n performance.** 4 vCPU / 8GB RAM for $5–8/mo looks unbeatable, but oversubscribed physical servers produce "stolen CPU cycles" — n8n is single-core-bound and jittery response times are the exact failure mode automation cannot tolerate.

## Software Profiles

### Hostinger
**Overview:** Managed/one-click n8n VPS on AMD EPYC + NVMe. Deploy in under 5 minutes with no Linux, Docker, or CLI knowledge. Top-ranked pick for the target audience.

**Pricing** (USD, paid upfront, 30-day money-back, 24/7 support, free domain 1 year):
- *12-month:* KVM 1 $6.99/mo promo (renews $12.99); KVM 2 (Most Popular) $9.99/mo promo (renews $16.99) — 2 vCPU, 8GB RAM, 100GB NVMe, 8TB; KVM 4 $14.99/mo (renews $30.99); KVM 8 $28.49/mo (renews $53.99).
- *24-month:* KVM 1 $6.49/mo (renews $11.99); KVM 2 $8.99/mo (renews $14.99); KVM 4 $12.99/mo (renews $28.99); KVM 8 $25.99/mo (renews $49.99).
- All plans: unlimited workflows, unlimited concurrent executions, Queue Mode, 100+ pre-made workflows, one-click install, Hostinger API node, Kodee MCP AI assistant.

**Strengths:** One-click install removes all technical barriers. AMD EPYC + NVMe delivers ~13ms response times. 70–80% cheaper than n8n Cloud with no execution caps. Full data sovereignty, no vendor lock-in. 24/7 human + AI support.

**Weaknesses:** User manages n8n version updates and OS/Docker patches (unmanaged VPS). No in-app team/role management. No n8n AI Workflow Builder. Headline promo prices require multi-year upfront; renewals are ~50–70% higher.

### Railway
**Overview:** Modern PaaS with an official n8n template (authored by n8n team) that auto-provisions n8n + Redis + PostgreSQL. Usage-based pricing. Best for prototyping and intermittent workloads.

**Pricing** (usage-based, no fixed monthly):
- **Free:** 1 project post-trial, 3 services/project, up to 1 vCPU and 0.5GB RAM per service, 1GB ephemeral disk, 0.5GB volume storage, 3-day logs. Trial doubles these. $5 credit first month (unavailable on new GitHub accounts).
- **Hobby:** 50 projects, up to 48 vCPU/48GB RAM per service, global regions, 7-day logs.
- **Pro:** 100 projects, up to 1,000 vCPU/1TB RAM per service, SOC 2, priority support, 30-day logs.
- **Enterprise:** Custom. SSO, HIPAA, dedicated VMs, BYOC.
- 4GB / 2 vCPU 24/7 workload ≈ $40–60/mo.

**Strengths:** Fastest repo-to-production path (setup 1/10). Zero-maintenance infrastructure. Official template unlocks paid n8n features free. "Railway Metal" improves latency.

**Weaknesses:** Usage-based pricing is volatile. 1GB disk on Free is a non-starter for production. 24/7 cost is 4–6x a comparable VPS.

### Render
**Overview:** Managed PaaS with fixed server sizes, Git-based deploys, persistent SSD, and managed DBs. Free plan is a trap for n8n.

**Pricing** (per user/month + compute, USD):
- **Hobby:** $0 + compute. Managed datastores, custom domains, global CDN.
- **Professional:** $19/user/mo + compute. 500GB bandwidth, 10 team members, horizontal autoscaling, preview envs, chat support.
- **Organization:** $29/user/mo + compute. 1TB bandwidth, unlimited members, audit logs, SOC 2 Type II, ISO 27001.
- **Enterprise:** Custom. SAML SSO/SCIM, guaranteed uptime.
- Typical n8n production: ~$25–45/mo. Bandwidth overages $15/100GB. VC-startup credits up to $100K.

**Strengths:** 1–5 min deploy. Persistent SSD survives restarts. Fixed sizes = predictable compute. Strong compliance tier.

**Weaknesses:** **Free plan unusable for n8n — sleeps after 15 min and wipes data.** "Plus compute" makes total cost opaque. Bandwidth overages punish heavy workflows. Cold starts drop webhooks.

### Digital Ocean
**Overview:** Developer-standard VPS (Droplets) with full root access, industry-standard docs, predictable flat pricing. Professional middle ground between AWS and PaaS.

**Pricing** (no screenshots — figures from supplementary research):
- Smallest: ~$4/mo. Long-term common: ~$12/mo. Production (2 vCPU, 4GB RAM Premium): ~$24/mo. Backups: +20%.

**Strengths:** Extremely stable, predictable flat billing. Best-in-class docs. Generous bandwidth. Developer-friendly without AWS complexity.

**Weaknesses:** Requires console, SSH, Docker, Nginx, Certbot — not for non-technical users. Backups are paid add-on. Storage not as fast as NVMe-first providers. No managed auto-healing.

### Amazon AWS (Lightsail & EC2)
**Overview:** Infrastructure giant. Lightsail = flat-price VPS; EC2 = 400+ instance types with full control. Best "free" option for a technical user.

**Pricing** (supplementary research):
- Lightsail $20 plan or EC2 t4g.medium: ~$20–35/mo.
- EC2 free tier: 750 hrs/mo for 12 months, true 24/7, no sleep, no cold starts.

**Strengths:** 12-month EC2 free tier is the best "free" path. Unrivaled reliability/global reach. Lightsail is price-predictable. Deep Lambda/S3/RDS integration.

**Weaknesses:** EC2 steep curve — VPC, IAM, Security Groups, Docker. Egress costs frequently exceed server cost on file-heavy workflows. Lightsail plans can't be downgraded. Overkill for single-app.

### Google Cloud (GCE)
**Overview:** Enterprise Compute Engine with industry-leading networking and AI/ML integration. Free tier is powerful but requires precise configuration.

**Pricing** (supplementary):
- Always Free E2 micro: 2 vCPU, 2GB RAM, 30GB (must be raised from 10GB), static IP — $0.
- Production e2-medium (2 vCPU, 4GB RAM) + disk + egress: ~$25–35/mo.
- New customers: $300 credit (time-limited).

**Strengths:** Enterprise reliability. E2-medium is the production sweet spot. AI/ML ecosystem. Industry-leading autoscaling.

**Weaknesses:** E2 micro's 2GB RAM makes n8n lag — sandbox only. 1GB egress cap trips billing on trivial workloads. Snapshots/observability incur extra costs. Requires Nginx, Certbot, VPC, IAM. Billing account mandatory even for free tier.

### Oracle Cloud (OCI)
**Overview:** Most generous free tier in the cloud industry — and the most dangerous.

**Pricing:** Always Free — up to 4 ARM Ampere vCPUs, 24GB RAM, 200GB block storage — $0.

**Strengths:** Resources worth $40–60/mo on other platforms at no cost. High-performance ARM. Uniquely generous 200GB free storage.

**Weaknesses:** Notoriously difficult registration. Idle instances reclaimed without warning. Random account bans documented. Complex networking/IAM/iptables (8/10). Regionally constrained Free Tier.

### Heroku
**Overview:** Mature PaaS veteran. Mostly an enterprise-continuity decision now. (Listed as "Hiroku" in brief; profile reconstructed from supplementary research — lower confidence.)

**Pricing:** Standard-2X Dynos + Postgres + Redis: ~$50–90/mo. No permanent free tier.

**Strengths:** Extremely mature/stable. Seamless Salesforce integration. Git-push simplicity remains best-in-class.

**Weaknesses:** Highest production cost. Ephemeral filesystem — persistent data must move to external DB/object storage. Aging architecture.

### Netcup
**Overview:** German provider — "Root Servers" with guaranteed dedicated CPU cores at VPS prices.

**Pricing** (supplementary): RS 1000 G12 (4 dedicated vCPU, 8GB RAM, 256GB NVMe): ~$8–12/mo on 6–12 month commitment.

**Strengths:** Best performance-per-dollar for technical users. Dedicated cores eliminate webhook jitter. RAID-10 NVMe. European compliance.

**Weaknesses:** "90s-style" control panel. 6–12 month billing, 30-day cancellation notice. No n8n templates (6/10). Non-24/7 support.

### Hetzner
**Overview:** European cloud with modern UI, hourly billing, ARM cloud instances ideal for Queue Mode. Gold standard for European deployments.

**Pricing** (supplementary): CAX21 (4 ARM vCPU, 8GB RAM, 80GB NVMe): ~$7–10/mo.

**Strengths:** Best-in-class UI. Exceptional ARM price-to-performance. Predictable hourly billing. European data sovereignty.

**Weaknesses:** Aggressive account verification — new accounts frequently rejected. EU business-hours support. Setup 6/10 (no n8n templates).

### Contabo
**Overview:** Maximum RAM/CPU for minimum dollars; the tradeoff is in consistency.

**Pricing** (supplementary): VPS S (4 vCPU, 8GB RAM, 50GB NVMe): ~$5–8/mo.

**Strengths:** Unbeatable spec-per-dollar. Excellent for memory-intensive JSON/scraping workloads.

**Weaknesses:** Over-provisioned physical servers produce stolen CPU cycles and disk latency at peak — directly hurts n8n's single-core-bound execution. Slow support. Older infrastructure.

### Fly.io
**Overview:** Edge-native platform — Docker → Firecracker micro-VMs across 30+ regions. Best for globally distributed webhook intake.

**Pricing** (supplementary): 4GB RAM shared-CPU + persistent volume: ~$25–40/mo.

**Strengths:** Edge execution for low-latency global webhooks. High-performance micro-VMs. Granular regional scaling.

**Weaknesses:** Steep curve — flyctl-only. Volumes are region-locked and require manual migration. Cross-region Queue Mode requires careful Redis/Postgres orchestration.

### Coolify
**Overview:** Open-source self-hosted PaaS that wraps a VPS in a Railway-like UI. Not a hosting provider — a management layer.

**Pricing:** Free software. Underlying VPS ~$7/mo (e.g., Hetzner).

**Strengths:** PaaS convenience at VPS prices. Automated Let's Encrypt SSL, backups. Open-source transparency. Pairs well with Hetzner/Hostinger.

**Weaknesses:** ~1GB RAM overhead for its management stack. User still owns underlying VPS security.

### Raspberry Pi 5
**Overview:** Always-on local host for hobbyist n8n. Zero monthly fees; expert setup. Not production.

**Pricing:** ~$100 upfront (Pi 5 + NVMe HAT + SSD). $0/mo + power.

**Strengths:** Zero recurring cost. Absolute data privacy. Excellent learning platform.

**Weaknesses:** SD cards fail under n8n DB writes — NVMe HAT mandatory. Requires Cloudflare Tunnel/Tailscale for webhooks. Setup 9/10. Fixed specs, no upgrade path. No horizontal scaling, no redundancy, no UPS, depends on home internet.

### Synology NAS (Docker)
**Overview:** Container Manager on existing NAS — centralizes automation with storage.

**Pricing:** $0/mo if hardware owned.

**Strengths:** No extra hardware cost. RAID redundancy. Centralized management.

**Weaknesses:** Strict ACL causes frequent "EACCES: permission denied" errors — requires SSH. GUI restricts container modification. Outdated Docker binaries. Fixed NAS CPU/RAM bottlenecks Queue Mode. Setup 8/10.

## Comparative Analysis

### Ease of Setup
Hostinger (2/10) → Railway (1/10 template) → Render (2/10) → Coolify (3/10) → Heroku (3/10) → Digital Ocean (4/10) → AWS Lightsail (5/10) → Contabo/Hetzner/Netcup (5–6/10) → Fly.io (7/10) → Google Cloud (7/10) → AWS EC2 (8/10) → Synology NAS (8/10) → Oracle Cloud (8/10) → Raspberry Pi (9/10).

### Speed & Performance
Hostinger KVM 2 (2 vCPU, 8GB RAM, AMD EPYC + NVMe) is the performance leader for the target audience at ~13ms response times. Hetzner ARM and Netcup dedicated-core Root Servers match or exceed this for technical users; Netcup is uniquely immune to noisy-neighbor jitter. Railway/Render are stable on paid tiers only. GCP's E2 micro (2GB) lags. Render's free plan is unusable — inactivity wipes data. Contabo's oversubscription jitter hurts single-core-bound n8n regardless of RAM specs.

### Price & Value
**Hostinger is the best overall value** for the target audience. KVM 2 at $8.99/mo (24-mo) / $9.99/mo (12-mo) is flat, predictable, and 4–10x cheaper than PaaS alternatives (Railway $40–60/mo, Heroku $50–90/mo, Render $25–45/mo) for the same 4GB workload.

**"Free" tiers ranked for real usefulness:**
1. **Amazon AWS** — 12-month EC2, true 24/7. Best for technical users.
2. **Oracle Cloud** — 24GB RAM free forever if you can register and stay non-idle. Highest ceiling, highest risk.
3. **Google Cloud** — E2 micro lag + 1GB egress trap; learning only.
4. **Railway** — $5 credit, only on old-enough GitHub accounts.
5. **Render** — Trap; data wiped every 15-min idle.

**Promo-pricing trap:** Hostinger's headline $6.99/mo requires 12 months upfront and renews at $12.99/mo. KVM 2 renews at $14.99–16.99/mo. Still the cheapest across tiers — but not the promo number.

### Ease of Use for Non-Technical Users
Hostinger wins unambiguously: no Linux, Docker, CLI, or reverse proxy. Railway and Render are the tolerable middle. DigitalOcean, AWS, GCP, Oracle Cloud, Hetzner, Netcup, Contabo, Fly.io, Raspberry Pi, Synology all require command-line competence.

### Support Quality
Hostinger: 24/7 human + Kodee AI. DigitalOcean/AWS/GCP: self-serve docs unless paying for premium. Hetzner: EU business hours only. Netcup/Contabo: slower, non-24/7. n8n itself does not support self-hosted instances — platform support is the only safety net.

### Data Sovereignty
Absolute on-premise (Raspberry Pi, Synology) > European (Hetzner, Netcup, Hostinger EU) > global cloud (DO, AWS, GCP, Fly.io). All self-hosted options beat n8n Cloud on user control.

### Head-to-Head Verdicts

**Hostinger vs. Digital Ocean/AWS/GCP:** Hostinger wins for the target audience — one-click install bypasses the 8–10-step provisioning AWS/GCP/DO require. DO/AWS only win for technical users needing fine-grained control.

**Railway vs. Render:** Railway wins. Render's free tier wipes data after 15 min of inactivity — disqualifying. Railway's official n8n template (n8n + Redis + Postgres) is more robust. Railway's usage billing is the caveat.

**Amazon AWS vs. Render (free tiers):** AWS wins. EC2's 12-month tier is true 24/7. Render sleeps and wipes.

**Hostinger vs. Railway:** Hostinger wins for the target audience. Fixed $8.99–9.99/mo, n8n-specific support, custom hPanel beat Railway's generalist PaaS and volatile usage bills. Railway wins only for GitHub-native developers or intermittent workloads.

**Hetzner + Coolify vs. Hostinger:** Hostinger wins for non-technical users. Hetzner+Coolify (~$8–10/mo) is the technical-user sweet spot but requires Hetzner account verification (often rejected) and VPS comfort.

**Netcup vs. Contabo:** Netcup wins on performance. Dedicated cores eliminate the noisy-neighbor jitter that breaks n8n on Contabo, at similar cost.

**Oracle vs. Google Cloud (free tiers):** Oracle gives 12x RAM (24GB vs 2GB) and 6.6x storage (200GB vs 30GB) free — and a much higher probability of losing it. GCP is more reliable; Oracle more powerful.

**Raspberry Pi vs. Synology NAS:** Both expert-only. Synology wins if a capable NAS (Plus series) already exists; Pi wins if buying fresh. Neither is appropriate for business-critical automation.

### Rankings by Use Case

- **Beginners / non-technical:** Hostinger.
- **Best PaaS:** Railway.
- **Full control (experts):** Digital Ocean.
- **Best free (technical):** Amazon AWS EC2.
- **European deployment:** Hetzner (with/without Coolify).
- **Dedicated performance on budget:** Netcup Root Servers.
- **RAM-per-dollar (with tradeoffs):** Contabo — batch only, not latency-sensitive.
- **Edge / global webhooks:** Fly.io.
- **Self-hosted PaaS layer:** Coolify on Hetzner or Hostinger.
- **Enterprise / AI-heavy:** Google Cloud.
- **AWS ecosystem:** Lightsail (simple) or EC2 (Lambda/S3/RDS).
- **Hobbyist / learning:** Raspberry Pi 5 with NVMe.
- **Existing Synology NAS owner:** Synology Container Manager.
- **"Free forever" (expert risk tolerance):** Oracle Cloud Always Free.
- **Not recommended:** Render (free tier wipes data), Heroku (highest cost, oldest architecture).

### Tier List for Target Audience (semi-technical / non-technical)
1. **Hostinger** — the definitive pick.
2. **Railway** — best PaaS alternative.
3. **Digital Ocean** — step up for users willing to learn.

All other platforms are niche, expert-only, or hostile to non-technical users.

## Gaps

- **Pricing screenshots exist only for Hostinger, Railway, and Render.** All other pricing (DO, Oracle, Heroku, Netcup, Hetzner, AWS, Contabo, Fly.io, Coolify, GCP, Pi, Synology) is from Gemini supplementary research — approximate, not authoritative. Cloud pricing changes frequently.
- **"Hiroku" profile was not extractable** from transcripts; Heroku entry here is reconstructed entirely from supplementary research and is lower confidence. Confirm whether the brief intended "Heroku" and add transcript coverage.
- **Railway pricing has no explicit dollar figures** in the screenshots. Hobby/Pro tiers are labeled usage-based without a listed base rate. Production estimates come from supplementary research.
- **Render's "plus compute costs*" is unquantified** in the screenshots — total monthly cost cannot be stated precisely.
- **Pi and Synology can't be compared apples-to-apples** with cloud platforms. Upfront hardware, electricity, home internet reliability, and UPS absence are outside the $/mo framing and need separate treatment.
- **Hetzner and Oracle both have account-verification gates** that may block many viewers before deployment. Actual acceptance rates are not documented.
