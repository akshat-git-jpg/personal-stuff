# Knowledge Base: n8n Self-Hosting Platforms

## Key Findings & Surprises

1. **The "free tier" is the single biggest trap in this niche.** Render's free plan spins down after 15 minutes of inactivity and wipes every workflow you built. Oracle Cloud's "Always Free" 24GB RAM box is actively reclaimed if you don't keep CPU and RAM usage above a minimum threshold, and accounts are banned without warning. Google Cloud's "Always Free" E2 micro gives you 2GB RAM but the 1GB monthly egress cap quietly trips billing on the first workflow that moves real files. "Free" costs more than $8.99/mo in lost automations for every non-technical user who picks it.

2. **Hostinger's KVM 2 plan gives you double the production RAM requirement at less than half the cost of the PaaS competition.** A production-grade n8n needs 4GB RAM minimum. Hostinger KVM 2 ships 8GB RAM + 2 vCPU + 100GB NVMe for $8.99/mo (24-mo) or $9.99/mo (12-mo) promotional. A matching 4GB / 2 vCPU load on Railway runs $40–60/mo, on Heroku $50–90/mo. That is a 4–10x cost gap for the same workload.

3. **Self-hosting unlocks n8n's paid Cloud features for free.** The official n8n deployer template on Railway (and the Hostinger one-click install) both give you advanced debugging, execution search and tagging, folders, and unlimited concurrent executions — features gated behind n8n Cloud's paid tiers. Self-hosting is not just cheaper; it is the only path to unlimited execution volume.

4. **Raspberry Pi looks like $0/month and isn't.** Standard micro-SD cards fail under the write-intensive load of n8n's execution log. A stable Pi 5 deployment requires an NVMe SSD + PCIe HAT, pushing upfront cost to ~$100, plus Cloudflare Tunnel or Tailscale configuration for webhooks to reach the public internet. The hardware is cheap; the setup is expert-tier.

5. **Contabo wins RAM-per-dollar and loses n8n performance.** 4 vCPU / 8GB RAM for $5–8/mo looks unbeatable, but Contabo over-provisions physical servers aggressively. n8n is single-core-bound on its event loop; "stolen CPU cycles" under noisy-neighbor load produce jittery webhook response times — the exact failure mode automation cannot tolerate.

## Software Profiles

### Hostinger

**Overview:** Managed/one-click n8n VPS on AMD EPYC + NVMe. Purpose-built templates reduce deployment to under 5 minutes with no Linux, Docker, or command-line knowledge required. The top-ranked pick for the target audience.

**Pricing** (USD, paid upfront, 30-day money-back, 24/7 support, free domain for 1 year; promotional prices require multi-year commitments):

*12-month subscription:*
- KVM 1: $6.99/mo promo (renews $12.99/mo) — 1 vCPU, 4GB RAM, 50GB NVMe, 4TB bandwidth
- KVM 2 (Most Popular): $9.99/mo promo (renews $16.99/mo) — 2 vCPU, 8GB RAM, 100GB NVMe, 8TB bandwidth
- KVM 4: $14.99/mo promo (renews $30.99/mo) — 4 vCPU, 16GB RAM, 200GB NVMe, 16TB bandwidth
- KVM 8: $28.49/mo promo (renews $53.99/mo) — 8 vCPU, 32GB RAM, 400GB NVMe, 32TB bandwidth

*24-month subscription:*
- KVM 1: $6.49/mo promo (renews $11.99/mo)
- KVM 2: $8.99/mo promo (renews $14.99/mo)
- KVM 4: $12.99/mo promo (renews $28.99/mo)
- KVM 8: $25.99/mo promo (renews $49.99/mo)

All plans include: unlimited workflows, unlimited concurrent executions, community nodes, n8n with queue mode, 100+ pre-made workflows, one-click n8n installation, Hostinger API n8n community node, MCP-powered AI assistant (Kodee), free domain for 1 year.

