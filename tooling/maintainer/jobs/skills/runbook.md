# Runbook — Claude/Codex skill maintenance

Sibling of [`../memory/runbook.md`](../memory/runbook.md). That one governs what an
agent *remembers*; this one governs what an agent *can do*.

Written 2026-08-25, immediately after the migration that made skills repo-scoped. Every
number here was measured, not estimated. Sections 5 and 6 are the parts a maintainer
agent runs; sections 7 and 8 are the parts that will bite it.

---

## 1. What a skill actually is

A folder with a `SKILL.md` in it. No build step, no compile, no registration. Claude
reads the file.

```
humanizer/
  SKILL.md        <- YAML frontmatter + instructions
  references/     <- optional, loaded only when the skill fires
  scripts/        <- optional
```

Only the frontmatter `description` is loaded into every session. The body is read only
when the skill triggers. **That is the whole cost model**: a skill you never invoke still
costs you its description, every single turn, forever.

### The thing that causes every structural problem

Claude discovers skills from a small fixed set of directories. It never searches the
disk. So the *same files* behave completely differently depending on which directory
they sit in — and until 2026-08-25 this repo used the account-level directories, which
made the answer to "what skills do I have?" depend on which login you happened to
launch.

| Load point | Scope | Read by |
|---|---|---|
| `<repo>/.claude/skills/` | that repo only, **automatic** | Claude, any account |
| `~/.claude-work/skills/` | every work-account session | Claude (work) |
| `~/.claude-personal/skills/` | every personal-account session | Claude (personal) |
| `~/.claude/skills/` | every session with no `CLAUDE_CONFIG_DIR` | Claude (bare) |
| a plugin | every session, per install scope | Claude |
| `~/.codex/skills/` | **every** Codex session, all projects | Codex |

`~/.agents/skills/` is **not** a load point. It is where `npx skills add` drops things.
Nothing reads it directly.

---

## 2. Current state (2026-08-25)

| Location | Count | What |
|---|---|---|
| `.claude/skills/` | **77** | repo operation, deploy, commit flow, CLIs, Cloudflare/Workers pack |
| `pipelines/.claude/skills/` | **50** | 16 real + 34 symlinks into `pipelines/.agents/skills/` |
| `pipelines/.agents/skills/` | **34** | third-party video packs (HyperFrames, build-loop.ai, GSAP…) |
| `work-skills` plugin | **14** | private Zluri skills — separate repo, see §4 |
| `~/.codex/skills/` | **13** | 12 from `.claude/codex-skills.txt` + `find-skills` |
| `~/.claude-work/skills/` | **0** | |
| `~/.claude-personal/skills/` | **0** | |
| `~/.claude/skills/` | **0** | |

**Zero skills depend on which Claude account is logged in.** That is the invariant.

---

## 3. The policy — what a skill is FOR

> **A skill lives at the smallest scope that covers when it fires.**

Read it as a question: *when does this need to exist?*

| Fires… | Goes in |
|---|---|
| only in personal-stuff | `.claude/skills/<name>/` |
| only in video/YouTube work | `pipelines/.claude/skills/<name>/` |
| only at Zluri | the private `work-skills` plugin |
| genuinely everywhere, in Codex too | also add the name to `.claude/codex-skills.txt` |

### The four-question test

Before adding a skill, or when auditing one:

1. **Does it fire on its own?** A skill with a vague description never auto-triggers and
   becomes a slash command nobody types. Rewrite the description or delete it.
2. **Is the scope the smallest that works?** Global is a cost paid by every session. The
   default answer is "the repo it serves", never "global".
3. **Does the repo already have one?** Duplicates are the normal failure here, not the
   exception — this migration found 15.
4. **Would a fresh clone still work?** If it depends on a machine-local path or an
   account directory, it will silently vanish on the next laptop.

---

## 4. The structural model — one home per skill

### Repo skills (the default)

Commit the folder. That is the entire install, for every account, on every machine.
Nothing to link, nothing to register, no manifest. A teammate — or a different Claude
account — cloning the repo gets exactly the same skills.

### Codex is the one real exception

Codex has **no per-repo skill path at all**. It reads only `$CODEX_HOME/skills`, which
is global. So:

- `.claude/codex-skills.txt` lists the handful worth paying for in *every* Codex session
  (12 as of writing). `scripts/mirror-codex-skills.sh` symlinks exactly those.
- Everything else reaches Codex through **`AGENTS.md`**, which tells it to list
  `.claude/skills/` and `pipelines/.claude/skills/` and read the descriptions itself.

Adding a name to `codex-skills.txt` is the only remaining "make this global" lever in
the whole system. Treat it as expensive.

### Zluri skills: a private plugin, local scope

