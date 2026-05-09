# Best n8n Self-Hosting in 2026 — 15 Platforms Compared, Honest Verdict

~11–12 minutes spoken.

---

## HOOK

n8n is completely free to use. So why are so many people accidentally spending $80 a month to run it?

Some pick a platform that sounds great — and get hit with a surprise bill they never saw coming. Some go with the cheapest option — and lose all their workflows because the server quietly gave up one day. And some spend an entire weekend trying to set up something that should have taken 15 minutes.

I went through all 15 of the most popular ways to host n8n — and I sorted every single one of them, so you don't have to guess.

The right host depends on who you are. And that's exactly what I'm breaking down today.

---

## INTRO

I've sorted all 15 platforms into four categories.

**Eliminated** — these have a serious problem. I'll show you exactly what goes wrong so you never make a costly mistake.

**Situational** — these work, but only in a very specific scenario. You'll know in ten seconds if that's you.

**Worth Considering** — solid options that didn't quite make the top.

And **The Winners** — the ones I'd actually recommend. These are where I'll spend the most time.

Whether you're automating your YouTube channel, running your business on autopilot, or just saving yourself hours of repetitive work every week — by the end of this you'll know exactly where to run it.

Let's start with the ones to avoid — and more importantly, why.

---

## ELIMINATED: Heroku

Heroku works. The problem is you're paying $50 to $90 every single month for something that costs under $7 elsewhere. That's not a small difference — over a year you're spending close to $900 for something that should cost you $84. There is no feature on Heroku that justifies that gap when you're running n8n. You'd be paying a premium for a name.

Don't do it. There are far better options on this list.

---

## ELIMINATED: Contabo

Contabo advertises impressive specs at a low price — and people fall for it constantly. The way they deliver those specs cheaply is by fitting as many customers as possible onto the same physical machine. What that means for you is that your server's speed depends on what hundreds of other people are doing at that exact moment. Your automation could be running a time-sensitive task — sending a campaign, processing payments, posting content — and it just slows to a crawl because someone else on that server is doing something heavy.

You don't get a warning. You don't know it's happening. Your workflows just fail silently or respond too slowly to be useful. And you can't fix it because the problem isn't yours to fix — it's baked into how they operate.

The cheap price is not worth that risk. Skip it.

---

## ELIMINATED: Oracle Cloud Free Tier

Oracle's free tier offers genuinely powerful resources — and the price is zero. That sounds perfect until you understand what actually happens in practice. First, a large number of people never even get an approved account — Oracle rejects applications with no clear explanation and no appeal process. But here's the real problem for anyone who does get in: Oracle has a policy of reclaiming "idle" servers. And their definition of idle doesn't match yours. People running active n8n instances — workflows firing every day — have had their servers terminated without warning because Oracle decided the resource wasn't being used enough by their metrics.

One morning you open your laptop, go to trigger an automation, and it's just gone. Every workflow, every connection, every piece of data you built — deleted. With no backup, no warning, and no way to get it back.

Free is not free if it can disappear overnight. Don't build on this.

---

## ELIMINATED: Fly.io

Fly.io is a technically impressive platform — but it is built entirely around a command line tool. There is no real visual dashboard. Every deployment, every configuration change, every troubleshooting step happens through typed commands. If you make one mistake in that process, your n8n setup breaks — and figuring out what went wrong requires the same technical knowledge that got you into the problem in the first place. Even developers who know what they're doing report that setting up n8n specifically on Fly.io takes significantly more effort than it should, with better-performing options available at the same price.

Not worth the complexity. Move on.

---

## ELIMINATED: Google Cloud Free Tier

Google Cloud's free tier has a hard limit on how much data can leave your server each month — 1GB. That sounds like a lot until you realise that n8n sends data every single time it does anything. Every automation that runs, every file it moves, every update it sends to another tool — all of that counts toward that 1GB cap. Most people hit it within days. The moment you go over, automatic billing kicks in. Google Cloud's billing system is notoriously complex, and there are countless stories of people checking their account to find charges they had no idea were accumulating. Some people have received invoices for hundreds of dollars they weren't expecting.

A platform that bills you unexpectedly is not a platform you can trust. Eliminated.

---

