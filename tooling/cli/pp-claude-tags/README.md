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
   `~/.local/share/claude/versions` and also ticks every 2 minutes. Covers the
   case that actually bit: Claude Code updating and restarting **itself**, with
   no shell involved. The interval is the backstop for a watch that fires while
   a ~310MB binary is still being written, and it also bounds how long the view
   setting below can stay wrong.

Both are idempotent and serialised by a lock file, so a burst of triggers
patches once instead of racing.

### The setting also has to survive the update

Patching the new binary is only half of it, and the other half is what has
broken three times.

Every Claude Code session reads `fleetViewGroupMode` once at startup and writes
it back on its next save. A session running a **gate-off** build clamps it to a
mode the locked view still allows. A session running a **patched** build re-saves
whatever the value happened to be when it started. Either way an update leaves
live sessions that overwrite the good value minutes or hours later. Your tags are
all still on disk; the view just stops being the tag view, which looks identical
to losing them.

So the setting is re-selected on **every** run, not only on a fresh patch.

The first attempt at that healed only while a Claude Code process older than the
patch was still alive, on the reasoning that nothing else could clamp the setting
and a deliberate `ctrl+s` should therefore be respected. That gate lost the race.
On 2026-08-26 the agents view sat on folders all day with 2.1.246 patched
correctly at 07:20 and all 16 tag files present: the overwriting write landed
after the last process old enough to be recognised, so every tick said "already
unlocked" and returned without ever looking at the setting. Nothing looked wrong
anywhere - not the stamp, not the log, not the patch.

It is now corrected unconditionally. The cost is that `ctrl+s` to the folder or
state view does not stick; it goes back to tags on the next tick. To keep a
different view, opt out:

    touch ~/.cache/pp-claude-tags-noheal      # stop healing the setting
    rm ~/.cache/pp-claude-tags-noheal         # resume

A tick cannot stop a live session from writing the value back again, so a session
that keeps doing it produces a heal on every tick. After three in a row you get a
**macOS notification** telling you to quit that session or press `ctrl+s` in it -
otherwise the two trade writes silently for as long as that session lives.

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

## Tests

    python3 tooling/cli/pp-claude-tags/test-pp-claude-tags.py

Everything runs against temp files, so no test reads the real `.claude.json`, the
real stamp or the real binary, and none can fire a desktop notification. It
covers the two things that have actually broken: the view setting (healed
unconditionally, counts a fight, respects the opt-out, survives a missing or
half-written config) and gate detection against a synthetic bundle, including the
two cases where it must refuse to patch — no anchor, and two candidate anchors.

Registered in `tooling/cli/pp-land/verify-map.tsv`, so a land that touches this
folder runs it.

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
