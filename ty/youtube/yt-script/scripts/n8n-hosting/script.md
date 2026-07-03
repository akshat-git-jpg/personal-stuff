# Best n8n Self-Hosting in 2026 — 15 Platforms Ranked (Honest Verdict)

~18–19 minutes spoken.

---

## HOOK

n8n is completely free to use. So why are so many people spending $80 a month to run it?

Some pick a platform that sounds great — and get a surprise bill they never saw coming. Some go with the cheapest option — and lose every workflow they built when the server quietly gives up one day. And some spend an entire weekend trying to set up something that should have taken 15 minutes.

I went through all 15 of the most popular ways to host n8n, and I sorted every single one of them — so you don't have to guess.

The right host depends on who you are. Let's go.

---

## INTRO

I've sorted every platform into four categories.

**Eliminated** — these have a serious problem. I'll show you exactly what goes wrong so you don't make a costly mistake.

**Situational** — these work, but only in one specific scenario. You'll know in ten seconds if that's you.

**Worth Considering** — solid options that didn't quite make the top.

And **The Winners** — the four I'd actually recommend. That's where I'll spend the most time.

Whether you're automating your YouTube channel, running your business on autopilot, or just saving yourself hours of repetitive work every week — by the end of this you'll know exactly where to run n8n.

Let's start with the ones to avoid. And more importantly, why.

---

## ELIMINATED: Heroku

Heroku works. The problem is you're paying $50 to $90 every single month for something that costs under $10 elsewhere. Over a year that's hundreds of dollars extra — for a platform that has no feature specifically useful for running n8n. You'd be paying a premium for a familiar name.

Don't do it. There are far better options on this list.

---

## ELIMINATED: Contabo

Contabo sells impressive specs at a low price — 4 CPUs, 8 gigs of RAM, under $8 a month. The catch is how they deliver those specs cheaply: they pack hundreds of customers onto the same physical server. Your automation speed ends up depending on what everyone else on that server is doing at that moment.

And here's why that matters for n8n specifically. n8n runs on a single CPU core at a time. When the server gets crowded, your workflows slow down or stall — and you can't fix it, because the problem isn't yours to fix.

The cheap price is not worth that risk. Skip it.

---

## ELIMINATED: Oracle Cloud

Oracle's Always Free tier offers 24 gigs of RAM, four ARM CPUs, and 200 gigs of storage — all for zero dollars. That sounds impossible. In practice, it almost is.

Oracle reclaims any server they decide is idle, and their definition of idle doesn't match yours. People running active n8n workflows have had their servers terminated without warning. One morning you open your laptop, trigger an automation, and everything is gone. Every workflow, every connection, every piece of data — deleted. With no backup and no appeal.

Free is not free if it can disappear overnight. Don't build on this.

---

## ELIMINATED: Google Cloud Free Tier

Google Cloud's Always Free tier includes an E2 micro server for zero cost. But it has a hard cap on how much data can leave that server each month — one gigabyte. That sounds like a lot, until you realise that every single time n8n does anything, data leaves the server.

Most people hit that cap within days. The moment you cross it, automatic billing kicks in — and Google Cloud's billing is notoriously complex. People have checked their account to find charges in the hundreds, for workflows they thought were running free.

A platform that bills you unexpectedly is not a platform you can trust. Eliminated.

---

## ELIMINATED: AWS EC2

AWS EC2 is a professional-grade platform designed for engineering teams managing large fleets of servers. To run a single n8n instance on it, you have to pick from over 400 server types, configure your own networking, set up permission policies, and manage data transfer costs that can quietly exceed what you pay for the server itself.

Don't use a forklift when you need a trolley. Eliminated.

---

## ELIMINATED: Fly.io

Fly.io is a technically clever platform — but it's built entirely around a command-line tool. No visual dashboard. Every deployment, every change, every fix happens through typed commands. And Fly's file storage is locked to one region, which means migrating later means rebuilding from scratch. There are better-performing options at the same price.

Move on.

---

## ELIMINATED: Render

Render's free plan looks like the easiest way to get started. It isn't. The server goes to sleep after 15 minutes of inactivity — and when it sleeps, every workflow you built gets wiped. Not paused. Wiped.

The paid plans remove that issue, but the billing works by charging you separately for compute usage on top of the plan price — so your monthly total is hard to predict until the bill arrives.

