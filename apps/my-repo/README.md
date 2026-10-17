# my-repo

A web page that shows how this repo's skills, CLIs, MCPs and harness connect:
<https://my-repo.agrolloo.com> (same PIN as kushal-tools).

- **Personal / Work tabs**: each opens a grid of areas (Money, YouTube & video, Life & travel, …;
  for work: Ship & review, Zluri systems, …) with counts and a loose-end badge.
- **One area's map**: four lanes, *what you say → skill → CLI or MCP → outside service*. Click a
  box to light up everything it calls and everything that calls it. Search covers everything.
- **Harness** (under the map): the parts that run on their own: folder agents (butler, boss, chief,
  with their start command, from `tooling/harnesses.json`), `CLAUDE.md` routing, hooks,
  mods (plugins with a JS hooks module: their commands, tools, and on/off per account), other
  plugins, Mac launchd jobs, VPS crons.
- **Table**: every item grouped by area, sortable, with its link counts and last change.
- **Loose ends**: what the last scan flagged: a CLI no skill calls, a description over budget, a
  broken symlink, a parked MCP, an abandoned tool, a `tooling/` folder agent missing from
  `tooling/harnesses.json`.

## How it stays current

Nothing on the page is typed by hand. `scripts/scan.mjs` reads the repo (and work-skills, when it
is cloned next to it) on every deploy. Say **"update my-repo"** to Claude to re-scan and redeploy.
The maintainer job `my-repo` reports when the live map is older than the repo.

Facts a file cannot tell (which service a CLI reaches, which CLIs are plumbing) live in
`data/curated.json`.

## First deploy (done 2026-10-16)

```bash
npm ci
npx wrangler secret put APP_PASSWORD     # the owner's PIN
npx wrangler secret put SESSION_SECRET   # a long random string
npm run deploy
```