**Key Features:** One-click n8n template (2–5 min deploy); pre-configured Queue Mode option; pre-loaded 100-workflow option; custom hPanel dashboard for reboot, updates, domain, firewall, snapshots, Docker; Kodee AI VPS assistant; manual snapshots (automated daily backups are a paid add-on); full root/terminal access; multi-region data centers.

**Strengths:** One-click install removes all technical barriers. AMD EPYC + NVMe delivers consistent 13ms response times under load. 70–80% cheaper than n8n Cloud for equivalent resources, with no execution caps. Full data sovereignty and no vendor lock-in — workflows migrate freely. 24/7 support plus AI assistant for platform-level questions.

**Weaknesses:** User manages n8n version updates and OS/Docker security patches (unmanaged VPS). No in-app team/role management across a single n8n instance. No access to n8n Cloud's AI Workflow Builder. Headline promotional prices require multi-year upfront payment; renewal is ~50–70% more expensive.

---

### Railway

**Overview:** Modern PaaS with an official n8n deployer template (authored by the n8n team) that provisions n8n + Redis + PostgreSQL in minutes. Usage-based pricing. Best for rapid prototyping and intermittent workloads; expensive at 24/7 production load.

**Pricing** (usage-based — no fixed monthly price; costs scale per-second with CPU/RAM/disk/egress):

- **Free:** 1 project after trial, 3 services/project, up to 1 vCPU and 0.5GB RAM per service, 1GB ephemeral disk, 0.5GB volume storage, 3-day log retention. Trial bumps these to 5 projects, 2 vCPU, 1GB RAM, 50GB object storage, and 7-day log retention. $5 credit for first month (not available on newly created GitHub accounts).
- **Hobby:** 50 projects, up to 48 vCPU / 48GB RAM per service, 5GB volume storage, 1TB object storage, global regions, 7-day log retention, 3 project members.
- **Pro:** 100 projects, up to 1,000 vCPU / 1TB RAM per service, 1TB volume storage, unlimited object storage, 30-day log retention, SOC 2, granular access control, priority support.
- **Enterprise:** Custom. Unlimited projects, 5TB volume storage, 90-day logs, 18-month audit logs, SSO, HIPAA BAA, dedicated VMs, bring-your-own-cloud.

A 4GB RAM / 2 vCPU consistent 24/7 workload runs approximately $40–60/mo.

**Key Features:** Official n8n deployer template auto-configures Redis + PostgreSQL; GitHub-based CI/CD deploys; custom domains with automatic SSL; persistent volumes; vertical and horizontal (replica) autoscaling; real-time project canvas; 3,000 IOPS; log filtering and structured logging; preview environments.

**Strengths:** Fastest repo-to-production path in the category (setup complexity 1/10). Zero-maintenance infrastructure. Template includes paid n8n features (advanced debugging, folders) at no extra cost. "Railway Metal" hardware migration improves latency over third-party clouds.

**Weaknesses:** Usage-based pricing is volatile — a workflow spike can materially change the bill. 1GB disk on Free/Trial is a non-starter for production. 24/7 production costs are 4–6x a comparable VPS. Less fine-grained control than a raw VPS.

---

### Render

**Overview:** Managed PaaS with fixed server sizes, Git-based deploys, persistent SSD volumes, and managed databases. Conceptually a Heroku modernization. The Free plan is a trap for n8n.

**Pricing** (USD, per user/month, plus compute costs prorated to the second):

- **Hobby:** $0/user/month + compute. Full-stack deploys, managed datastores, custom domains, global CDN, email support.
- **Professional:** $19/user/month + compute. 500GB bandwidth included, 10 team members, unlimited projects/environments, horizontal autoscaling, preview environments, private link, chat support.
- **Organization:** $29/user/month + compute. 1TB bandwidth, unlimited members, audit logs, SOC 2 Type II, ISO 27001.
- **Enterprise:** Custom. SAML SSO/SCIM, guaranteed uptime, premium support.

