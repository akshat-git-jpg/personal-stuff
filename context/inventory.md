# Product Inventory

This inventory tracks all apps, websites, and tools hosted under this repository ecosystem.

| Product / Site | Public URL | Repository Location | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- |
| **KushalTools** | [kushal-tools.agrolloo.com](https://kushal-tools.agrolloo.com) | `apps/kushal-tools/` (Worker) | Shared launcher hub linking all live agrolloo.com sites | **Live** (Password Gated) |
| **Gym Tracker** | [kushal-gym.agrolloo.com](https://kushal-gym.agrolloo.com) | `apps/gym-app/` (Worker) | Personal Gym & Workout PWA backed by Google Sheets | **Live** |
| **Kushal Docs** | [kushal-docs.agrolloo.com](https://kushal-docs.agrolloo.com) | `apps/kushal-docs/` (Worker) | Document Vault PWA backed by Cloudflare R2 | **Live** (Google Auth Gated) |
| **Personal Dashboard** | [my-dashboard.agrolloo.com](https://my-dashboard.agrolloo.com) | `apps/personal-dashboard/` (Docker) | Mobile PWA dashboard for daily metrics and tracking | **Live** (Auth Gated) |
| **Tutorials Tracker** | [tutorials-tracker.agrolloo.com](https://tutorials-tracker.agrolloo.com) | `apps/analytics-app/` (Worker) | YouTube tutorial pipeline Kanban tracker & link shortener | **Live** |
| **YT Analytics** | [yt-analytics.agrolloo.com](https://yt-analytics.agrolloo.com) | `apps/analytics-app/` (Worker) | Click dashboard over D1 clicks-db + YouTube view counts | **Live** (Password Gated) |
| **Founders Tracker** | [founders.agrolloo.com](https://founders.agrolloo.com) | `apps/founders-tracker/` (Worker) | Action item tracking for Khushi + Kushal | **Live** (Password Gated) |
| **Lists** | [lists.agrolloo.com](https://lists.agrolloo.com) | `apps/lists-app/` (Worker) | Categorized personal items list app (SPA) | **Live** (Password Gated) |
| **URL Shortener** | [go.agrolloo.com](https://go.agrolloo.com) | `ty/workers/redirector/` | Short link redirection + click-tracking edge engine | **Live** |
| **Keto Kitchen** | [keto-kitchen.agrolloo.com](https://keto-kitchen.agrolloo.com) | `ty/pinterest/keto-kitchen/` | Static landing page for Pinterest marketing funnel | **Live** |
| **Bride Bestie** | [bridebestie.com](https://bridebestie.com) | `ty/pinterest/bridebestie/` | Static landing page for Wedding Planner digital downloads | **Live** |
| **Video Studio** | [render2.agrolloo.com](https://render2.agrolloo.com) | `apps/hyperframes-render/` (Docker) | Hyperframes HTML to MP4 video renderer tool | **Live** (Password Gated) |
| **Claude Usage** | `http://localhost:4319/` | `tooling/cli/ccusage-dashboard/` | Claude Code token & cost usage dashboard (ccu-dash) | **Local-Only** |
| **Spending Tracker** | — | `apps/spending-tracker/` | Direct SMS-feeder backed transaction/spending tracker | **Design-Only** (Planned) |
| **Hyperframes Experiment** | — | `ty/hyperframes-vs-remotion/` | Comparison between Hyperframes and Remotion rendering | **Superseded** |

---

## Maintenance Notes
- Updates should be made to this table whenever a new site/Worker is deployed under `agrolloo.com`, `bridebestie.com`, or on the Hostinger VPS.
- Prioritize updating URLs when subdomains or domains are rotated.
