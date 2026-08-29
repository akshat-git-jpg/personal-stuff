# pp-claude-tags (superseded)

> **Superseded by [`pp-agents`](../pp-agents/README.md) on 2026-08-26.** Use that
> for the tag view. This is kept for the gate-finding research and because the
> patch still works on 2.1.245 and earlier. It no longer runs on a schedule and
> no longer writes `fleetViewGroupMode`.

## What broke, and why patching was abandoned

2.1.246 changed how the bundle is built. The executed code no longer comes from
the JavaScript text this patches, so flipping the byte became **cosmetic**: the
byte reads `unlocked`, `find_gate` agrees, the stamp is current, the log says
`already unlocked` - and the tag view is gone. No signal anywhere.

Proven by rendering the agents view in a pty with `fleetViewGroupMode=group` on
both builds:

| Build | Headers it drew | Verdict |
|---|---|---|
| 2.1.245 | `pp`, `source-filter 2`, `spends-automation`, `vi-prod 2`, `Ungrouped` | patch works |
| 2.1.246 | `Ready for review`, `Needs input`, `Working`, `Completed` | patch ignored |

The second row is `groupMode: o==="group" && !gate ? "state" : o` taking its
gate-off branch on a binary whose gate byte says otherwise.

Ruled out along the way: the hardlinked `ClaudeCode.app` binary (same inode,
same patch) and bytecode compilation as such (2.1.243 and 2.1.245 carry ~1,390
`@bun @bytecode` markers too, and the patch worked there). What changed in 246
is the chunk layout around the gate - the enclosing marker span went from ~1.3MB
to 179KB, and the binary from 376MB to 231MB.

A patch that can go cosmetic without saying so cannot be trusted, and the same
thing can land on any release. `pp-agents` reads the session records and drives
published commands instead, so no release can do this to it again.

## What this still does

Flips the gate byte and re-signs the binary, nothing else. Useful only on
2.1.245 and earlier.

```bash
pp-claude-tags        # patch if the build allows it, else say so
pp-claude-tags -q     # quiet
```

The `~/.zshrc` hook in `clw` / `clp` still calls it and is harmless. The launch
agent is gone: it ticked every two minutes and rewrote the view setting, which
after 246 only undid a deliberate `ctrl+s`.

```bash
launchctl unload ~/Library/LaunchAgents/com.kbtg.pp-claude-tags.plist   # already done
```

## How the gate is found

Never by name. The minified variable changes every release — `X` in 2.1.237, `Q`
in 2.1.238, `q` in 2.1.239. A fixed string stopped matching on the first update
and the tags silently vanished.

Two independent strategies run, so one refactor cannot take the whole thing out.
If both fire they must agree on the same byte, otherwise nothing is touched.

**1. Code shape.**

```
...capExpanded:X}=hook(M), GATE=!1, [S]=useState(()=>make(host,GATE))
```

The back-reference — the same variable declared `=!1` and then passed into the
view store — is what makes this specific enough to patch blind. The `useState`
wrapper is spelled `React.useState(...)` in some builds and as a bare minified
call in others, so that half is optional.

**2. The property name.** Minification leaves object keys alone, so every read
of the gate is spelled `groupsEnabled:<gate>` and names the variable exactly.
Each such read is a candidate anchor, and one survives only if the name it
points at is declared `=!0` / `=!1` within 12KB of it. Reads that are only props
or function parameters have no declaration nearby and drop out. Short names
repeat across a 345MB bundle, so the surviving declarations must all land on
exactly one offset.

Both were verified to agree on 2.1.239, 2.1.240, 2.1.241 and 2.1.243, and each
was verified to work with the other disabled.

### What 2.1.243 broke

Both anchors failed at once, which is the case the alert exists for.

- The bundle was split into chunks. `attachView({groupsEnabled:X})` moved into a
  chunk of its own where `X` is only a function parameter, so anchoring on that
  one call could no longer reach the declaration. Strategy 2 now anchors on
  every `groupsEnabled:` read instead.