`personal-stuff` is a **PUBLIC** GitHub repo. Work skills leak internal hostnames and
private repo names, so they live in `akshat-git-jpg/work-skills` (private), installed
per work repo:

```bash
cd /Users/kbtg/codebase/dashboard-api
claude plugin marketplace add /Users/kbtg/codebase/work-skills   # once per machine
claude plugin install work-skills@work-skills --scope local      # once per repo
```

`--scope local` writes to that repo's **gitignored** `.claude/settings.local.json`, so
nothing is ever committed to a shared ZluriHQ repo. Repo-scoped, account-independent.

### The five duplicated on purpose

`claude-router`, `github-router`, `humanizer`, `i-have-adhd`, `session-handoff` exist in
BOTH `.claude/skills/` and the private plugin. A symlink cannot span a public and a
private repo without leaving a dead link in whichever one someone else clones, so two
real copies is the honest answer.

**This repo is the source. `work-skills` is always the copy.** Kept in step by:

- `scripts/sync-shared-skills.sh` — copies repo → plugin; `--check` exits 1 on drift
- `scripts/check-repo-hygiene.sh` — warns at commit time
- `com.kushal.skills-sync` — launchd, daily 04:10, syncs + commits + pushes the plugin

---

## 5. The recurring audit — run this

### Step 1 — inventory

```bash
./scripts/skills-status.sh
```

Reports where skills load, the Codex mirror, the private plugin, and any stale account
symlink. Exit 1 on a dangling link or a shared-skill mismatch.

### Step 2 — the account dirs must be empty

```bash
for d in ~/.claude/skills ~/.claude-work/skills ~/.claude-personal/skills; do
  echo "$d: $(ls "$d" 2>/dev/null | wc -l)"
done
```

Anything above zero is either a new third-party install that needs rehoming, or a
regression. **A skill in an account dir reintroduces the account dependency.**

### Step 3 — broken links

```bash
for d in ~/.claude-work/skills ~/.claude-personal/skills ~/.codex/skills \
         .claude/skills pipelines/.claude/skills; do
  for f in "$d"/*; do [ -e "$f" ] || echo "BROKEN $f"; done
done
```

`relink.sh` **cannot** prune a link that resolves outside the repo — it treats those as
foreign and leaves them. Removing a skill folder therefore strands every link to it.
This has happened twice (§7).

### Step 4 — duplicates

Compare **real directories only**. A plain `ls` across the four homes reports 51 hits,
because every intentional symlink (`pipelines/.claude/skills` → `pipelines/.agents/skills`,
and the pipelines skills linked up into `.claude/skills`) looks like a duplicate. Skipping
symlinks is what makes the signal usable:

```bash
for d in .claude/skills pipelines/.claude/skills pipelines/.agents/skills \
         "$HOME/codebase/work-skills/skills"; do
  find "$d" -maxdepth 1 -mindepth 1 -type d -exec basename {} \;
done | sort | uniq -d
```

Expected output is **exactly the five deliberately duplicated skills** (§4):
`claude-router`, `github-router`, `humanizer`, `i-have-adhd`, `session-handoff`.
Anything else is a real duplicate and needs resolving.

Then for each unexpected hit, decide by **total content bytes**, not line count (§7):

```bash
find <copy-a> -name '*.md' -exec stat -f %z {} \; | paste -sd+ | bc
```

### Step 5 — description budget

```bash
bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh
```

Budget 500 chars, hard cap 700. `relink.sh` runs this first and aborts on a cap breach.

### Step 6 — drift and reconcile

```bash
./scripts/sync-shared-skills.sh --check    # repo vs private plugin
bash scripts/check-repo-hygiene.sh
bash scripts/relink.sh                     # codex mirror + push gate + memory link
```

---

## 6. Rules that must not be broken

1. **Never put a skill in an account directory.** `~/.claude-work/skills`,
   `~/.claude-personal/skills` and `~/.claude/skills` must stay empty. The hygiene gate
   fails if `tooling/claude-skills/` (the old global store) reappears.
2. **Never commit a Zluri skill to `personal-stuff`.** It is public. Internal hostnames
   and repo names have leaked this way before.
3. **Never commit a personal skill to a ZluriHQ repo.** Use the private plugin at local
   scope.
4. **Edit the real folder, never a symlink target elsewhere.** For the five shared
   skills, edit the `personal-stuff` copy and sync outward.
5. **Never commit generated media.** Vendor skill packs ship renders — 48 MB of `.mp4`
   arrived with `loop-studio` and `hyperframes-animation`. `pp-push` refuses any single
   path over 4 MB and will park the land. `pipelines/.agents/skills/.gitignore` excludes
   `*.mp4|mov|wav|mp3`.
6. **Restart the session after any skill change.** Discovery is cached at startup.
   `claude -p "list skills"` lies — it can show a stale or wrong-account list. Trust the
   filesystem.
