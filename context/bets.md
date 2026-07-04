# Active Bets

This document lists the active business, content, and career bets being pursued in this repository ecosystem.

---

## 1. YouTube Niche & Software Review Channels
- **Thesis**: Create high-quality software review and search tutorials to capture search traffic and drive affiliate/digital product sales.
- **Where it lives**:
  - Research & Scripting: [pipelines/youtube/](file:///Users/kbtg/codebase/personal-stuff/pipelines/youtube/)
  - Tutorial Recording & AV Production: [pipelines/youtube/kushal-tutorial-pipeline-v2/](file:///Users/kbtg/codebase/personal-stuff/pipelines/youtube/kushal-tutorial-pipeline-v2/PIPELINE.md)
  - Video Assets/Motion Graphics: [pipelines/video/motion-graphics/](file:///Users/kbtg/codebase/personal-stuff/pipelines/video/motion-graphics/README.md)
  - Voice Conversion & TTS pipeline: [pipelines/video/voice/](file:///Users/kbtg/codebase/personal-stuff/pipelines/video/voice/README.md)
- **Status & Metrics**:
  - Live Channel Analytics Dashboard: [yt-analytics](https://yt-analytics.agrolloo.com) (wired to `clicks-db` and YT Data API)
  - Competitor Opportunities: [pipelines/youtube/keyword-research/](file:///Users/kbtg/codebase/personal-stuff/pipelines/youtube/keyword-research/CLAUDE.md)
- <!-- TODO(owner interview): Clarify target metrics, upload frequency targets, and specific channel handles. -->

---

## 2. Pinterest Digital Products
- **Thesis**: Publish and promote PDFs and digital products in lifestyle niches (such as Keto and Wedding Planner brands) using automated Pinterest pins and landing page funnels.
- **Where it lives**:
  - Funnel assets, scripts & pins: [pipelines/pinterest/](file:///Users/kbtg/codebase/personal-stuff/pipelines/pinterest/PLAN.md)
  - Deployable landing pages: `apps/pinterest-landing-pages/`
  - Main brand domains: `bridebestie.com`, `keto-kitchen.ag` (see [my-hosted-sites.md](file:///Users/kbtg/codebase/personal-stuff/my-hosted-sites.md))
- **Status & Metrics**:
  - Income tracking: [pipelines/income-analysis/](file:///Users/kbtg/codebase/personal-stuff/pipelines/income-analysis/README.md) (refer to Gumroad/Skool CLIs and snapshot logs)
- <!-- TODO(owner interview): Detail target lead generation metrics, product pricing, and traffic targets. -->

---

## 3. Short Link & Affiliate Routing System
- **Thesis**: Clean, branded short redirect links (`go.agrolloo.com/<code>/<tool>`) that track click counts to help analyze conversion efficiency across YouTube and Pinterest.
- **Where it lives**:
  - URL Redirector Worker: [apps/redirector/](file:///Users/kbtg/codebase/personal-stuff/apps/redirector/CLAUDE.md)
  - Database schema & views: D1 `clicks-db` and KV `CLICKS_KV` (see [INFRA.md](file:///Users/kbtg/codebase/personal-stuff/INFRA.md))
- **Status & Metrics**:
  - Click logs sync: `pipelines/youtube/yt-analysis/sync_clicks.py`
  - Affiliate Income reporting: [pipelines/income-analysis/](file:///Users/kbtg/codebase/personal-stuff/pipelines/income-analysis/README.md) (wired to PayPal and impact.com affiliate reporting)
- <!-- TODO(owner interview): Define link naming conventions and click/conversion expectations. -->

---

## 4. Monetizable Developer Micro-SaaS
- **Thesis**: Build high-quality developer-facing micro-services (such as a bank statement parser) and list them as paid API products on RapidAPI.
- **Where it lives**:
  - Bank Statement Parser: [pipelines/bank-statement-parser/](file:///Users/kbtg/codebase/personal-stuff/pipelines/bank-statement-parser/README.md)
  - Product ideas & research: [pipelines/docs/research/](file:///Users/kbtg/codebase/personal-stuff/pipelines/docs/research/)
- **Status & Metrics**:
  - Under active development and design.
- <!-- TODO(owner interview): Outline the pricing models, RapidAPI release schedule, and roadmap for other SaaS micro-tools. -->

---

## 5. Career Progression & Job-Switch Prep
- **Thesis**: Keep skills current and prepare for job-switching opportunities through structured systems development and practice.
- **Where it lives**:
  - Tasks list: [pipelines/to-do/todolist.md](file:///Users/kbtg/codebase/personal-stuff/pipelines/to-do/todolist.md) (and `apps/telegram-my-planner/to-do/business.md`)
  - DSA Practice: [learning/DSA/](file:///Users/kbtg/codebase/personal-stuff/learning/DSA/)
- **Status & Metrics**:
  - Monitored privately.
- <!-- TODO(owner interview): Specify target roles, tech stack targets, and timeline milestones. -->