## ELIMINATED: AWS EC2

AWS EC2 is an enterprise platform designed for teams of engineers managing complex infrastructure at scale. To run a single n8n instance on it, you have to navigate over 400 server types, configure your own networking, set up security policies, and manage data transfer costs that can quietly end up exceeding what you pay for the server itself. People have spent full days setting this up only to find the monthly bill was double what they expected because of hidden egress charges. There are platforms on this list that give you the same reliability with none of that complexity.

Don't use a forklift when you need a trolley. Eliminated.

---

## SITUATIONAL: Raspberry Pi 5

If you already own a Raspberry Pi 5 and you want to run n8n for personal use — home automations, hobby projects, learning the tool — this is actually a capable setup. Monthly cost after buying the hardware is basically zero.

But there is one thing you cannot skip. n8n logs every single thing it does — every automation that runs, every action it takes — and writes all of that to a database constantly. A regular micro-SD card is not built for that kind of continuous writing load. It wears out and fails — silently, without warning. One day your workflows just stop and your data is gone. You need an NVMe SSD via a PCIe adapter to make this reliable.

Also keep in mind: this is a single device at home with no backup power. If electricity goes out or the hardware fails, everything stops. Great for personal tinkering — not for a business relying on it.

---

## SITUATIONAL: Synology NAS

If you already own a Synology NAS that's always running, you can add n8n to it using Docker. No extra hardware cost and solid storage reliability.

The catch is that Synology's permission system blocks n8n from writing its files by default. Fixing it requires SSH access — going into the device through a command line and manually adjusting settings. If that's unfamiliar territory, this option will cause more frustration than it's worth.

Best for advanced users who already own a higher-end Synology and are comfortable with some command-line troubleshooting.

---

## SITUATIONAL: AWS Lightsail

Lightsail is Amazon's simplified cloud platform — flat monthly pricing, excellent global reliability, around $20 to $35 a month for a proper n8n setup.

The infrastructure is genuinely solid. But it only makes sense if you're already using Amazon services for other parts of your business and want everything under one roof. Otherwise the platforms coming up give you equal reliability for less money with easier setup.

---

## WORTH CONSIDERING: Render

Render is a clean, modern managed platform. It handles SSL, deployments, and scaling automatically. Around $25 to $45 a month.

The one thing to know: on cheaper plans the server can pause during quiet periods. If someone triggers an automation after a quiet stretch — submitting a form, sending a message — that first trigger might get dropped while the server wakes up. Upgrading the plan removes that issue entirely. Solid option if you want managed simplicity without running a server yourself.

---

## WORTH CONSIDERING: Netcup

Netcup is a German provider popular with technical users who want dedicated, consistent performance. Their servers give you resources that aren't shared with other customers — your workflows run at the same speed regardless of the time of day. Around $8 to $12 a month for a very strong spec.

The tradeoff is the experience — the control panel is dated, billing locks you in for 6 to 12 months at a time, and setup is fully manual. Great for technical users who want maximum consistent performance for the money.

---

## WORTH CONSIDERING: Hetzner

Hetzner is probably the most recommended server provider in the developer community right now. Modern dashboard, excellent performance, around $7 to $10 a month.

The one friction point is account verification. Hetzner rejects new accounts more often than you'd expect, sometimes with no explanation. Support is mostly available during European business hours. Most people eventually get through — but that barrier is enough to keep it just outside the top tier. If you're in Europe, absolutely worth trying.

---

## WINNER #1 — HOSTINGER

The first winner — and the one I'd recommend to most people watching this — is Hostinger.

Let's start with price. The plan you want is called KVM 2 — 2 CPUs, 8GB of RAM, 100GB of fast storage — for under $7 a month. That's the same computing power that costs $50 on Railway or $80 on Heroku. Over a year that difference is hundreds of dollars staying in your pocket.

But what actually separates Hostinger is how fast you go from signing up to having n8n running. They built a pre-configured n8n template — everything already set up, already connected, ready to go. You click deploy, wait a few minutes, and you have a live n8n instance. Most people are up and running in under 15 minutes. No configuration files, no command line, no guesswork.