7. **A skill is text, so a "test" is a shape assertion.** Assert which file exists where,
   never the wording.

---

## 7. Traps hit during the 2026-08-25 migration

Each of these cost real time. A maintainer agent should expect them.

**Line count is not content.** The repo's `hyperframes-media` had the *longer* SKILL.md
(243 vs 97 lines) and was the *worse* copy — it had lost its `references/` folder and
inlined a stub. Measured by total markdown bytes it was 14 KB against the vendor's 66 KB.
Neither source won across all five duplicated skills; the winner had to be picked per
skill.

**`relink.sh` cannot clean up after you.** It only prunes links resolving into the
current repo. Links into a *leased worktree* or a deleted account folder look foreign and
survive. Found 39 work-account links pointing at a dead `kb-scratch` worktree — meaning
repo edits had silently not reached the work account — and later 14 dead Codex links
after folders were removed. Both had to be deleted by hand.

**`pp-land` matches verify rules against DELETED paths too.** The commit that removed
`tooling/claude-skills/**` still matched the base's verify rule for that prefix, so the
land tried to run a script the same commit had deleted, and parked. A 3-line forwarding
shim at `scripts/check-skill-descriptions.sh` unblocks it; it is safe to delete once no
in-flight branch touches that path.

**`pp-push` died silently (exit 2, empty log)** on any push that deleted a `*.example`
file: `example_is_placeholder_only` was called bare under `set -e`, so a non-zero return
killed the gate before `case $?` could read it. Fixed, plus a rule so a pre-existing
secret-shaped file can actually be deleted, plus two regression tests.

**"Files match" is not "committed".** The first `skills-sync` run reported *in sync* and
exited, while five skills sat untracked and unpushed in the plugin repo. It compared file
contents; it should have compared git state. Fixed.

**Vendor packs bring luggage.** `loop-studio` shipped a full `node_modules` — 23,026
files on disk, 1,084 actually tracked after gitignore. Always check what git would take
before committing an adopted skill.

**Third-party skills carry someone else's name.** `loop-studio` and `video-taste` open
with "Luuk's in-house AI edit studio". They are build-loop.ai's product. Do not assume a
skill in your account is yours.

---

## 8. Still open

- **Public git history.** The 8 Zluri skills are gone from `HEAD`, but `personal-stuff`
  is public and history retains `argo-workflows-be-exports.pvt.zluri.com` and several
  ZluriHQ repo names. Making the repo private is the only cheap fix. Owner's call.
- **Three dangling vendor references** survive in the merged hyperframes skills
  (`sub-compositions.md`, `determinism-rules.md`, a literal `X.md`). All were already
  broken upstream.
- **Eight descriptions over the 500-char budget**, worst `printing-press-amend` at 661.
  All under the 700 hard cap, so nothing is broken.
- **Usage data does not exist.** The audit could only measure *references in the repo*,
  not actual invocations. Eight skills had zero references and were kept anyway. A real
  usage signal would make the next audit far sharper.

---

## 9. Possible automation

Ordered by value to a repo-maintainer agent.

1. **Harden `relink.sh` to prune foreign links** that point at a nonexistent target, or
   into a `kb-scratch` worktree. Two separate incidents; the same one-line check catches
   both.
2. **Extend the hygiene gate** to fail on any non-empty account skill directory. Today
   that is only reported by `skills-status.sh`, which nothing runs automatically.
3. **A duplicate detector** in the hygiene gate — the `uniq -d` in §5 step 4, run on
   every commit.
4. **Usage tracking.** Claude Code's `/plugin` UI reports a "Last used" date per plugin
   skill. If the same signal is reachable for repo skills, the four-question test becomes
   evidence-based instead of a judgement call.
5. **A quarterly audit cron** that runs §5 and files findings, the way
   `../memory/runbook.md` §9 proposes for memory.

---

## Everyday commands

```bash
./scripts/skills-status.sh              # where everything loads
./scripts/sync-shared-skills.sh         # push the 5 shared skills to the private plugin
./scripts/relink.sh                     # codex mirror + push gate + memory link
bash scripts/check-repo-hygiene.sh      # shape assertions incl. skill scoping
```

**Adding a skill:** create `.claude/skills/<name>/SKILL.md`, commit, restart the session.
That is the whole flow. No manifest, no relink, no account choice.

## Related

- [`../memory/runbook.md`](../memory/runbook.md) — the same treatment for memory
- `decisions.md` 2026-08-25 — the four decision entries behind this migration
- `.claude/skills/claude-router/` — the operating skill for creating/installing/removing
- [`../../AGENTS.md`](../../AGENTS.md) — how Codex is told about all of this
- [`../../MAC-LAUNCHD.md`](../../MAC-LAUNCHD.md) — the `com.kushal.skills-sync` job