Eliminated.

---

## SITUATIONAL: Raspberry Pi 5

If you already own a Raspberry Pi 5 and you want to run n8n for personal use — home automations, hobby projects, learning the tool — this is actually a capable setup. Monthly cost after the hardware is basically zero.

But there's one thing you cannot skip. n8n writes to its database constantly — every workflow, every action, logged in real time. A regular micro-SD card is not built for that load. It wears out and fails silently. One day your workflows just stop and your data is gone. You need an NVMe SSD on a PCIe adapter — roughly a hundred dollars upfront — and you need Cloudflare Tunnel or Tailscale to receive webhooks from the outside world.

Great for personal tinkering. Not for a business that depends on it.

---

## SITUATIONAL: Synology NAS

If you already own a Synology NAS that's always running, you can add n8n to it through Docker. No extra hardware cost, good storage reliability, RAID redundancy built in.

The catch is that Synology's permission system blocks n8n from writing its own files by default. Fixing it means SSH access — connecting to the NAS through a command line and manually adjusting settings. If that's unfamiliar territory, this option will cause more frustration than it's worth. Best for advanced users who already own a capable Synology.

---

## SITUATIONAL: AWS Lightsail

Lightsail is Amazon's simplified cloud platform — flat monthly pricing, strong global reliability, around $20 to $35 a month for a proper n8n setup. The infrastructure is genuinely solid.

But it only makes sense if you're already using other Amazon services for your business and you want everything under one bill. If that isn't you — the platforms coming up give you equal reliability for less money with easier setup.

---

## WORTH CONSIDERING: Netcup

Netcup is a German provider popular with technical users who want dedicated, consistent performance. Their Root Servers give you CPU cores that aren't shared with other customers — your workflows run at the same speed regardless of time of day. Around $8 to $12 a month for a very strong spec: four dedicated cores, 8 gigs of RAM, 256 gigs of NVMe storage.

The tradeoff is the experience. The control panel looks like it was designed in the 90s. Billing locks you in for 6 to 12 months at a time. And there's no one-click n8n template — setup is fully manual. Great for technical users who want maximum consistent performance per dollar. Link's in the description if you want to take a look.

---

## WORTH CONSIDERING: Hetzner

Hetzner is probably the most recommended server provider in the developer community right now. Modern dashboard, excellent ARM performance, around $7 to $10 a month for a spec that matches platforms charging five times more.

The one friction point is account verification. Hetzner rejects new accounts more often than you'd expect — sometimes with no explanation. Support is mostly available during European business hours. Most people eventually get through, but that barrier is enough to keep it just outside the top tier. If you're in Europe, absolutely worth trying. Link's in the description.

---

## WINNER #1 — HOSTINGER

That's everything worth knowing about the platforms that didn't make the top. Now — these are the four I'd actually recommend.

The first winner — and the one I'd recommend to most people watching this — is Hostinger.

Start with price. The plan you want is called KVM 2. Two CPUs, eight gigs of RAM, a hundred gigs of NVMe storage — for $8.99 a month on the two-year plan. That's the same computing power that runs $40 to $60 on Railway, or $50 to $90 on Heroku. Over a year, hundreds of dollars staying in your pocket.

What actually separates Hostinger is how fast you go from signing up to having n8n running. They built a pre-configured n8n template — everything already set up, ready to go. Click deploy, wait a few minutes, and you have a live instance. No configuration files, no command line, no guesswork. Most people are up in under 15 minutes.

Managing it afterwards is just as easy. Their built-in AI assistant — called Kodee — handles maintenance through plain conversation. Need a backup? Ask. Want a security setting changed? Tell it. You never open a terminal.

Performance holds up too. AMD EPYC processors and NVMe storage give you around thirteen-millisecond response times — whether your automations are updating a CRM the moment a lead comes in, or firing off your YouTube content distribution the second you hit publish.

One thing to be honest about. You still manage n8n version updates yourself. And the headline promo prices require multi-year payment upfront — renewals run higher than the sign-up rate. Still the cheapest option across every tier. Just not the promo number.

If you want n8n running reliably without spending a fortune or a weekend figuring it out, Hostinger is the answer. I've got an exclusive discount code linked in the description — it's the cheapest way to get started, and the link takes you straight to the right plan.

