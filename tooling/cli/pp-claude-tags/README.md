# pp-claude-tags

Unlocks Claude Code's built-in session tags in the agents view, and keeps them
unlocked across updates.

Claude Code ships the feature (it calls them **groups**) but the agents view
hardcodes its gate to `false`, so `ctrl+e` and the tag view are unreachable.
This flips that one gate byte, re-signs the binary (macOS kills an unsigned
arm64 binary), and verifies it still runs — restoring the original byte if
anything fails.

```bash
pp-claude-tags        # patch if needed, else a ~0.05s no-op
pp-claude-tags -q     # quiet, for shell startup
```

## Surviving updates

An update installs a whole new binary, so the patch has to be re-applied. Two
triggers cover the two ways an update lands:

1. **`~/.zshrc`** — `claude-work()` / `claude-personal()` call it, so `clw` and
   `clp` re-apply it. Covers a new terminal.
2. **`~/Library/LaunchAgents/com.kbtg.pp-claude-tags.plist`** — watches
   `~/.local/share/claude/versions` and also ticks every 10 minutes. Covers the
   case that actually bit: Claude Code updating and restarting **itself**, with
   no shell involved. The interval is the backstop for a watch that fires while
   a ~310MB binary is still being written.

Both are idempotent and serialised by a lock file, so a burst of triggers
patches once instead of racing.

```bash
launchctl list | grep pp-claude-tags        # is the watcher registered
tail ~/.cache/pp-claude-tags.log            # what it did
launchctl unload ~/Library/LaunchAgents/com.kbtg.pp-claude-tags.plist   # stop it
```

## How the gate is found

Never by name. The minified variable changes every release — `X` in 2.1.237, `Q`
in 2.1.238, `q` in 2.1.239. A fixed string stopped matching on the first update
and the tags silently vanished.

Two independent strategies run, so one refactor cannot take the whole thing out.
If both fire they must agree on the same byte, otherwise nothing is touched.

**1. Code shape.**

```
...capExpanded:X}=hook(M), GATE=!1, [S]=React.useState(()=>make(host,GATE))
```

The back-reference — the same variable declared `=!1` and then passed into the
view store — is what makes this specific enough to patch blind.

**2. The property name.** Minification leaves object keys alone, so the store
call `attachView({groupsEnabled:<gate>})` names the gate exactly. A bare
`groupsEnabled:` is too loose: it also matches the props it is destructured into
downstream, which have no declaration. Short names repeat across a 310MB bundle,
so only a declaration within 12KB of that call counts, and there must be exactly
one.

Both were verified to agree on 2.1.238 and 2.1.239, and each was verified to
work with the other disabled.

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
  a reverted patch also rewrites the setting; the script puts it back after a
  successful patch.
- Stamp: `~/.cache/pp-claude-tags.json`. Lock: `~/.cache/pp-claude-tags.lock`.
  Log: `~/.cache/pp-claude-tags.log`.

## Reverting to stock

Remove the two `pp-claude-tags` lines from `~/.zshrc`, unload the launch agent,
then reinstall Claude Code.

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