Managing it afterwards is just as easy. Their built-in AI assistant called Kodee handles maintenance through plain conversation. Need a backup? Just ask. Want to update a security setting? Tell it what you want. You never have to open a terminal.

The performance holds up consistently too. Whether your automations are updating a CRM the moment a lead comes in, or firing off your YouTube content distribution the second you hit publish — everything runs quickly and reliably.

If you want n8n running reliably without spending a fortune or a weekend figuring it out, Hostinger is the answer. I've got an exclusive discount code linked in the description — it's the cheapest way to get started and the link takes you straight to the right plan.

---

## WINNER #2 — RAILWAY

The second winner is for a specific type of person — someone who wants to be live as fast as possible without touching any infrastructure. That's Railway.

Connect your account, pick the n8n template, and you have a working instance with a public address and SSL already set up. Five minutes. Nothing to configure on your end. Railway handles all of it.

It also scales automatically. If your automations suddenly get very busy — say a campaign goes out and hundreds of responses come in at once — Railway adjusts in real time without you doing anything.

The honest tradeoff is cost. A consistent setup runs around $40 to $60 a month — noticeably more than Hostinger. It's what you pay for zero server management.

If your time is worth more than the price difference, or you're testing ideas before committing long-term — Railway gets you there faster than anything else. The link with the best available deal is in the description.

---

## WINNER #3 — DIGITALOCEAN

The third winner is for people building something serious — a business, an agency, a system that other people depend on. That's DigitalOcean.

Around $24 a month for their Premium Droplet. More than Hostinger, less than Railway. What you're getting is rock-solid, predictable infrastructure with a clear path to scale — and managed add-ons like a hosted database that handle pieces you'd otherwise maintain yourself.

And here's something that doesn't get mentioned enough. DigitalOcean is one of the most documented platforms on the internet. Almost any problem you could run into — someone has already solved it and written it up clearly. That community knowledge is invaluable at 11pm when something stops working and you need an answer fast.

If you're running automations that a business depends on and you want a platform that grows with you confidently — DigitalOcean is the professional's choice. Link with discount in the description.

---

## WINNER #4 — COOLIFY

And the last winner is the one most people in this space don't talk about. It's called Coolify — and it's not a hosting provider at all.

Coolify is a free open-source tool that sits on top of a VPS like Hostinger, and gives you a clean visual dashboard that handles everything that would otherwise require technical knowledge — SSL certificates, automated backups, deployments, all of it. One-click n8n setup. Everything managed through a UI anyone can use.

The result: you get the same smooth experience as Railway — for $7 a month instead of $50. Coolify itself is completely free. You're just paying for the VPS underneath it.

The only thing to factor in: Coolify uses about 1GB of server memory for its own system. On an 8GB Hostinger plan — which is what I'd pair it with — you'd barely notice it.

Pair Coolify with Hostinger and you have the smartest value combination on this entire list. The Hostinger link with the discount code is in the description — that's the one to use.

---

## FINAL SUMMARY

So here's the full picture.

**Hostinger** — easiest setup, best price, built for n8n. Right for most people.

**Railway** — zero setup, live in five minutes. You pay more for that simplicity.

**DigitalOcean** — reliable, scalable, best for serious business use.

**Coolify on Hostinger** — the best value combination on this list.

Render, Hetzner, and Netcup are all solid alternatives depending on your situation. The Raspberry Pi and Synology setups work well for personal projects. AWS Lightsail makes sense if you're already in the Amazon ecosystem.

And the six we eliminated — Heroku, Contabo, Oracle, Fly.io, Google Cloud's free tier, and AWS EC2 — you now know exactly why. Don't let a low price tag or a recognisable name push you toward something that will cost you more in the long run.

---

## OUTRO

You now know which platforms are worth your time, which ones will quietly let you down, and exactly which one fits where you are right now.

Whether you're automating your YouTube channel, running your business on autopilot, or just getting started with n8n — you have everything you need to make the right call.

All the links are in the description below — and the ones for Hostinger, Railway, and DigitalOcean all include exclusive discount codes, so make sure you use those and not just the regular homepage. Get started today.

If you have any questions — about your specific setup, which option fits you best, anything at all — drop them in the comments. I read every single one and I'm happy to answer.

Thanks for watching. I'll see you in the next one.