Typical n8n production runs ~$25–45/mo (4GB RAM instance + managed Postgres/Redis). Bandwidth overages charged at $15 per 100GB. VC-funded startups can get up to $100K in credits.

**Key Features:** Docker-image deploys (pulls official n8n image); managed Postgres/Redis; persistent SSD volumes; custom domains + global CDN; zero-downtime deploys; GitHub/GitLab auto-deploy; horizontal autoscaling; separate web + worker service model for Queue Mode; environment variable management.

**Strengths:** 1–5 minute deploy from Docker image. Persistent disks survive restarts. Fixed server sizes give predictable compute behavior. Strong compliance tier (SOC 2, ISO 27001) at Organization.

**Weaknesses:** **Free plan is unusable for n8n** — services sleep after 15 minutes of inactivity and all data is wiped. Compute cost is additional to the user/month fee, making total cost opaque. Bandwidth overages ($15/100GB) punish heavy workflows. Cold starts on lower tiers drop webhooks.

---

### Digital Ocean

**Overview:** Developer-standard VPS ("Droplets") with full root access, industry-standard documentation, and predictable flat monthly pricing. The professional middle ground between AWS and PaaS.

**Pricing** (no pricing screenshots — figures from supplementary research):
- Smallest plan: ~$4/mo.
- Common long-term plan: ~$12/mo.
- Production config (2 vCPU, 4GB RAM Premium Intel/AMD Droplet): ~$24/mo.
- Backups: +20% on top of Droplet cost.

**Key Features:** Droplets with full root access and region/OS selection; one-click n8n marketplace image; managed Redis + Postgres available; Load Balancers (horizontal) and resize (vertical) scaling; SSD-backed storage + optional Block Storage Volumes; global data centers (NYC, SFO, AMS, FRA, LON, TOR, BLR, SIN).

**Strengths:** Extremely stable infrastructure with predictable flat monthly billing. Best-in-class documentation, making n8n configuration/troubleshooting straightforward. Generous bandwidth prevents egress surprises. Developer-friendly without AWS complexity.

**Weaknesses:** Setup requires console, SSH, Docker, Nginx reverse proxy, and Certbot knowledge — not suitable for non-technical users. Backups are a 20% add-on. SSD storage is not as fast as NVMe-first providers. No managed auto-healing for individual Droplets.

---

### Amazon AWS (Lightsail & EC2)

**Overview:** The infrastructure giant. Lightsail bundles compute/storage/transfer into a flat VPS; EC2 offers 400+ instance types with full networking control. Free tier (EC2 t-series, 750 hrs/mo for 12 months) is the strongest "free" option for a technical user.

**Pricing** (no pricing screenshots; supplementary research):
- Lightsail $20 plan or EC2 t4g.medium: ~$20–35/mo.
- EC2 free tier: 750 hrs/mo for 12 months, no sleeping, no cold starts.

**Key Features:** EC2 resizable VMs; Lightsail predictable-fee VPS; Docker support; key pairs + Security Groups for SSH and port 5678; unlimited scaling; Queue Mode with Amazon RDS (Postgres) + ElastiCache (Redis); EBS persistent storage; global region coverage.

**Strengths:** 12-month EC2 free tier with true 24/7 uptime is the best "free" path for technical users. Unrivaled reliability and global reach. Lightsail is pricing-predictable. Deep integration with Lambda, S3, RDS.

**Weaknesses:** EC2 has a steep learning curve — VPC, IAM, Security Groups, and Docker all required. Egress costs are punitive and frequently exceed server cost on file-heavy workflows. Lightsail plans can be upgraded but not downgraded. Overkill for a single-app deployment.

---

### Google Cloud (GCE)

**Overview:** Enterprise-grade Compute Engine with industry-leading networking and deep AI/ML integration. Always-Free tier is the most powerful free option but requires precise configuration to avoid billing.

