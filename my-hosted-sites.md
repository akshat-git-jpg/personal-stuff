# My hosted sites

- KushalTools (hub / launcher for everything below) — https://kushal-tools.agrolloo.com (password-gated)
- Gym tracker — https://kushal-gym.agrolloo.com
- Kushal Docs (document vault) — https://kushal-docs.agrolloo.com
- Personal dashboard — https://my-dashboard.agrolloo.com
- Tutorials tracker — https://tutorials-tracker.agrolloo.com
- YT Analytics (link click dashboard) — https://yt-analytics.agrolloo.com (password-gated)
- Kushal Income (personal SBI account: salary in, spending by category) — https://kushal-income.agrolloo.com (password-gated) — snapshot only, refreshed by `pipelines/personal-finance/summarise.py` then `npm run deploy`; the bundled data names real counterparties so it is gitignored, never committed; app at `apps/kushal-income`
- YT Income (revenue by tool, tallied against the bank) — https://yt-income.agrolloo.com (password-gated)
- Founders tracker (Khushi + Kushal action items) — https://founders.agrolloo.com (password-gated)
- Lists (categorized personal lists) — https://lists.agrolloo.com (password-gated)
- URL shortener — https://go.agrolloo.com
- Bride Bestie landing page — https://bridebestie.com
- Hyperframes → Video renderer — https://render2.agrolloo.com (password-gated; editor pastes Hyperframes card HTML, downloads MP4)
- Claude usage - http://localhost:4319/ (ccu-dash)
- Timeblock day planner — https://timeblock.agrolloo.com (password-gated: APP_PASSWORD/SESSION_SECRET); Worker + KV (BLOCKS_KV), static `public/`; app at `apps/timeblock`
- Closet (wear counter + outfit gallery) — https://closet.agrolloo.com (password-gated) — two tabs: Clothes (tap photo = +1 wear, ↺ washed = reset to 0, 10s Undo) and Looks (tagged outfit photos, AND-filter chips); installable PWA; Worker + D1 (closet-db) + R2 (closet-photos); app at `apps/closet-app`
- Script desk (freelancer script-writing page) — https://script-desk.agrolloo.com (secret-link only, per video)