- `React.useState` was minified down to a bare call, so the shape stopped
  matching. Strategy 1 now treats the `React.` half as optional.

The gate itself did not move: it is still one `=!1` beside the `capExpanded`
destructure.

## When it cannot patch

A release could change both anchors. Then nothing is written, and you get a
**macOS notification** — because a warning in a launch-agent log is a warning
nobody reads, and the first symptom would otherwise be noticing your tags are
gone hours later. The same alert fires if a patch is applied and rolled back.

Claude Code keeps working throughout; only the tags hide.

## Using it, inside `clw` / `clp`

| Key | Action |
|---|---|
| `ctrl+e` | tag the focused session (type a name, `tab` completes an existing one) |
| `ctrl+s` | cycle the view: by state → by folder → by tag |
| `enter` on a tag header | fold / unfold that tag |
| `ctrl+r` | rename a session, or a tag header |
| `ctrl+t` | pin to top |
| `ctrl+x` on a tag header | remove that tag |
| `space` | reply to a session without opening it |
| `?` | all shortcuts |

Fold every tag but one and only that tag's sessions are listed — the folded
headers double as the tag picker.

`ctrl+e` needs the **list** view (not an open session), a session row focused
(not a header), and an **empty** prompt box — with text typed, `ctrl+e` is the
editor's end-of-line key instead.

## Where things live

- Tags: `$CLAUDE_CONFIG_DIR/jobs/<id>/group`, one plain file per session. These
  are never touched by the patch, so tags survive a locked binary — they just
  stop being displayed.
- Default view: `fleetViewGroupMode` in `$CLAUDE_CONFIG_DIR/.claude.json`, set to
  `group`. With the gate off the view clamps this to a mode it still allows, so
  a reverted patch also rewrites the setting; the script puts it back on every
  run — see [The setting also has to survive the update](#the-setting-also-has-to-survive-the-update)
  for why that is not a one-shot after patching.
- Stamp: `~/.cache/pp-claude-tags.json`. Lock: `~/.cache/pp-claude-tags.lock`.
  Log: `~/.cache/pp-claude-tags.log`.

## Tagging a session automatically

Tagging by hand gets tedious for a folder you open often. `.claude/hooks/session-group.sh`
in this repo is a `SessionStart` hook that writes the tag file for you, picking the tag from
the session's working directory. Sessions in `tooling/boss` come up tagged `boss` instead of
Ungrouped.

Add a folder by adding one `case` arm:

```bash
case "$cwd" in
  */personal-stuff/tooling/boss|*/personal-stuff/tooling/boss/*) group="boss" ;;
  */personal-stuff/pipelines/video/*)                            group="video-production" ;;
esac
```

An existing tag is never overwritten, so `ctrl+e` still has the final say on any session.

### Where it is registered, and why not in the repo

In the `SessionStart` block of **each account's user settings**, by absolute path:

```json
"SessionStart": [
  { "hooks": [ { "type": "command",
      "command": "/Users/kbtg/codebase/personal-stuff/.claude/hooks/session-group.sh" } ] }
]
```

`~/.claude-work/settings.json` and `~/.claude-personal/settings.json` both carry it. Putting
it in the repo's own `.claude/settings.json` looks tidier and does not work: Claude Code
reads project settings from the working directory, and `tooling/boss` has its own `.claude/`,
so a session started there never sees the repo-root file — which is the one case the hook is
for. This is machine state, same as the binary patch above; a new machine needs both.

To see what it decided:

```bash
CLAUDE_SESSION_GROUP_DEBUG=1 claude      # then read /tmp/session-group.log
```

## Tests

```bash
python3 tooling/cli/pp-claude-tags/test-pp-claude-tags.py
```

Covers gate detection against a synthetic bundle - including the two cases where
it must refuse rather than guess - and asserts the retirement: no heal, no
config paths compiled in, no launch agent.