**Pricing** (no pricing screenshots; supplementary research):
- Always Free E2 micro: 2 vCPU, 2GB RAM, 30GB storage (must be manually raised from 10GB default), static IP — $0 if configured correctly.
- Production e2-medium (2 vCPU, 4GB RAM) + persistent disk + egress: ~$25–35/mo.
- New customers: $300 in free credits (time-limited).

**Key Features:** Compute Engine VMs; high-performance Persistent Disks with snapshots; VPC Firewall Rules; static IP; Docker/Docker Compose; Nginx + Certbot recipe for HTTPS; Cloud SQL + Memorystore for Queue Mode; Managed Instance Groups for autoscaling.

**Strengths:** Enterprise reliability and networking. E2-medium is the RAM/CPU sweet spot for stable production n8n. Deep AI/ML ecosystem integration for AI-heavy workflows. Industry-leading horizontal scaling.

**Weaknesses:** E2 micro's 2GB RAM makes n8n "lag" — it is a testing sandbox, not production. 1GB monthly egress cap on Free Tier triggers billing on trivial workloads. Snapshots and observability incur extra costs and must be manually disabled to stay free. Requires Nginx, Certbot, VPC, IAM knowledge — not for non-technical users. Billing account and payment method are required even for the free tier.

---

### Oracle Cloud (OCI)

**Overview:** The most generous free tier in the cloud industry — and the most dangerous. Rewards expert users with $40–60/mo worth of free ARM compute; punishes them with random terminations.

**Pricing:** No pricing screenshots.
- Always Free: up to 4 ARM Ampere vCPUs, 24GB RAM, 200GB block storage — $0/mo.
- Paid tier available for upgraded availability.

**Key Features:** ARM Ampere vCPUs (4 total across free instances); 24GB RAM allowance; 200GB persistent block storage; Queue Mode fully supported by the RAM headroom.

**Strengths:** Resources equivalent to $40–60/mo on other platforms at no cost. ARM architecture is high-performance. 200GB of free block storage is uniquely generous.

**Weaknesses:** Registration is notoriously difficult with high rejection rates. Idle instances are reclaimed without warning if CPU/RAM usage falls below a minimum threshold. Random account bans are documented. Complex networking, IAM, and iptables configuration (setup complexity 8/10). Free Tier availability is regionally constrained.

---

### Heroku

**Overview:** The PaaS veteran. Mature platform, stable, and expensive — n8n on Heroku is mostly an enterprise-continuity decision, not a cost or ease-of-use decision. (Listed as "Hiroku" in the niche brief; no transcript data was extracted for this profile, so this entry is sourced from supplementary research and should be treated as lower-confidence than the other profiles.)

**Pricing** (supplementary research):
- Standard-2X Dynos + Postgres + Redis add-ons: ~$50–90/mo.
- No permanent free tier.

**Key Features:** Git-push deploy workflow; large marketplace of one-click add-ons; vertical (Dyno tier) and horizontal (Dyno count) scaling; native Queue Mode via additional worker Dynos; mature Common Runtime (US/EU) with Private Spaces in Canada/India.

**Strengths:** Extremely mature and stable. Seamless Salesforce ecosystem integration. Git-push simplicity remains best-in-class.

**Weaknesses:** Highest production cost in the comparison. Ephemeral filesystem — all persistent data must move to Heroku Postgres or external object storage. Aging architecture relative to Railway/Render.

---

### Netcup

**Overview:** German provider offering "Root Servers" — guaranteed dedicated CPU cores at VPS prices. The power-user pick for consistent, jitter-free n8n performance.

**Pricing** (no pricing screenshots; supplementary research):
- RS 1000 G12 (4 dedicated vCPU, 8GB RAM, 256GB NVMe): ~$8–12/mo on a 6–12 month commitment.

**Key Features:** Dedicated AMD EPYC CPU cores (no noisy-neighbor degradation); RAID-10 NVMe/SSD storage; 2.5 Gbps networking; data centers in Nuremberg (DE), Vienna (AT), Amsterdam (NL), Manassas (US), Singapore.

