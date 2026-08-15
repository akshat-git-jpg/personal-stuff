---
executor: claude-p
model: sonnet
test_cmd: node --test tooling/cli/ccusage-dashboard/test/*.test.mjs
ui: true
deploy:
needs: ["PR #160 (plan 201) must land first — this plan imports workspace.mjs"]
needs_prs: [160]
touches: [tooling/cli/ccusage-dashboard/dashboard.mjs, tooling/cli/ccusage-dashboard/test/tabs.test.mjs, tooling/cli/ccusage-dashboard/README.md]

mutation_apply: node -e "const f='tooling/cli/ccusage-dashboard/dashboard.mjs';let s=require('fs').readFileSync(f,'utf8');s=s.replace('id=\"ws-app\"','id=\"ws-app-DISABLED\"');require('fs').writeFileSync(f,s)"
mutation_command: node --test tooling/cli/ccusage-dashboard/test/tabs.test.mjs
mutation_expect: not ok 3 - 3. page mounts both panes
mutation_timeout: 300
---

# Plan 202: Workspace tab in the ccusage dashboard

## Summary

- **Problem statement**: Plan 201 produces a full picture of the owner's Claude
  workspace as JSON, but nothing renders it. The owner wants to open it from the
  local-apps dashboard like every other tool.
- **Goals**:
  - Add a two-tab header to `dashboard.mjs`: **Usage** (the existing view,
    unchanged) and **Workspace** (new).
  - Serve `GET /api/workspace` from `getWorkspace()`.
  - Render four sortable tables — Apps & connections, Routines, Memory, Skills —
    each with a "show dead only" toggle, so unused entries are one click away.
  - Commit a screenshot of the real tab (this plan is `ui: true`).
- **Executor proposed**: `claude-p` / Claude Sonnet — the output is judged by the
  owner's eye, which is `tooling/boss/data/rules.md`'s sonnet row (quality-setting
  visual work), not agy's fully-mechanical row.
- **Done criteria** (terse — full list below): `node --test tooling/cli/ccusage-dashboard/test/` exits 0; both tabs render; `/api/workspace` returns four layers; a real screenshot is committed; the Usage tab is byte-identical in behaviour.
- **Stop conditions** (terse — full list below): needing a build step or dependency; the Usage view changing; fabricating the screenshot.
- **Test / verification for success**: Node test runner boots the real server on
  an ephemeral port, fetches `/api/workspace` and `/`, and asserts on the
  payload and the HTML — plus an owner-visible screenshot.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 24677c33..HEAD -- tooling/cli/ccusage-dashboard/`
> Expected: `workspace.mjs`, `test/workspace.test.mjs`, and `test/fixtures/**`
> added by plan 201, and nothing else. If `dashboard.mjs` already differs,
> re-read it in full before editing.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED — it edits a 544-line file the owner uses daily
- **Depends on**: 201
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `24677c33`, 2026-08-15

## Why this matters

The owner asked for a local view of their whole Claude setup, runnable from the
local-apps dashboard. Plan 201 built the data. This is the part they actually
look at.

The tables matter more than they look. A `/doctor` run on 2026-08-15 found 26
skills with zero lifetime uses over 1,360 startups, and the skill listing had
grown past its context budget — so Claude Code was silently dropping the
*descriptions* of ~35 skills, including most of the repo's own
`personal-stuff-*` operating skills. Nothing surfaced that. A standing "show
dead only" view is how it gets caught the next time instead of in an audit.

**Accepted architecture deviation, owner-decided.** `decisions.md` 2026-07-31
says any browser UI with more than one view must be a Vite+React+TS component
app, and template strings are for trivial single-view reports only. Adding a
second tab to `dashboard.mjs` crosses that line. The owner chose this route
explicitly ("i think i have this cc dashboard, you can extend this by making a
new tab"). The mitigation is in Step 1: all Workspace rendering lives in its own
`workspace-view.mjs` module, so `dashboard.mjs` grows by roughly 40 lines rather
than absorbing a second UI. **If a third tab is ever proposed, that is the
trigger to port the whole thing to Vite+React** — do not add a third tab to this
file.

## Current state

### What you are editing

`tooling/cli/ccusage-dashboard/dashboard.mjs`, 544 lines, zero dependencies,
port 4319, registered in `tooling/cli/local-apps-dashboard/apps.json` as id
`ccusage`. Node v22.14.0.

The HTTP handler, lines 272–295 (read directly — this is where the new route
goes, before the HTML fallthrough):

```js
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/usage')) { … }
  if (req.url.startsWith('/api/data')) { … }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML);
});
```

The page shell, lines 378–384:

```html
</style></head><body>
<header>
  <h1>Claude usage</h1>
  <div class="meta"><span id="updated">loading…</span> · auto-refresh 15s</div>
</header>
<div class="wrap" id="app"></div>
<script>
```

The client render entry, lines 511–542:

```js
function render(){
  if(!lastData) return;
  document.getElementById('app').innerHTML =
    planLimitsSection(lastData)
    + '<div class="sec-h">💻 Cost &amp; tokens …</div>'
    + kpiStrip(lastData)
    + '<div class="sec-h">Accounts</div><div class="accts">'+lastData.scopes.map(acctCard).join('')+'</div>'
    + insightsPanel(lastData)
    + detailPanel(lastData);
}

async function load(){
  try{
    const r=await fetch('/api/data',{cache:'no-store'});
    lastData=await r.json();
    render();
    document.getElementById('updated').textContent='updated '+new Date(lastData.generatedAt).toLocaleTimeString();
  }catch(e){ document.getElementById('updated').textContent='fetch failed'; }
}
load();
setInterval(load, 15000);
```

Existing CSS tokens to reuse — do not invent a new palette:
`--bg #0d0f12`, panel `#15181d`, border `#20242b`, text `#e6e8eb`, muted
`#7b828c`, accent-blue `#5aa0e8`, good `#5fd08a`, warn `#e0b24a`, danger
`#e0574d`. Classes already defined: `.wrap`, `.sec-h`, `.panel`, `.hd`, `.kpi`.

### What plan 201 gives you

`workspace.mjs` exports `scanWorkspace(opts)` and `getWorkspace(opts)`. The
payload:

```js
{
  generatedAt, repoRoot,
  accounts: [{ id, dir, present }],
  layers: {
    apps:     [{ id, name, kind, scope, account, port, url, status, uses, lastUsed }],
    routines: [{ id, name, schedule, cronUtc, codePath, status }],
    memory:   [{ path, role, bytes, mtime, scope }],
    skills:   [{ name, source, account, uses, lastUsed, disabled, descChars }],
  },
  warnings: [],
}
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run all tests | `node --test tooling/cli/ccusage-dashboard/test/` | exit 0, `# fail 0` |
| Start the dashboard | `node tooling/cli/ccusage-dashboard/dashboard.mjs` | prints `ccusage dashboard → http://localhost:4319` |
| Screenshot (headless) | `` `node -e "console.log(1)"` then Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --window-size=1400,1600 --screenshot=tooling/cli/ccusage-dashboard/docs/202-workspace-tab.png "http://localhost:4319/?tab=workspace"` `` | writes a PNG > 40 KB |
| Confirm no deps | `ls tooling/cli/ccusage-dashboard/package.json` | `No such file or directory` |

## Scope

**In scope**:
- `tooling/cli/ccusage-dashboard/workspace-view.mjs` (new — the tab's HTML/CSS/JS strings)
- `tooling/cli/ccusage-dashboard/dashboard.mjs` (route + tab bar + mount; ~40 lines)
- `tooling/cli/ccusage-dashboard/test/tabs.test.mjs` (new)
- `tooling/cli/ccusage-dashboard/docs/202-workspace-tab.png` (new — the screenshot)
- `tooling/cli/ccusage-dashboard/README.md` (document the tab)

**Out of scope — do not touch**:
- `workspace.mjs` and `test/workspace.test.mjs` — plan 201 owns them. If the
  scanner is wrong, STOP and report; do not patch it here.
- Any existing Usage-view function (`render`, `kpiStrip`, `acctCard`,
  `detailPanel`, `insightsPanel`, `planLimitsSection`, `loadUsage`) — the Usage
  tab must behave exactly as before.
- `tooling/cli/local-apps-dashboard/**` — `ccusage` is already registered on port
  4319; nothing to add.
- A third tab. See the architecture note above.

## Git workflow

- Branch: `advisor/202-workspace-tab-ui`
- Commit: `feat(ccusage-dashboard): workspace tab with apps, routines, memory, skills` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `workspace-view.mjs`

Export two strings so `dashboard.mjs` can splice them into its existing template:

```js
export const WORKSPACE_CSS = `…`;   // injected before </style>
export const WORKSPACE_JS  = `…`;   // injected before </script>
```

`WORKSPACE_JS` must define exactly these globals and nothing else, so it cannot
collide with the Usage view's names:

- `wsData` — the last payload, `null` until loaded
- `wsSort` — `{ layer: 'apps'|'routines'|'memory'|'skills', key: string, dir: 1|-1 }`
- `wsDeadOnly` — boolean, default `false`
- `renderWorkspace()` — writes into `#ws-app`
- `loadWorkspace()` — `fetch('/api/workspace')`, sets `wsData`, calls `renderWorkspace()`

Reuse `.panel` / `.hd` / `.sec-h`. Add only these new classes:
`.wstable`, `.wstable th` (clickable, `cursor:pointer`), `.wstable td`,
`.ws-pill`, `.ws-toolbar`.

**Status pill colours — this is the encoding, use exactly these:**

| status / state | pill text | colour |
|---|---|---|
| `active` | `active` | `#5fd08a` |
| `unused` | `never used` | `#e0b24a` |
| `disabled` | `off` | `#7b828c` |
| skill with `disabled: true` | `off` | `#7b828c` |

**Columns per table — exactly these, in this order:**

| Table | Columns |
|---|---|
| Apps & connections | Name · Kind · Scope · Account · Uses · Last used · Status |
| Routines | Job · Schedule (IST) · UTC cron · Code path · Status |
| Memory | File · Role · Size · Modified |
| Skills | Name · Source · Account · Uses · Last used · Desc chars · Status |

Formatting rules: `bytes` renders as `1.2 kB` / `14.8 kB`; `lastUsed` and
`mtime` render as a relative age (`3d`, `2h`, `—` when null) — the page already
has `fmtAge` defined at line 389, reuse it rather than writing a second one.

**Sorting**: clicking a `<th>` sorts that table by that column, toggling
direction; the active column shows `▲`/`▼`. Numeric columns (`Uses`, `Desc
chars`, `Size`) sort numerically, everything else `localeCompare`. Sort state is
per table, held in `wsSort` keyed by layer.

**"Show dead only"** is one checkbox in `.ws-toolbar` at the top of the tab. When
checked, every table filters to rows whose `status` is `unused` or `disabled`
(for Memory, which has no status, the table renders unchanged with a muted note
`no status for memory files`).

**Empty and degraded states — enumerate all of them, none may be left to
judgement:**

| Condition | What renders |
|---|---|
| `wsData === null` (not loaded yet) | `<div class="lnote">scanning…</div>`, no tables |
| fetch failed | `<div class="lnote">scan failed — is workspace.mjs present?</div>` |
| a layer array is empty | that panel still renders, body is one row: `<td colspan=N>nothing found</td>` |
| `routines` empty because `../vps-crons` is absent | same empty row, plus the warning from `wsData.warnings` shown under the panel |
| `wsData.warnings.length > 0` | a `.lnote` block at the top of the tab listing each warning |
| an account has `present: false` | its name appears in the header strip greyed with `(not found)` |
| "dead only" checked and a table has no dead rows | `<td colspan=N>nothing dead here</td>` — never an empty `<tbody>` |

**Verify**: `node -e "import('./tooling/cli/ccusage-dashboard/workspace-view.mjs').then(m=>{if(!m.WORKSPACE_CSS||!m.WORKSPACE_JS)throw new Error('missing export');console.log('ok',m.WORKSPACE_JS.length,'js chars')})"` → prints `ok <n> js chars`

### Step 2: Wire the route in `dashboard.mjs`

Add the import at the top, next to the existing `node:` imports:

```js
import { getWorkspace } from './workspace.mjs';
import { WORKSPACE_CSS, WORKSPACE_JS } from './workspace-view.mjs';
```

Add the route **before** the HTML fallthrough, matching the exact shape of the
two routes already there (lines 273–292):

```js
if (req.url.startsWith('/api/workspace')) {
  try {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(await getWorkspace()));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
  return;
}
```

**Verify**: `node tooling/cli/ccusage-dashboard/dashboard.mjs & sleep 3; curl -s localhost:4319/api/workspace | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(Object.keys(j.layers).join(','))})"; kill %1` → prints `apps,routines,memory,skills`

### Step 3: Add the tab bar

Replace the `<header>` block (lines 379–382) with a header that carries two tab
buttons, and add a second mount point next to `#app`:

```html
<header>
  <h1>Claude workspace</h1>
  <nav class="tabs">
    <button class="tab on" data-tab="usage">Usage</button>
    <button class="tab" data-tab="workspace">Workspace</button>
  </nav>
  <div class="meta"><span id="updated">loading…</span> · auto-refresh 15s</div>
</header>
<div class="wrap" id="app"></div>
<div class="wrap" id="ws-app" hidden></div>
```

Tab behaviour, in `WORKSPACE_JS`:

- Clicking a tab toggles `hidden` on `#app` / `#ws-app` and the `on` class on the buttons.
- The active tab is written to the URL as `?tab=usage|workspace` via
  `history.replaceState`, and read back on load, so a refresh keeps the tab.
  `?tab=workspace` opening straight onto the Workspace tab is what the screenshot
  command in "Commands you will need" relies on.
- `loadWorkspace()` runs **lazily** — on first switch to the tab, or immediately
  on load when `?tab=workspace` is present. It must not run on every Usage-tab
  page load; the transcript scan is the expensive part.
- The existing `setInterval(load, 15000)` stays as-is and keeps refreshing Usage
  only. Workspace refreshes on tab switch and on a `↻` button in `.ws-toolbar`,
  not on a timer.

**Lifecycle**: switching tabs must NOT clear `wsData` — switching back re-renders
from memory without a refetch. Only the `↻` button and a fresh page load refetch.

Splice `WORKSPACE_CSS` in immediately before the closing `</style>` on line 378,
and `WORKSPACE_JS` immediately before the closing `</script>` on line 543.

**Verify**: `node tooling/cli/ccusage-dashboard/dashboard.mjs & sleep 3; curl -s localhost:4319/ | grep -c 'data-tab="workspace"'; kill %1` → `1`

### Step 4: Write `test/tabs.test.mjs`

Boot the real server in-process on an **ephemeral port** (`PORT=0`, then read
`server.address().port`) — never 4319, or the test collides with the owner's
running dashboard. Use `node:test` + `node:assert`, same idiom as
`tooling/cli/heygen-web/test/smoke.test.mjs`.

**Guaranteed teardown**: a suite-level `test.after` that force-closes the server
in a `try/finally`. A test that opens an HTTP listener and asserts before
closing it leaves the runner hanging forever, which reads as a hang rather than
a failure.

Tests (names matter — the mutation gate keys on the first):

1. `/api/workspace returns the four layers` — status 200; `Object.keys(body.layers)` deep-equals `['apps','routines','memory','skills']`
2. `page serves both tab buttons` — `GET /` body contains `data-tab="usage"` and `data-tab="workspace"`
3. `page mounts both panes` — body contains `id="app"` and `id="ws-app"`
4. `workspace JS defines its own namespace` — body contains `renderWorkspace` and `loadWorkspace`
5. `usage routes still work` — `GET /api/data` returns 200 with a `scopes` array (the Usage view is unchanged)
6. `workspace route survives a scanner error` — monkey-patch or stub such that the scan throws, assert the response is 500 with a JSON `error` field, not a crash

**Verify**: `node --test tooling/cli/ccusage-dashboard/test/` → exit 0, `# fail 0`, and the process exits (does not hang)

### Step 5: Screenshot and document

1. Start the dashboard, open `http://localhost:4319/?tab=workspace`, and capture
   `tooling/cli/ccusage-dashboard/docs/202-workspace-tab.png` using the headless
   Chrome command in "Commands you will need". Create the `docs/` directory.
2. **Open the PNG and look at it before committing.** It must show the real tab
   against the owner's real data — real skill names, real MCP server names, real
   cron jobs. A mockup, a redraw, or a screenshot of different software is a STOP
   (see `decisions.md` 2026-08-04: a crew committed a fabricated screenshot and it
   nearly landed; the standing rule is that the image gets opened and looked at).
3. Append a `## Workspace tab` section to the README: the two tabs, what each
   table shows, the "show dead only" toggle, and the `?tab=` URL parameter.

**Verify**: `test $(stat -f%z tooling/cli/ccusage-dashboard/docs/202-workspace-tab.png) -gt 40000 && echo ok` → `ok`

## Test plan

`test/tabs.test.mjs`, 6 tests, Node's built-in runner, real server on an
ephemeral port with guaranteed teardown. Combined with plan 201's tests, the
merge gate is `node --test tooling/cli/ccusage-dashboard/test/`.

The mutation gate renames the `/api/workspace` route string, which must make
test 1 fail, then reverts — proving the route test is not vacuous.

Visual verification is the committed screenshot, reviewed by eye at merge.

## Done criteria

- [ ] `node --test tooling/cli/ccusage-dashboard/test/` exits 0, `# fail 0`, `# pass` ≥ 15 (9 from plan 201 + 6 here), and the process exits without hanging
- [ ] `curl -s localhost:4319/api/workspace | jq -r '.layers | keys | join(",")'` → `apps,memory,routines,skills`
- [ ] `curl -s localhost:4319/ | grep -c 'data-tab='` → `2`
- [ ] `curl -s localhost:4319/api/data | jq -r '.scopes | length'` → `3` (Usage view unaffected)
- [ ] `tooling/cli/ccusage-dashboard/docs/202-workspace-tab.png` exists, > 40 KB, and shows the real Workspace tab with real data
- [ ] `ls tooling/cli/ccusage-dashboard/package.json` → does not exist
- [ ] `git diff 24677c33..HEAD --stat -- tooling/cli/ccusage-dashboard/workspace.mjs` → no changes from this branch
- [ ] `plans/README.md` row for 202 updated to DONE

## STOP conditions

- Any step appears to require a build step, bundler, `package.json`, or non-`node:` import — STOP. Built-ins only, by house rule.
- The Usage tab's markup or behaviour has to change to make the tab bar work — STOP and report. The existing view is not in scope, and a regression there is worse than no new tab.
- `workspace.mjs` needs a fix — STOP and report it against plan 201. Do not patch another plan's file.
- **Screenshot integrity**: if you cannot capture a real screenshot of the real tab against real data, STOP and say so. Do not generate, redraw, mock, or substitute an image. An invented screenshot is the one failure mode this repo has already been burned by.
- **Gate integrity**: if an assertion fails, fix the code. Weakening, swapping, or deleting the assertion is a STOP.
- The test suite hangs instead of exiting — STOP and fix teardown before doing anything else. A hanging suite makes every future failure invisible.
- You find yourself wanting a third tab, or the Workspace tab exceeding ~400 lines of `workspace-view.mjs` — STOP and report. That is the trigger to port to Vite+React, not to keep growing this file.

## Maintenance notes

- **This file is now at the architecture boundary.** Two tabs in template
  strings was an explicit owner call (see "Why this matters"). A third view, or
  any editing state / persistence in this tab, means porting to a Vite+React app
  under `apps/` per `decisions.md` 2026-07-31. Exemplars:
  `apps/tutorial-tracker-app`, `pipelines/video/visuals-flow/board-ui`.
- The Workspace tab is deliberately **not** on the 15-second timer. If someone
  later adds it to `setInterval`, the transcript scan will run every 15 seconds
  across up to 100 JSONL files on two accounts.
- A reviewer should scrutinise: that `#app` and `#ws-app` never both render (a
  double-render doubles the page height and looks like a CSS bug), that the
  Usage `render()` was not touched, and that the screenshot shows the real thing.
- The `?tab=` parameter is load-bearing for the screenshot command. If it is
  dropped, the `ui: true` capture silently photographs the Usage tab instead.