---

## WINNER #2 — RAILWAY

The second winner is for a specific type of person — someone who wants to be live as fast as possible, and who never wants to think about infrastructure again. That's Railway.

Connect your account, pick the official n8n template — which was built by the n8n team themselves — and you have a working instance with a public address and SSL already set up. Five minutes. Nothing to configure on your end. Railway handles all of it.

That template also gives you advanced features n8n charges for on their Cloud product — execution search, workflow tagging, folders, unlimited concurrent runs — completely free on your own instance.

It scales automatically, too. If your automations suddenly get very busy — a campaign goes out, hundreds of responses come in at once — Railway adjusts in real time without you doing anything.

The honest tradeoff is cost. A consistent workload runs around $40 to $60 a month — noticeably more than Hostinger. And because Railway bills by usage, that number can move. It's what you pay for zero server management.

If your time is worth more than the price difference, or you're testing ideas before committing long-term, Railway gets you live faster than anything else. The link with the best available deal is in the description.

---

## WINNER #3 — DIGITALOCEAN

The third winner is for people building something serious — a business, an agency, a system that other people depend on. That's DigitalOcean.

Around $24 a month gets you their Premium Droplet — two CPUs, four gigs of RAM, fast SSD storage. More than Hostinger, less than Railway. What you're getting is rock-solid, predictable infrastructure with a clear path to scale — and managed add-ons like a hosted database that handle pieces you'd otherwise maintain yourself.

And here's something that doesn't get mentioned enough. DigitalOcean is one of the most documented platforms on the internet. Almost any problem you could run into — someone has already solved it and written it up clearly. That community knowledge is genuinely invaluable at 11pm when something stops working and you need an answer fast.

The tradeoff: you do need to be comfortable with a Linux terminal, Docker, and basic server hygiene to set this up yourself. It's not one-click. But once it's running, nothing in this category is more stable.

If you're running automations that a business depends on — and you want a platform that grows with you confidently — DigitalOcean is the professional's choice. Link with discount in the description.

---

## WINNER #4 — COOLIFY + HOSTINGER

And the last winner is the one most people in this space don't talk about. It's called Coolify — and it's not a hosting provider at all.

Coolify is a free open-source tool that sits on top of a VPS like Hostinger and gives you a clean visual dashboard that handles everything that would otherwise require technical knowledge. SSL certificates. Automated backups. One-click deployments. All of it. Point-and-click n8n setup through a UI anyone can use.

The result: you get the same smooth experience Railway gives you — for $8.99 a month instead of $50. Coolify itself is completely free. You're just paying for the VPS underneath it.

The only thing to factor in: Coolify uses about a gig of server memory for its own system. On an 8-gig Hostinger plan — which is what I'd pair it with — you'd barely notice it.

Pair Coolify with Hostinger and you have the smartest value setup on this entire list. The Hostinger link with the discount code is in the description — that's the one to use.

---

## FINAL SUMMARY

So here's the full picture.

**Hostinger** — easiest setup, best price, built for n8n. Right for most people.

**Railway** — zero setup, live in five minutes. You pay more for that simplicity.

**DigitalOcean** — reliable, scalable, best for serious business use.

**Coolify on Hostinger** — the smartest value combination on this list.

Netcup and Hetzner are both worth your time if you're technical. Raspberry Pi and Synology work for hobby or personal projects if you already own the hardware. AWS Lightsail makes sense if you're already inside the Amazon ecosystem.

And the seven we eliminated — Heroku, Contabo, Oracle, Google Cloud's free tier, AWS EC2, Fly.io, and Render — you now know exactly why. Don't let a low price tag or a recognisable name push you toward something that will cost you more later.

---

## OUTRO

You now know which platforms are worth your time, which ones will quietly let you down, and exactly which one fits where you are right now.

Whether you're automating your YouTube channel, running your business on autopilot, or just getting started with n8n — you have everything you need to make the right call.

All the links are in the description below — and the ones for Hostinger, Railway, and DigitalOcean all include exclusive discount codes, so make sure you use those and not just the homepage. Get started today.

If you have any questions — about your specific setup, which platform fits you best, anything at all — drop them in the comments. I read every single one.

Thanks for watching. I'll see you in the next one.