**Strengths:** Best performance-per-dollar for technical users. Guaranteed dedicated cores eliminate jitter in webhook response times. RAID-10 NVMe for reliability. European data compliance.

**Weaknesses:** "90s-style" control panel — difficult for non-technical users. 6–12 month billing cycles with 30-day cancellation notice. No specialized n8n templates (standard Linux VPS setup, 6/10 complexity). Support is not 24/7.

---

### Hetzner

**Overview:** European cloud with modern UI, hourly billing, and ARM cloud instances that pair exceptionally well with n8n Queue Mode. The gold standard for European deployments.

**Pricing** (no pricing screenshots; supplementary research):
- CAX21 (4 ARM vCPU, 8GB RAM, 80GB NVMe): ~$7–10/mo.

**Key Features:** ARM Ampere vCPUs; NVMe SSD standard on all cloud instances; modern cloud console; hourly billing; seamless vertical scaling; snapshot backups; data centers in Nuremberg, Falkenstein, Helsinki, Ashburn, Hillsboro.

**Strengths:** Best-in-class UI. Exceptional ARM price-to-performance for Queue Mode parallel workers. Predictable hourly billing. European data sovereignty.

**Weaknesses:** Aggressive account verification — new accounts are frequently rejected, which blocks many users before deployment. Support restricted to European business hours. Setup complexity 6/10 (standard Docker/Linux, no n8n templates).

---

### Contabo

**Overview:** Maximum RAM and CPU for minimum dollars, with the tradeoff in consistency rather than headline specs.

**Pricing** (no pricing screenshots; supplementary research):
- VPS S (4 vCPU, 8GB RAM, 50GB NVMe): ~$5–8/mo.

**Key Features:** High-RAM VPS; NVMe storage; Queue Mode supported; data centers in DE, US, UK, SG, AU, JP.

**Strengths:** Unbeatable spec-per-dollar ratio. Excellent for memory-intensive JSON/data-scraping workloads.

**Weaknesses:** Physical servers are over-provisioned; noisy-neighbor "stolen CPU cycles" and high disk latency at peak hours directly hurt n8n's single-core-bound node execution. Slow technical support. Older infrastructure.

---

### Fly.io

**Overview:** Edge-native platform that converts Docker containers into Firecracker micro-VMs distributed across 30+ regions. Best for globally distributed webhook intake.

**Pricing** (no pricing screenshots; supplementary research):
- 4GB RAM shared-CPU + persistent volume: ~$25–40/mo.

**Key Features:** Docker → Firecracker micro-VMs; flyctl CLI management; 30+ global regions across NA, EU, Asia, AU, SA; NVMe-backed Fly Volumes (region-locked); Queue Mode with cross-region Redis/Postgres.

**Strengths:** Edge execution for low-latency global webhook intake. High-performance micro-VMs. Granular scaling across regions.

**Weaknesses:** Steep learning curve — flyctl-only management, no GUI. Volumes are tied to specific regions and must be manually migrated when changing regions. Cross-region Queue Mode requires careful Redis/Postgres orchestration.

---

### Coolify

**Overview:** Open-source self-hosted PaaS that wraps a VPS in a Railway/Heroku-like UI. Not a hosting provider — a management layer on top of one.

**Pricing:** Software is free. Cost is the underlying VPS (~$7/mo at Hetzner).

**Key Features:** Self-hosted PaaS dashboard on any VPS; automated Let's Encrypt SSL; Docker Compose management; integrated monitoring + automated backups; one-click n8n install; multi-server management via Docker Swarm; persistent storage on host.

**Strengths:** PaaS convenience at VPS prices — handles SSL, domains, and backups automatically. Open-source transparency. Good pairing with Hetzner or Hostinger VPS.

**Weaknesses:** Adds ~1GB RAM overhead for its own management/monitoring stack. User still owns underlying VPS security and initial setup.

---

### Raspberry Pi 5

