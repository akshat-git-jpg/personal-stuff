---
name: my-repo
description: Keeps my-repo.agrolloo.com current, the live map of this repo's skills, CLIs, MCPs and harness and how they connect, plus its loose ends. Re-scans and redeploys, answers "what calls X", and teaches the scanner a new service or plumbing CLI. Triggers on "update my-repo", "refresh the repo map", "redeploy my-repo", "what calls pp-drive", "what uses this skill", "loose ends in my repo", "my-repo".
---

# my-repo

The page: https://my-repo.agrolloo.com (same PIN as kushal-tools). App: `apps/my-repo` (read its `CLAUDE.md` before changing code).

The map is **built, not kept by hand**: `apps/my-repo/scripts/scan.mjs` reads skills, CLIs, MCPs, hooks, plugins, launchd jobs and VPS crons from the repo, writes `data/graph.json` (gitignored), and the deploy bundles it behind the PIN.

## "update my-repo"

Run from the **main checkout** after the change you want mapped has landed, so the map's commit is `main`:

```bash
cd apps/my-repo
[ -d node_modules ] || npm ci --no-audit --no-fund
npm run deploy        # scan -> build -> wrangler deploy; prints counts and every loose end
```

Then tell the owner the counts line, the loose ends (each with its fix), and the URL. Deploying needs the owner's Cloudflare login, so it is a Mac-only step; on the Windows machine say so and stop.

## "what calls X" / "what does X use"

```bash
cd apps/my-repo && node scripts/scan.mjs >/dev/null && node -e '
const g=require("./data/graph.json"), q=process.argv[1];
for (const e of g.edges) if (e.from.endsWith(":"+q)||e.to.endsWith(":"+q)) console.log(e.from, e.kind, e.to)' pp-drive
```

## Teaching the scanner (needs a pp-work workspace, it is a tracked file)

`apps/my-repo/data/curated.json` holds the facts files cannot tell:

- `services`: node id -> outside services it reaches (`"cli:pp-drive": ["Google Drive"]`). Add one for every new user-facing CLI or MCP.
- `plumbing`: CLIs that hooks or other skills call; they never get a "no skill calls this" loose end.
- `areas`: the ordered area rules for the Personal and Work tabs. An item takes the first area of its scope whose `groups` or `match` regex fits; work scope = work-skills plus `workScope` names. A new item in "Other" means a rule is missing: add a pattern, never a one-off id.
- `abandoned`: node id -> why. `skillCalls`: links a skill makes through a claude.ai connector or a user-level MCP.

Node ids are `skill:<name>`, `work:<name>` (work-skills), `cli:<binary>`, `mcp:<name>`.

## Loose ends and their fix

| Loose end | Fix |
|---|---|
| No skill calls this CLI | Give it a front-door skill (`tooling/cli/README.md`, "How Claude finds a CLI"), or add it to `plumbing` |
| Description over budget | Trim the skill's description under 500 chars |
| Symlink points at a missing folder | Re-run `scripts/relink.sh`, or remove the dead link |
| Parked MCP | Fine if intended; else delete it or wire it in `scripts/regen-mcp-json.sh` |

The maintainer job `my-repo` (`tooling/maintainer/jobs/my-repo/`) reports when the live map is older than the repo.