**Overview:** Always-on local host for personal/hobbyist n8n. Zero monthly fees; expert-tier setup. Not a production platform.

**Pricing:** ~$100 upfront (Pi 5 + NVMe HAT + SSD). $0/mo + power.

**Key Features:** Local always-on hardware; 4GB or 8GB RAM models; supports Queue Mode (constrained by single-board architecture); absolute on-premise data sovereignty.

**Strengths:** Zero recurring cost. Absolute data privacy. Excellent learning platform for Docker, networking, server admin.

**Weaknesses:** Micro-SD cards fail under n8n's write-heavy database load — NVMe SSD via PCIe HAT is mandatory for stability. Requires Cloudflare Tunnel or Tailscale for public webhook access. Setup complexity 9/10. Fixed hardware specs with no upgrade path. Horizontal scaling impossible. No redundancy, no UPS, depends on home internet.

---

### Synology NAS (Docker)

**Overview:** Container Manager on an existing Synology NAS — centralizes automation with existing storage for users who already own the hardware.

**Pricing:** $0/mo if hardware already owned.

**Key Features:** Synology Container Manager; RAID storage redundancy; always-on NAS uptime; Queue Mode supported (CPU-bound by NAS model); fully on-premise.

**Strengths:** No additional hardware cost if a Synology NAS is in place. Strong RAID-backed redundancy. Centralized with existing storage.

**Weaknesses:** Strict ACL system causes frequent "EACCES: permission denied" errors during n8n setup, requiring SSH access and manual folder ownership changes. Container Manager GUI restricts advanced container modification. Outdated Docker binaries. Fixed NAS CPU/RAM limits Queue Mode worker count. Setup complexity 8/10.

## Comparative Analysis

### Ease of Setup

1. **Hostinger** — 2/10. One-click n8n template, custom hPanel, Kodee AI assistant. Deploy in 2–5 minutes with no command line.
2. **Railway** — 1/10 for the template itself. Official n8n deployer template provisions n8n + Redis + Postgres from a URL click.
3. **Render** — 2/10. Docker image deploy from dashboard or GitHub in 1–5 minutes.
4. **Coolify** — 3/10 after the initial VPS setup; one-click n8n install from the Coolify dashboard.
5. **Heroku** — 3/10. Git-push workflow plus marketplace add-ons.
6. **Digital Ocean** — 4/10. Marketplace one-click image plus SSH/Docker/Nginx/Certbot.
7. **AWS (Lightsail)** — 5/10. **AWS (EC2)** — 8/10 due to VPC/IAM/Security Groups.
8. **Contabo / Hetzner / Netcup** — 5–6/10. Standard Linux VPS; no n8n-specific templates.
9. **Fly.io** — 7/10. flyctl CLI, region-locked volumes.
10. **Google Cloud** — 7/10. VPC, IAM, Nginx, Certbot required.
11. **Synology NAS** — 8/10. GUI looks easy until ACL permission errors appear.
12. **Oracle Cloud** — 8/10. Difficult registration, iptables, IAM.
13. **Raspberry Pi** — 9/10. OS install, Docker, home networking, Cloudflare Tunnel/Tailscale.

### Speed & Performance

Hostinger's KVM 2 (2 vCPU, 8GB RAM, AMD EPYC + NVMe) is the consistent performance leader for the target audience, cited for handling "unlimited" workflows and dozens of concurrent automations at ~13ms response times. Hetzner's ARM cloud instances and Netcup's dedicated-core Root Servers match or exceed this for technical users, with Netcup uniquely immune to noisy-neighbor jitter. Railway and Render deliver stable performance on paid tiers only. Google Cloud's E2 micro (2GB RAM) on the free tier is underpowered and causes n8n to lag. Render's free plan is not viable — inactivity shutdown wipes all data. Contabo's oversubscription produces CPU jitter that hurts single-core-bound n8n node execution, regardless of headline RAM numbers.

### Price & Value

**Hostinger is the best overall value** for the target audience. KVM 2 at $8.99/mo (24-mo) or $9.99/mo (12-mo) is a flat, predictable cost with 8GB RAM, NVMe, and one-click n8n installation — 4–10x cheaper than PaaS equivalents (Railway $40–60/mo, Heroku $50–90/mo, Render $25–45/mo) for the same 4GB RAM workload target.

**Best "free" tiers, ranked for real-world usefulness:**
1. **Amazon AWS** — 12-month EC2 free tier, true 24/7 uptime, no sleep. Best for a technical user.
2. **Oracle Cloud** — 24GB RAM free forever if you can register and stay non-idle. Highest ceiling, highest risk of termination.
3. **Google Cloud** — E2 micro lag + 1GB egress trap; good for learning, not production.
4. **Railway** — $5 credit, and only for accounts old enough to qualify.
5. **Render** — Free plan is a trap; data is wiped on every 15-minute idle period.

**The promotional-pricing trap on VPS providers:** Hostinger's headline $6.99/mo requires 12 months paid upfront and renews at $12.99/mo. KVM 2 renews at $14.99/mo (24-mo) or $16.99/mo (12-mo). Still cheaper than every PaaS, but not the promo number.

### Ease of Use for Non-Technical Audiences

Hostinger is the unambiguous winner: no Linux, no Docker, no CLI, no reverse proxy. Railway and Render are the tolerable middle. DigitalOcean, AWS, GCP, Oracle Cloud, Hetzner, Netcup, Contabo, Fly.io, Raspberry Pi, and Synology all require command-line competence and are not recommended for the target audience.

### Support Quality

Hostinger leads with 24/7 human support plus the Kodee AI assistant. DigitalOcean, AWS, and GCP are essentially self-serve through documentation unless you pay for premium support plans. Hetzner support is European business hours. Netcup and Contabo have slower, non-24/7 support. n8n itself does not support any self-hosted instance — platform support quality is the only safety net for non-technical users.

### Data Sovereignty & Privacy

Absolute on-premise (Raspberry Pi, Synology NAS) > European (Hetzner, Netcup, Hostinger EU regions) > Global cloud (DigitalOcean, AWS, GCP, Fly.io). All self-hosted options give the user full control compared to n8n Cloud.

### Head-to-Head Verdicts

**Hostinger vs. Digital Ocean / AWS / GCP:** Hostinger wins decisively for the target audience. One-click install bypasses the 8–10-step server-provisioning workflow that DigitalOcean, AWS, and GCP all require. Digital Ocean and AWS are only superior for technical users who need fine-grained infrastructure control.

**Railway vs. Render:** Railway wins. Render's free tier wipes data after 15 minutes of inactivity — disqualifying it for the category. Railway's official n8n template (n8n + Redis + Postgres) is more robust than Render's manual Docker setup. Railway's usage-based pricing is the only real caveat and requires monitoring.

**Amazon AWS vs. Render (free tiers):** AWS wins. EC2's 12-month free tier delivers 24/7 uptime. Render's free server sleeps and wipes data. For a technical user willing to set up EC2, AWS is the best free starting point in the category.

**Hostinger vs. Railway:** Hostinger wins for the target audience. Fixed $8.99–9.99/mo pricing, n8n-specific support, and a custom hPanel beat Railway's generalist PaaS model and volatile usage-based bills. Railway is only superior for developers deploying directly from GitHub or for genuinely intermittent workloads.

**Hetzner + Coolify vs. Hostinger:** Hostinger wins for non-technical users. The Hetzner + Coolify combo (~$8–10/mo total) is the technical-user sweet spot: PaaS ergonomics on top of a premium VPS. It requires Hetzner account verification (which frequently rejects new accounts) and comfort with VPS-level setup.

**Netcup vs. Contabo:** Netcup wins on performance for technical users. Dedicated cores eliminate the noisy-neighbor jitter that makes Contabo unreliable for single-core-bound n8n node execution, at a similar price point.

**Oracle Cloud vs. Google Cloud (free tiers):** Oracle Cloud gives you 12x more RAM (24GB vs 2GB) and 6.6x more storage (200GB vs 30GB) for free. It also gives you a much higher probability of losing it to idle-reclamation or a random account ban. GCP is the more reliable free tier; Oracle is the more powerful one.

**Raspberry Pi vs. Synology NAS:** Both are expert-only on-premise options. Synology wins if the NAS already exists and has a strong CPU (Plus series); Pi wins if hardware must be purchased fresh. Neither is appropriate for business-critical automation.

### Rankings by Use Case

- **Best for beginners & non-technical users:** Hostinger. One-click installation, 24/7 support, flat pricing.
- **Best PaaS experience:** Railway. Official n8n template, fastest repo-to-production path.
- **Best for full control (technical experts):** Digital Ocean. Full flexibility, industry-standard docs, predictable flat pricing.
- **Best free option (technical users):** Amazon AWS (EC2). 12-month free tier with real 24/7 uptime.
- **Best European deployment:** Hetzner (with or without Coolify).
- **Best dedicated performance on a budget:** Netcup Root Servers.
- **Best RAM-per-dollar (with tradeoffs):** Contabo — acceptable for memory-heavy batch workloads, unreliable for webhook-latency-sensitive workflows.
- **Best for edge / globally distributed webhooks:** Fly.io.
- **Best self-hosted PaaS layer:** Coolify on Hetzner or Hostinger VPS.
- **Best enterprise / AI-integrated:** Google Cloud.
- **Best for AWS ecosystem users:** Lightsail for simplicity, EC2 for Lambda/S3/RDS integration.
- **Best hobbyist / learning:** Raspberry Pi 5 with NVMe.
- **Best if you already own a Synology NAS:** Synology Container Manager (with ACL patience).
- **Best "free forever" (expert risk tolerance):** Oracle Cloud Always Free — 24GB RAM at the cost of possible termination.
- **Not recommended for this niche:** Render (free tier wipes data), Heroku (highest cost with oldest architecture).

### Tier List for Target Audience (semi-technical / non-technical)

1. **Hostinger** — the definitive pick.
2. **Railway** — best PaaS alternative.
3. **Digital Ocean** — best step up if the user is willing to learn.

All other platforms are niche fits, expert-only, or actively hostile to non-technical users.

## Gaps

- **Pricing screenshots are only available for Hostinger, Railway, and Render.** Pricing for Digital Ocean, Oracle Cloud, Heroku ("Hiroku" in brief), Netcup, Hetzner, Amazon AWS, Contabo, Fly.io, Coolify, Google Cloud, Raspberry Pi, and Synology NAS Docker is drawn from Gemini supplementary research and should be treated as approximate rather than authoritative. Cloud pricing in particular changes frequently.
- **"Hiroku" profile was not extractable** from transcripts — the Heroku entry here is reconstructed entirely from supplementary research and is lower confidence than the other profiles. Recommend confirming whether the brief intended "Heroku" and, if so, adding transcript coverage.
- **Railway pricing has no explicit dollar figures in the screenshots.** The free tier shows only resource limits. Hobby and Pro tiers are labeled usage-based without a listed base rate. Production cost estimates ($40–60/mo for a 4GB workload) come from supplementary research.
- **Render's "plus compute costs*" is unquantified in the screenshots.** The $19 and $29 per-user/month fees are clear, but the compute add-on is only described as "prorated to the second" — total monthly cost cannot be stated precisely from pricing sources alone.
- **Raspberry Pi and Synology NAS cannot be compared apples-to-apples with cloud platforms.** Upfront hardware cost, electricity, home internet reliability, and UPS/redundancy absence are not captured in the "$/month" framing and require separate treatment in the video script.
- **Hetzner and Oracle Cloud both have account-verification/approval gates** that may disqualify many viewers before they can deploy. Actual acceptance rate for new accounts is not documented.
